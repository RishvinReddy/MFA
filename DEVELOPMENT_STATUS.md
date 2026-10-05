# DEVELOPMENT_STATUS.md
# BioShield MFA — Engineering Status & Defect Inventory

> **Authoritative Technical Ledger based on Code Reconnaissance & Audit**  
> **Source of Truth for Immediate & Long-Term Development**

---

## 1. Completed

1. **Multi-Factor Adaptive Authentication Loop:**
   - Password verification using Argon2id (`argon2id$v=19$m=65536,t=3,p=1`) with transparent bcrypt rehash on login.
   - Account lockout enforcement (5 consecutive failed attempts lock account for 15 minutes).
   - Session lifecycle state machine (`PENDING` -> `CHALLENGE_REQUIRED` -> `FACE_VERIFIED` -> `VOICE_VERIFIED` -> `ACTIVE`).
2. **Deep Facial Biometric Verification:**
   - Python microservice with InsightFace `buffalo_l` extracting 512-dimensional L2-normalized embeddings.
   - Mathematical pose and landmark estimation (yaw, pitch, eye-aspect-ratio, Laplacian sharpness score).
   - Active challenge-response verification (nonce-bound temporal state machine evaluating directional head movement).
3. **Deep Voice Biometric Verification:**
   - SpeechBrain ECAPA-TDNN extracting 192-dimensional acoustic embeddings.
   - Whisper-tiny automatic speech recognition verifying spoken dynamic challenge phrases.
   - Browser Web Audio API pipeline converting microphone chunks to 16-bit PCM WAV.
4. **Multimodal Fusion & Zero-Trust Engine:**
   - Weighted fusion model aggregating human physiological factors against device trust.
   - Exponential time-decay risk engine halving historical risk events every 2 hours.
   - Hysteresis-guarded trust engine (`TRUSTED`, `OBSERVE`, `CHALLENGE`, `RESTRICTED`, `LOCKED`).
5. **Continuous Heartbeat Monitoring:**
   - Client-side 30-second timer capturing low-friction video frames.
   - Backend heartbeat anomaly detection (delayed, stale, or abandoned heartbeats escalate risk).
   - Reactive step-up modal challenge (`StepUpModal.tsx`) when risk thresholds are exceeded.
6. **Cryptographic Core:**
   - AES-256-GCM authenticated template encryption (`v1:gcm:iv:authTag:ciphertext`).
   - Hardened startup boot checks validating 64-character hex master keys.
7. **Enterprise Security Console:**
   - Interactive console (`SecurityConsole.tsx`) presenting system telemetry, active sessions, and audit logs.

---

## 2. Partially Completed

1. **WebAuthn / Passkeys (`webauthn.controller.ts` & `frontend/services/api.ts`):**
   - SimpleWebAuthn registration and authentication handlers implemented on backend.
   - Frontend lacks a dedicated UI ceremony panel in `frontend/components/auth/`.
   - Origin is hardcoded to `http://localhost:5173` instead of the Vite dev port `3000`.
2. **Administrative Management UI:**
   - Admin views (`src/admin/Users.tsx`, `Sessions.tsx`, `AuditLogs.tsx`, `SystemHealth.tsx`) and `AdminDashboard.tsx` are fully built.
   - These components are unlinked from the master `Routes` in `frontend/App.tsx`.
3. **AI Security Assistant Chat:**
   - Frontend chat drawer exists in `App.tsx` and `SecurityConsole.tsx`.
   - Uses hardcoded heuristic responses or mock fallback if `GEMINI_API_KEY` is unset.
4. **Pre-Registration Email Verification:**
   - Backend controller and Redis caching implemented.
   - Frontend and backend route paths do not match.

---

## 3. Broken / Defective

1. **Email OTP Verification Crash (`/api/mfa/verify-email`):**
   - In `backend/src/controllers/mfa.controller.ts` (line 135), `verifyEmail` imports `../utils/kms` which uses `AES-256-CBC` and expects `process.env.KMS_SECRET`.
   - However, `auth.service.ts` encrypts `mfaSecretEnc` with `CryptoService.encryptTemplate` (AES-256-GCM using `BIOMETRIC_KEY`).
   - Result: Calling this endpoint crashes or throws `KMS_SECRET is not defined`.
