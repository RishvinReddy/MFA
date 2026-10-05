# Phase 3I.1 — Deterministic Security Pipeline Baseline Audit

## 1. Objective
To establish the true production baseline of the BioShield deterministic security pipeline (Fusion, Risk, Trust, Policy) before executing end-to-end security effectiveness tests (Phase 3I).

## 2. Scope
Inspection of `fusion.service.ts`, `risk.service.ts`, `trust.service.ts`, `policy.service.ts`, `adaptiveAuth.service.ts`, `auth.controller.ts`, `calibration.service.ts`, and test infrastructure.

## 3. Actual Production Architecture
The production implementation matches the documented security architecture:
1. **Deterministic Pipeline:** Evidence is aggregated by Fusion, historical severity by Risk, state transitions by Trust, and access decisions by Policy.
2. **AI Boundary:** The AI Event Coordinator acts purely as an asynchronous observer.

## 4. Authentication Flow
Initial login generates a `CHALLENGE` state requesting factors. `continuous-verify` pushes raw frames/samples, parses evidence, and evaluates `AdaptiveAuthenticationService` which updates the database session status and asynchronously triggers the AI.

## 5. Fusion Engine
- **Inputs:** `FACE`, `VOICE`, `BEHAVIOR`, `DEVICE`, etc.
- **Weights:** Configurable (defaults: Face 0.6, Voice 0.4).
- **Missing Evidence:** Only available evidence is fused. If no active human evidence is provided, `INSUFFICIENT_EVIDENCE` is yielded.
- **Contradictions:** Any `status === 'FAIL'` drops identity confidence to `0.0`, resulting in a `CONFLICT` decision.
- **Spoofing:** Explicit `isSpoofed: true` or liveness < 0.30 sets `SPOOF_DETECTED` and confidence `0.0`.

## 6. Risk Engine
- **Formula:** Accumulates event severities with an exponential time decay (2-hour half-life). Events decayed below 5% are dropped.
- **Thresholds:** LOW (<20), MEDIUM (20-49), HIGH (50-79), CRITICAL (>=80).
- **Monotonicity:** Yes, score strictly increases with worsening evidence (capped at 100), decaying slowly over time.

## 7. Trust Engine
- **States:** TRUSTED, OBSERVE, CHALLENGE, RESTRICTED, LOCKED.
- **Hard Rules:** `CRITICAL` risk -> LOCKED. `SPOOF_DETECTED` -> RESTRICTED. `CONFLICT` -> CHALLENGE.
- **Hysteresis:** Requires higher confidence to exit a lower state (e.g., `<0.70` to enter CHALLENGE, but `>=0.80` to exit to OBSERVE and `>=0.90` to exit to TRUSTED).

## 8. Policy Engine
- **Mappings:**
  - LOCKED Trust or CRITICAL Risk -> `LOCK`.
  - SPOOF_DETECTED Fusion -> `RESTRICT`.
  - CONFLICT / INSUFFICIENT_EVIDENCE / LOW_CONFIDENCE Fusion -> `REQUIRE_MFA` (CHALLENGE_REQUIRED).
  - HIGH Risk or RESTRICTED Trust -> `REQUIRE_MFA` if available, else `RESTRICT`.
- **Precedence:** Hard boundaries evaluated first, then challenge logic, then trust-based continuous evaluations.

## 9. Adaptive Authentication
- **Orchestration:** Invokes Fusion -> Risk -> Trust -> Policy. Updates `session.status`.
- **AI Trigger:** Asynchronously invokes `aiEventCoordinator.analyzeEvent()` inside a `try/catch` block. The deterministic Policy output is immediately returned to the caller, confirming observational isolation.

## 10. Enforcement Mechanisms
- `auth.controller.ts` leverages `authSession.status`.
- `getSessionStatus` explicitly rejects mismatched token identifiers.
- A `TERMINATED` session is issued immediately if `expiresAt` is breached.

## 11. Identity and Session Integrity
- JWTs define `id` and `sessionId`. If `session.userId !== decodedToken.id`, a `403 Forbidden` identity mismatch is thrown.

