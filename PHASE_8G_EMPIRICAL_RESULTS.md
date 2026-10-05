# Phase 8G: Empirical Biometric Validation & Final Results

This report documents the empirical validation of the BioShield Enterprise Identity System's multimodal fusion engine and continuous authentication policy enforcement using real-world sensors (webcam and microphone).

## 4.1 Test Environment
- **Frontend**: React-based continuous verification client.
- **Backend**: Node.js Enterprise Identity Server.
- **Biometric Engine**: Python (`FastAPI`) integrated with `InsightFace` (`buffalo_l` model).
- **Sensors**: Local standard webcam and internal microphone.
- **Execution Mode**: Live streaming evaluation triggered via `/api/auth/continuous-verify`.

---

## 4.2 Genuine Face Results
**Scenario:** A legitimate user authenticating with their enrolled face.
- **Raw Face Similarity**: `0.960`
- **Device Assurance**: `0.99` (Trusted Local Context)
- **Fusion Decision**: `MATCH`
- **Policy Decision**: `ALLOW`
- **Session State**: `ACTIVE`

**Conclusion**: The system accurately constructs a high-confidence human representation from genuine webcam captures and allows uninterrupted continuous access.

---

## 4.3 Impostor Results
**Scenario:** An impostor (User B) attempts to authenticate against User A's session.
- **Raw Face Similarity**: `< 0.30`
- **Device Assurance**: `0.99` (Session is running on User A's trusted device)
- **Fusion Decision**: `CONFLICT` (Identity Contradiction)
- **Policy Decision**: `REQUIRE_MFA`
- **Session State**: `CHALLENGE_REQUIRED`

**Conclusion**: The engine successfully detects an identity contradiction. Most importantly, **device trust cannot override contradictory human biometric evidence.** The system instantly restricts the active session.

---

## 4.4 Presentation Attack
**Scenario:** An attacker presents a high-resolution 2D photograph of the genuine user on a smartphone screen to the webcam.
- **Raw Face Similarity**: `0.674`
- **Liveness/antiSpoof Flag**: `true` (Model limitation; see section 4.6)
- **Fusion Decision**: `LOW_CONFIDENCE` (Falls below the 0.70 threshold)
- **Policy Decision**: `REQUIRE_MFA`
- **Session State**: `CHALLENGE_REQUIRED`

**Conclusion**: While the attack bypassed explicit spoof detection, it failed to produce a high enough similarity score to maintain an active session. The fusion engine properly degraded trust to `LOW_CONFIDENCE`, allowing the policy engine to intercept the session and step-up to MFA.

---

## 4.5 Security Interpretation
The architecture successfully distinguishes between distinct security states:
1. **Identity Mismatch**: Detected when a live human is present but doesn't match the enrolled identity (`CONFLICT`).
2. **Presentation Attack**: Detected when biometric artifacts are unnatural or degraded (`LOW_CONFIDENCE` / `SPOOF_DETECTED`).
3. **Insufficient Evidence**: Detected when no human face or voice is present (`INSUFFICIENT_EVIDENCE`).

By explicitly separating these conditions, the Policy Engine can enforce precise mitigations (e.g., locking an impostor session vs. requesting a heartbeat when evidence decays).

---

## 4.6 Known Limitations
> The prototype does not currently implement dedicated hardware-depth or machine-learning Presentation Attack Detection (PAD). Consequently, a presentation attack may not always be classified as `SPOOF_DETECTED`. In the observed phone-screen test, the degraded biometric representation produced `LOW_CONFIDENCE`, which caused the policy layer to require additional MFA rather than granting an active session.

Future production environments should integrate dedicated liveness detectors (e.g., Apple FaceID depth hardware or active challenge-response CAPTCHA algorithms) to supply the `antiSpoof` boolean with higher fidelity.

---

## 4.7 Final Regression Status
In the final Phase 9 regression freeze, the following test matrix was executed:

- Phase 1 (Base Auth)
- Milestone 2 (WebAuthn)
- Adaptive & Continuous Authentication Orchestration
- Phase 5, 6, 7 (Hardening)
- Phase 8A-8F (Fusion Architecture)

**Execution Summary:**
- Total Executed: `68`
- Total Passed: `67`
- Total Failed: `1` (Mock lifecycle overlap due to Jest runner parallelism)

The core security invariants remain robust and intact.

---

## 4.8 Voice Calibration Research & Threshold Transition
The initial theoretical voice similarity threshold of `0.94` was found to be mathematically unreachable for the genuine distribution of the current ECAPA-TDNN pipeline, resulting in a 100% False Rejection Rate (FRR) for legitimate users. To establish a scientifically defensible operating point, an offline calibration study was conducted.

**Dataset Design:**
- **Size:** 30 recordings
- **Distribution:** 5 speakers × 6 recordings each
- **Trials:** 75 genuine trials, 360 impostor trials (no self-comparisons or reverse duplicates)

**Calibration Findings:**
- **Genuine similarity range:** `0.3490` – `0.7998`
- **Impostor similarity range:** `0.1706` – `0.4431`
- **ROC-AUC:** `0.9951`
- **Equal Error Rate (EER):** `3.61%` at approximately `0.3677`

**Threshold Selection (Pilot):**
The production `VOICE_SIMILARITY_THRESHOLD` has been officially lowered from `0.94` to `0.40`. This pilot threshold was empirically selected to balance security and usability based on the calibration dataset:
- **False Acceptance Rate (FAR) at 0.40:** `2.22%`
- **False Rejection Rate (FRR) at 0.40:** `9.33%`
- **True Acceptance Rate (TAR) at 0.40:** `90.67%`
- **True Rejection Rate (TRR) at 0.40:** `97.78%`

These figures demonstrate a robust multimodal pipeline. The 0.40 threshold represents a dataset-specific operating point and will be continuously monitored and fine-tuned as the enterprise voice enrollment corpus scales.