2. **Forensic Alert Route Missing Multer (`/api/forensics/analyze-alert`):**
   - `forensic.controller.ts` expects `req.file.buffer`.
   - `forensic.routes.ts` does not attach `multer` (`upload.single(...)`), causing `req.file` to always be undefined.
3. **Pre-Registration Route Path Mismatch:**
   - Frontend `frontend/services/api.ts` calls `POST /api/mfa/send-pre-reg-otp` and `POST /api/mfa/verify-pre-reg-otp`.
   - Backend `mfa.routes.ts` defines `POST /api/mfa/email/send-pre-reg` and `POST /api/mfa/email/verify-pre-reg`.
4. **Token Refresh Route Mismatch:**
   - Frontend `frontend/services/api.ts` calls `POST /api/auth/refresh-token`.
   - Backend `auth.routes.ts` defines `POST /api/auth/refresh` (which returns HTTP 501 Not Implemented).
5. **Hardcoded Test Bypasses Left in Production Code:**
   - `calibration.service.ts`: `calibrateVoice` hardcodes confidence to `1.0` for all scores $\ge 0.40$ with comment `TEMP FIX for Phase 9 Repeatability Experiment`.
   - `policy.service.ts`: Spoofing rejection is bypassed with comment `TEMP FIX for Phase 9 Repeatability Experiment: Ignore spoofing and just step up to Voice`.
   - `biometric.controller.ts`: Biometric attempt lockout is commented out (`lines 149-157`).

---

## 4. High Priority Tasks

- [ ] **Fix Cryptographic Mismatch in `mfa.controller.ts`:**
  - Replace `../utils/kms` import with `CryptoService.decryptTemplate()` for `user.mfaSecretEnc`.
- [ ] **Fix Pre-Registration & Token Refresh API Contract Mismatches:**
  - Standardize endpoints between `frontend/services/api.ts` and backend route definitions.
  - Implement full refresh token exchange in `auth.controller.ts:refreshToken`.
- [ ] **Attach Multer Middleware to Forensic Route:**
  - Add `upload.single('file')` to `forensic.routes.ts`.
- [ ] **Remove Hardcoded Repeatability Test Bypasses:**
  - Re-enable biometric lockout check in `biometric.controller.ts`.
  - Restore strict spoof rejection (`LOCK` / reject) in `policy.service.ts`.
  - Remove hardcoded `return 1.0` in `calibration.service.ts`.
- [ ] **Clean Up Environment Secrets:**
  - Remove live EmailJS credentials and hardcoded `dev_api_key_override_me` from code; use secure `.env` placeholders.
  - Remove hardcoded biometric API key in `frontend/services/faceVerificationService.ts`.

---

## 5. Medium Priority Tasks

- [ ] **Wire Admin Dashboard into Main Router:**
  - Add `/admin/*` route in `frontend/App.tsx` guarded by `Role.ADMIN` rendering `AdminDashboard.tsx`.
- [ ] **Fix WebAuthn Origin Configuration:**
  - Dynamically read `ORIGIN` from environment variable (`process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000'`) instead of hardcoding `http://localhost:5173`.
- [ ] **Consolidate Identity Storage:**
  - Resolve identity drift between client `localStorage` (`bioshield_local_profiles_v2`) and SQLite `User` table.
- [ ] **Replace Synchronous Shell Command in System Diagnostics:**
  - Replace blocking `execSync` PowerShell command in `systemDiagnostics.service.ts` with asynchronous execution or safe Node.js API checks.

---

## 6. Low Priority Tasks

- [ ] **Prune Monolithic Component File Sizes:**
  - Decompose `FaceEnrollmentCeremony.tsx` (1,363 lines) and `FaceScanner.tsx` (1,051 lines) into dedicated hooks for camera management, canvas drawing, and pose analysis.
- [ ] **Archive Unused Monorepo Assets:**
  - Move root-level `services/` (`api.ts`, `geminiService.ts`, `secureBackend.ts`) and `temp_repo/` to an `archive/` folder.
