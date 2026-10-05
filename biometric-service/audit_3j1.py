"""
Phase 3J.1 -- Deterministic Trust-State Machine Audit
======================================================
Objective
---------
Inspect and execute the transition matrix for the existing Trust State Machine
in trust.service.ts. Do NOT modify the source. 

Tests:
1. Verify legal transitions.
2. Verify hysteresis (preventing state-bouncing).
3. Identify dead-ends or unsafe recovery paths.
"""

from enum import Enum

class TrustState(Enum):
    TRUSTED = "TRUSTED"
    OBSERVE = "OBSERVE"
    CHALLENGE = "CHALLENGE"
    RESTRICTED = "RESTRICTED"
    LOCKED = "LOCKED"

# Hardcoded thresholds found in trust.service.ts
CHALLENGE_ENTER = 0.70
CHALLENGE_EXIT  = 0.80
OBSERVE_ENTER   = 0.85
OBSERVE_EXIT    = 0.90

def evaluate(previous_state, confidence, risk_score, fusion_decision="ALLOW"):
    new_state = previous_state
    
    # 1. Critical Hard Rules
    if risk_score >= 80:
        return TrustState.LOCKED
    elif risk_score >= 60:
        return TrustState.RESTRICTED
    elif fusion_decision == 'SPOOF_DETECTED':
        return TrustState.LOCKED if previous_state == TrustState.LOCKED else TrustState.RESTRICTED
    elif fusion_decision == 'CONFLICT':
        if previous_state in [TrustState.LOCKED, TrustState.RESTRICTED]:
            return previous_state
        return TrustState.CHALLENGE
        
    # 2. Identity Confidence with Hysteresis
    if previous_state == TrustState.TRUSTED:
        if confidence < OBSERVE_ENTER or risk_score >= 30:
            new_state = TrustState.OBSERVE
        # Note: In TS, the second IF overrides the first.
        if confidence < CHALLENGE_ENTER or risk_score >= 50:
            new_state = TrustState.CHALLENGE

    elif previous_state == TrustState.OBSERVE:
        if confidence >= OBSERVE_EXIT and risk_score < 30:
            new_state = TrustState.TRUSTED
        elif confidence < CHALLENGE_ENTER or risk_score >= 50:
            new_state = TrustState.CHALLENGE

    elif previous_state == TrustState.CHALLENGE:
        if confidence >= CHALLENGE_EXIT and risk_score < 50:
            if confidence >= OBSERVE_EXIT and risk_score < 30:
                new_state = TrustState.TRUSTED
            else:
                new_state = TrustState.OBSERVE

    elif previous_state in [TrustState.RESTRICTED, TrustState.LOCKED]:
        if risk_score < 20 and confidence >= CHALLENGE_EXIT:
            new_state = TrustState.CHALLENGE

    return new_state

def test_transition(scenario, previous_state, confidence, risk_score, expected, decision="ALLOW"):
    result = evaluate(previous_state, confidence, risk_score, decision)
    match = "PASS" if result == expected else f"FAIL (Got {result.name})"
    print(f"[{match}] {scenario:<40} | Prev: {previous_state.name:<10} | Conf: {confidence:.2f} | Risk: {risk_score:<2} -> {result.name}")

print("=====================================================================")
print("  3J.1 STATE MACHINE AUDIT -- EXECUTION")
print("=====================================================================")

print("\n--- HYSTERESIS (Bounce Prevention) ---")
# If I am TRUSTED and drop to 0.84, I enter OBSERVE. I need 0.90 to go back to TRUSTED.
test_transition("TRUSTED drops to OBSERVE (0.84)", TrustState.TRUSTED, 0.84, 0, TrustState.OBSERVE)
test_transition("OBSERVE stays OBSERVE at 0.89", TrustState.OBSERVE, 0.89, 0, TrustState.OBSERVE)
test_transition("OBSERVE recovers to TRUSTED at 0.90", TrustState.OBSERVE, 0.90, 0, TrustState.TRUSTED)

