# BioShield AI Security Brain Architecture

## 1. Goal and Vision

The goal of the **BioShield AI Security Brain** is to integrate a **controlled local LLM** into the BioShield MFA project to provide advanced security reasoning, contextual anomaly detection, and human-readable explanations of complex authentication events. 

This AI layer serves as an analytical co-pilot and observability engine, reasoning over structured security evidence without ever overriding the deterministic biometric or risk policies.

## 2. Core Principles

- **Local-First & Privacy-Preserving:** The LLM must run locally (e.g., via Ollama). No PII, sensitive biometric vectors, or plaintext credentials will ever be transmitted to external APIs or exposed to the LLM.
- **Fail-Safe Operation:** If the AI layer fails, times out, or hallucinates, the core authentication pipeline must continue to function normally based on deterministic rules.
- **Explainability & Auditability:** AI-generated reasoning is logged as metadata alongside deterministic decisions, primarily to aid administrators in forensic analysis.
- **Zero Direct Biometric/Credential Access:** The AI operates purely on derived metadata, normalized risk scores, and event telemetry.

## 3. Responsibility Boundaries

The system maintains a strict separation of concerns between the deterministic engines and the AI Security Brain.

### AI Layer (What it CAN do)
- **Reasoning:** Correlate multiple authentication events (e.g., sudden IP change + low confidence face match).
- **Anomaly Detection:** Identify subtle behavioral patterns that hardcoded rules might miss.
- **Contextualization:** Generate human-readable explanations for why a specific Trust State transitioned (e.g., from `TRUSTED` to `CHALLENGE`).
- **Recommendation:** Suggest dynamic adjustments to risk policies for admin review.

### Deterministic Engines (What they MUST do)
- **Authentication:** Only the deterministic engines (InsightFace, ECAPA-TDNN) verify identity.
- **Score Calculation:** The Fusion Engine computes the final confidence math.
- **State Enforcement:** The Trust Engine and Policy Engine dictate the active state (`TRUSTED`, `CHALLENGE`, `LOCKED`).

## 4. Deterministic Enforcement Rule

**CRITICAL MANDATE:** Under no circumstances can the AI Security Brain directly approve an authentication request, bypass a biometric challenge, or override a hardcoded policy block. 

The relationship is strictly one-way: 
`Deterministic Pipeline -> Emits Structured Evidence -> AI Brain (Reads & Reasons)`

If the AI Brain identifies a critical anomaly, it may append a "high-risk flag" to the event payload, which the Deterministic Risk Engine evaluates as just another weighted input. The Deterministic Engine always has the final say.

## 5. Proposed Architecture

### 5.1 Components
1. **AI Brain Abstraction Layer:** A Node.js service (`AISecurityBrainService`) that wraps interactions with the local LLM (e.g., Ollama).
2. **Telemetry Sanitizer:** A middleware that strips PII/Biometrics before sending structured JSON evidence to the AI Brain.
3. **Reasoning Agent:** The prompt-driven logic that interprets the evidence and outputs a structured JSON response (Risk Assessment, Explanation, Suggested Action).

### 5.2 Flow
1. **Event Trigger:** A user attempts authentication.
2. **Deterministic Evaluation:** Fusion, Risk, and Trust engines calculate scores.
3. **Data Sanitization:** The security telemetry is sanitized.
4. **AI Analysis (Async):** The sanitized payload is passed to the AI Brain for parallel or post-event analysis.
5. **Output Generation:** The AI Brain generates a structured assessment.
6. **Logging & Enrichment:** The AI's explanation is appended to the audit log for admin review.

## 6. Data Contract (Example)

**Input to AI Brain (Sanitized JSON):**
```json
{
  "event_type": "AUTH_ATTEMPT",
  "timestamp": "2023-10-27T10:00:00Z",
  "fusion_score": 0.75,
  "trust_state": "CHALLENGE",
  "anomalies_detected_by_risk_engine": ["IP_GEOLOCATION_MISMATCH"],
  "biometric_modalities_used": ["FACE", "VOICE"]
}
```

**Output from AI Brain (Structured JSON):**
```json
{
  "ai_risk_assessment": "ELEVATED",
  "reasoning": "The fusion score is acceptable, but the sudden IP geolocation shift combined with a challenge state suggests a potential remote relay attack. Recommend requiring strict liveness verification.",
  "confidence_in_assessment": 0.85
}
```