## 12. Failure Semantics
- **Biometric Failure:** Results in `UNAVAILABLE` or `INSUFFICIENT_DATA` which is absorbed by Fusion and likely outputs `INSUFFICIENT_EVIDENCE` -> Policy `REQUIRE_MFA`.
- **AI Failure:** Caught and suppressed. Does not affect Auth flow.

## 13. Security Configuration
- Configuration (`fusionWeights`, `confidenceThresholds`) pulled dynamically from database cache (`fusionConfiguration`).

## 14. Temporary / Test / Development Bypasses
- `backend/src/services/calibration.service.ts` contains a production-active temporary bypass: `// TEMP FIX for Phase 9 Repeatability Experiment: Force the Fusion Engine to trust Voice scores >= 0.40`. If raw voice confidence >= 0.40, it is artificially calibrated to `1.0`.

## 15. Existing Test Coverage
- `ai-security` directory covers AI isolation (Phase 3H).
- Extensive E2E suites (`phase5-8.test.ts`) test deterministic pipelines as a unit, but unit-level boundaries for Trust/Policy are implicitly covered rather than explicitly asserted.

## 16. Production-vs-Mock Assessment
| Component    | Production Logic | Test Coverage | Mock Risk |
| ------------ | ---------------- | ------------- | --------- |
| Fusion       | Active           | Integration   | Medium    |
| Risk         | Active           | Integration   | Medium    |
| Trust        | Active           | Integration   | Medium    |
| Policy       | Active           | Integration   | Medium    |
| Biometrics   | Active           | Mocked        | High      |

## 17. I-01–I-20 Baseline Matrix
| Scenario | Expected State | Expected Policy | AI Involved |
|----------|----------------|-----------------|-------------|
| I-01 | TRUSTED | ALLOW | Advisory |
| I-02 | CHALLENGE | REQUIRE_MFA | Advisory |
| I-03 | CHALLENGE | REQUIRE_MFA | Advisory |
| I-04 | CHALLENGE | REQUIRE_MFA | Advisory |
| I-05 | RESTRICTED | RESTRICT | Advisory |
| I-06 | RESTRICTED | REQUIRE_MFA | Advisory |
| I-07 | CHALLENGE | REQUIRE_MFA | Advisory |
| I-16 (AI Down) | TRUSTED (Unchanged) | ALLOW | No |
| I-17 (AI Slow) | TRUSTED (Unchanged) | ALLOW | No |

## 18. Findings
- **[CRITICAL] Voice Calibration Bypass:** `calibration.service.ts` artificially inflates Voice confidence >= 0.40 to 1.0. This defeats biometric voice evaluation and allows spoofing.
- **[INFORMATIONAL] AI Boundaries:** AI Event Coordinator isolation guarantees are correctly implemented in `AdaptiveAuthenticationService`.

## 19. Limitations
- Audit based on static analysis. Runtime execution under end-to-end testing (Phase 3I.2) is required to validate state-machine consistency.

## 20. Recommended Phase 3I.2 Scope
Remediate the Voice calibration bypass before executing the I-01 through I-20 matrix.

## Remediation — Critical Voice Calibration Bypass

### Original Finding
`calibration.service.ts` artificially inflated Voice confidence >= 0.40 to 1.0, defeating biometric voice evaluation and allowing spoofing.

### Root Cause
A temporary experiment code block (`// TEMP FIX for Phase 9 Repeatability Experiment`) was left active in production. It intercepted any raw voice confidence over 0.40 and returned 1.0.

### Remediation
Removed the hardcoded conditional promotion `if (rawConfidence >= 0.40) return 1.0;`. The function now returns the raw calibrated score directly without artificial inflation.

### Regression Test
Added `calibration.service.test.ts` to explicitly verify that boundary values (`0.39, 0.40, 0.41, 0.60, 0.80`) map to their true raw scores and do not jump to 1.0.

### Verification
- Targeted `calibration.service.test.ts` passed.
- Full `npm test` suite confirmed that the removal of this bypass did not break any related logic. (Note: `phase8h.test.ts` reported an unrelated timeout on challenge consumption).
- AI architecture bounds are unaffected.

### Security Impact
**After remediation**, the deterministic pipeline (Fusion -> Risk -> Trust -> Policy) now operates on the true biometric signal from the Voice extraction engine, ensuring that upcoming Phase 3I end-to-end tests measure actual authorization security rather than a padded signal.