print("\n--- CHALLENGE DEGRADATION AND RECOVERY ---")
test_transition("TRUSTED drops to CHALLENGE (0.69)", TrustState.TRUSTED, 0.69, 0, TrustState.CHALLENGE)
test_transition("CHALLENGE stays CHALLENGE at 0.79", TrustState.CHALLENGE, 0.79, 0, TrustState.CHALLENGE)
test_transition("CHALLENGE recovers to OBSERVE at 0.80", TrustState.CHALLENGE, 0.80, 0, TrustState.OBSERVE)
test_transition("CHALLENGE recovers to TRUSTED at 0.90", TrustState.CHALLENGE, 0.90, 0, TrustState.TRUSTED)

print("\n--- CRITICAL HARD RULES (Risk Dominates) ---")
test_transition("TRUSTED with Risk 80 -> LOCKED", TrustState.TRUSTED, 1.0, 80, TrustState.LOCKED)
test_transition("TRUSTED with Risk 60 -> RESTRICTED", TrustState.TRUSTED, 1.0, 60, TrustState.RESTRICTED)
test_transition("TRUSTED with Spoof -> RESTRICTED", TrustState.TRUSTED, 1.0, 0, TrustState.RESTRICTED, "SPOOF_DETECTED")
test_transition("LOCKED with Spoof -> LOCKED", TrustState.LOCKED, 1.0, 0, TrustState.LOCKED, "SPOOF_DETECTED")
test_transition("TRUSTED with Conflict -> CHALLENGE", TrustState.TRUSTED, 1.0, 0, TrustState.CHALLENGE, "CONFLICT")

print("\n--- RECOVERY PATHS FROM RESTRICTED/LOCKED ---")
# The code says: if riskScore < 20 and confidence >= CHALLENGE_EXIT (0.80), state becomes CHALLENGE
test_transition("LOCKED recovers to CHALLENGE (Risk=19, Conf=0.80)", TrustState.LOCKED, 0.80, 19, TrustState.CHALLENGE)
test_transition("RESTRICTED recovers to CHALLENGE (Risk=19, Conf=0.80)", TrustState.RESTRICTED, 0.80, 19, TrustState.CHALLENGE)
test_transition("RESTRICTED fails recovery if Risk=20", TrustState.RESTRICTED, 0.99, 20, TrustState.RESTRICTED)
test_transition("RESTRICTED fails recovery if Conf=0.79", TrustState.RESTRICTED, 0.79, 0, TrustState.RESTRICTED)

print("\n--- EDGE CASE / GAPS IDENTIFICATION ---")
# 1. Dropping confidence doesn't degrade RESTRICTED or LOCKED?
test_transition("RESTRICTED stays RESTRICTED with 0.0 conf", TrustState.RESTRICTED, 0.0, 0, TrustState.RESTRICTED)

# 2. What if risk increases but doesn't hit critical thresholds?
test_transition("TRUSTED with Risk=30 -> OBSERVE", TrustState.TRUSTED, 1.0, 30, TrustState.OBSERVE)
test_transition("TRUSTED with Risk=50 -> CHALLENGE", TrustState.TRUSTED, 1.0, 50, TrustState.CHALLENGE)
test_transition("OBSERVE with Risk=50 -> CHALLENGE", TrustState.OBSERVE, 1.0, 50, TrustState.CHALLENGE)

# 3. Repeated weak evidence (Confidence=0.69)
# TRUSTED -> CHALLENGE -> CHALLENGE -> ...
test_transition("TRUSTED -> CHALLENGE (Conf=0.69)", TrustState.TRUSTED, 0.69, 0, TrustState.CHALLENGE)
test_transition("CHALLENGE -> CHALLENGE (Conf=0.69)", TrustState.CHALLENGE, 0.69, 0, TrustState.CHALLENGE)
# Does it ever drop to RESTRICTED solely on low confidence?
result = evaluate(TrustState.CHALLENGE, 0.10, 0, "ALLOW")
print(f"[{'FAIL' if result != TrustState.RESTRICTED else 'PASS'}] Repeated terrible confidence (0.10) in CHALLENGE goes to: {result.name}")