- [ ] **Implement Client-Side Test Framework:**
  - Add Vitest / React Testing Library to `frontend/package.json` for component and flow regression testing.

---

## 7. Future Improvements

- [ ] Hardware TPM 2.0 / Windows DPAPI integration for sealing biometric encryption keys.
- [ ] True passive behavioral keystroke dynamic modeling using recurrent or transformer-based timing inference.
- [ ] Distributed Redis pub/sub cache invalidation for multi-instance backend clusters.
- [ ] FIDO2 Passkeys user-journey integration with browser autofill.


---

## 8. Calibration Freeze — ACTIVE

> **Effective: Phase 3I.4.1 completion**
> **Authority: Research finding — voice calibration dataset insufficient**

The following values in `calibration.service.ts` are **FROZEN** and must NOT be changed until Phase 3I.6 (Joint Face + Voice Calibration Validation) is complete:

| Parameter | Current value | Proposed value | Status |
|---|---|---|---|
| Face EER anchor (`calibrateFace`) | **0.50** | 0.40 | BLOCKED — pending voice joint review |
| Voice EER anchor (`calibrateVoice`) | **0.40** | TBD | BLOCKED — dataset insufficient |
| Fusion weights | current | — | FROZEN |
| Risk thresholds | current | — | FROZEN |
| Trust transitions | current | — | FROZEN |
| Policy precedence | current | — | FROZEN |

**Reason:** Phase 3I.4.1 found the voice calibration dataset (5 speakers, 75 genuine pairs) is too small to determine a defensible operating point. The current voice anchor (0.40) has empirical FAR=2.19%, CI [0.83%, 3.89%]. Face and voice enter the same Fusion engine; both must be jointly defensible before either changes.

---

## 9. Phase 3I Audit — Status Ledger

| Phase | Description | Status |
|---|---|---|
| 3I.1 | Deterministic pipeline baseline audit | COMPLETE |
| 3I.2 | End-to-end 20-scenario security harness (I-01 to I-20) | COMPLETE |
| 3I.3 | Calibration curve implementation (piecewise linear) | COMPLETE |
| 3I.4 | Preliminary biometric audit (face: 200 images, first-N) | SUPERSEDED by 3I.4.1 |
| 3I.4.1 | Robust biometric audit — stratified + bootstrap CI | PROCEED WITH FINDINGS |
| 3I.5 | Production-scale voice calibration (LibriSpeech test-clean) | NEXT |
| 3I.6 | Joint Face + Voice calibration validation | BLOCKED on 3I.5 |

Key findings from 3I.4.1:
- Face (InsightFace buffalo_l): AUC=0.9988, EER=0.41% CI[0.09%, 0.82%], FRR=12% at current 0.50 anchor
- Voice (ECAPA-TDNN, 5-speaker dataset): AUC=0.9952, EER=3.49% CI[1.94%, 5.28%], FAR=2.19% at current 0.40 anchor
- Phase 3I.4 perfect AUC/EER on face was a first-N sampling artifact, corrected by stratified sampling

---

## 10. Immediate Next: Phase 3I.5

**Goal:** Establish empirical voice calibration behavior across a population large enough to support a production threshold decision.

**Dataset:** LibriSpeech test-clean (~40 speakers, ~2,600 utterances, ~346 MB, freely available)

**Script:** biometric-service/calibrate_ecapa_librispeech.py

**Methodology improvements over 3I.4.1:**
1. Larger, recognized corpus (40 independent speakers vs. 5)
2. Speaker-disjoint evaluation
3. Cluster bootstrap by speaker (resample speakers, then derive pairs) — models within-speaker correlation
4. Evaluate the actual calibrateVoice() transformation output, not just raw threshold
5. Report CI for EER, AUC, and FAR/FRR at all candidate anchors (0.30 to 0.60)

**Decision gate:** Phase 3I.5 authorizes Phase 3I.6 only if:
- >= 30 speakers with >= 3 recordings each successfully embedded
- Bootstrap CI for FAR at candidate anchor has defensible upper bound
- Cluster and pair bootstrap results are consistent
