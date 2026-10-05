# FILE_MAP.md
# BioShield MFA — Master File Inventory & Dependency Map

> **Legend for Status:**
> - `ACTIVE`: Core, working production code.
> - `PARTIAL`: Partially implemented or requires environment/route alignment.
> - `DEFECTIVE`: Contains known bugs or broken contracts.
> - `MOCK`: Conceptual simulation/demo code.
> - `OBSOLETE`: Legacy or unreferenced file that can be archived.

---

## 1. Backend Core & Configuration

| File | Purpose | Depends On | Used By | Status |
|---|---|---|---|---|
| `backend/src/index.ts` | Express application bootstrap, middleware attachment, background worker | `express`, `helmet`, `cors`, `routes/`, `CryptoService` | Process launcher (`start-all.bat`, `npm run dev`) | `ACTIVE` |
| `backend/src/middleware.ts` | Rate limiters, session validators, authorization guards, error handler | `ioredis`, `rate-limit-redis`, `prisma`, `authUtils` | `backend/src/routes/` | `ACTIVE` |
| `backend/src/prisma.ts` | Reusable Prisma Client singleton instance | `@prisma/client` | Controllers, services | `ACTIVE` |
| `backend/prisma/schema.prisma` | Relational database schema for SQLite | Prisma generator | Prisma CLI, database engine | `ACTIVE` |
| `backend/prisma/seed.ts` | Default seed script provisioning admin, user, and analyst accounts | `@prisma/client`, `bcrypt` | `npx prisma db seed`, `npm run init-db` | `ACTIVE` |
| `backend/src/authUtils.ts` | JWT access & refresh token signing, token verification, SHA-256 helpers | `jsonwebtoken`, `crypto`, `bcrypt` | Controllers, middleware | `ACTIVE` |
| `backend/src/kms.ts` | Master key envelope encryption (AES-256-GCM) | `crypto`, `dotenv` | Standalone utility | `PARTIAL` |
| `backend/src/behavioral.ts` | Bot detection heuristics for typing and mouse movements | None | None (Unused in active login) | `OBSOLETE` |
| `backend/src/biometrics.ts` | Legacy homomorphic encryption (SHE-256) and deepfake simulation | `crypto`, `buffer` | `forensic.controller.ts` | `MOCK` |
| `backend/src/utils/kms.ts` | Legacy AES-256-CBC encryption using `KMS_SECRET` | `crypto` | `mfa.controller.ts` | `DEFECTIVE` |
| `backend/src/utils/logger.ts` | Standardized application logging wrapper | Native `console` | All backend services & controllers | `ACTIVE` |
| `backend/src/utils/similarity.ts` | Standalone vector cosine similarity calculator | Native math | Utilities | `ACTIVE` |

---

## 2. Backend Routes & Controllers

| File | Purpose | Depends On | Used By | Status |
|---|---|---|---|---|
| `backend/src/routes/index.ts` | Top-level route aggregation and system-boot endpoint | `auth.routes`, `biometric.routes`, `mfa.routes`, `admin.routes`, etc. | `backend/src/index.ts` | `ACTIVE` |
| `backend/src/routes/auth.routes.ts` | Authentication endpoints (login, register, continuous-verify, challenge) | `auth.controller.ts`, `middleware.ts`, `multer` | `routes/index.ts` | `ACTIVE` |
| `backend/src/controllers/auth.controller.ts` | Request handlers for login, continuous heartbeat, challenge generation | `AuthService`, `ChallengeService`, `BiometricService`, `AdaptiveAuthenticationService` | `auth.routes.ts` | `ACTIVE` |
| `backend/src/routes/biometric.routes.ts` | Biometric registration, verification, and revocation endpoints | `biometric.controller.ts`, `middleware.ts`, `multer` | `routes/index.ts` | `ACTIVE` |
| `backend/src/controllers/biometric.controller.ts` | Face sequence & voice verification, lockout enforcement | `BiometricService`, `ChallengeService`, `CryptoService`, `AdaptiveAuthenticationService` | `biometric.routes.ts` | `ACTIVE` |
| `backend/src/routes/mfa.routes.ts` | TOTP setup/verify, email OTP dispatch & verify | `mfa.controller.ts`, `middleware.ts` | `routes/index.ts` | `ACTIVE` |
| `backend/src/controllers/mfa.controller.ts` | Speakeasy TOTP and EmailJS OTP verification logic | `speakeasy`, `qrcode`, `cacheService`, `axios` | `mfa.routes.ts` | `PARTIAL` |
| `backend/src/routes/admin.routes.ts` | Administration routes (users, sessions, health, audits) | `admin.controller.ts`, `middleware.ts` | `routes/index.ts` | `ACTIVE` |
| `backend/src/controllers/admin.controller.ts` | Handlers for admin overview, user provisioning, session kill | `prisma`, `CryptoService`, `audit.service` | `admin.routes.ts` | `ACTIVE` |
| `backend/src/routes/webauthn.routes.ts` | WebAuthn registration and authentication options/verification | `webauthn.controller.ts`, `middleware.ts` | `routes/index.ts` | `PARTIAL` |
| `backend/src/controllers/webauthn.controller.ts` | SimpleWebAuthn server ceremony handlers | `@simplewebauthn/server`, `cacheService`, `prisma` | `webauthn.routes.ts` | `DEFECTIVE` |
| `backend/src/routes/vault.routes.ts` | Secure document decryption route | `vault.controller.ts`, `middleware.ts` | `routes/index.ts` | `ACTIVE` |
| `backend/src/controllers/vault.controller.ts` | Vault document decryption simulation | `audit.service` | `vault.routes.ts` | `MOCK` |
| `backend/src/routes/forensic.routes.ts` | Forensic deepfake sample analysis route | `forensic.controller.ts`, `middleware.ts` | `routes/index.ts` | `DEFECTIVE` |
| `backend/src/controllers/forensic.controller.ts` | Analyzes uploaded samples for deepfake signatures | `biometrics.ts`, `audit.service` | `forensic.routes.ts` | `DEFECTIVE` |

---

## 3. Backend Services Layer

| File | Purpose | Depends On | Used By | Status |
|---|---|---|---|---|
| `backend/src/services/adaptiveAuth.service.ts` | Central orchestration engine linking Fusion, Risk, Trust, and Policy | `FusionEngineService`, `RiskEngineService`, `TrustEngineService`, `PolicyEngineService` | `auth.controller.ts`, `biometric.controller.ts`, `middleware.ts` | `ACTIVE` |
| `backend/src/services/fusion.service.ts` | Weighted multimodal evidence fusion with quality and freshness decay | `ConfigService`, `EvidenceCalibrator`, `logger` | `adaptiveAuth.service.ts` | `ACTIVE` |
| `backend/src/services/risk.service.ts` | Exponential time-decay risk assessment engine | Native math | `adaptiveAuth.service.ts` | `ACTIVE` |
| `backend/src/services/trust.service.ts` | Hysteresis-guarded trust finite state machine | `prisma`, `logger` | `adaptiveAuth.service.ts` | `ACTIVE` |
| `backend/src/services/policy.service.ts` | Zero-Trust action dispatcher (`ALLOW`, `REQUIRE_MFA`, `RESTRICT`, `LOCK`) | `logger` | `adaptiveAuth.service.ts` | `ACTIVE` |
| `backend/src/services/biometric.service.ts` | Client for Python microservice with retry backoff | `axios`, `form-data`, `fs`, `logger` | Controllers | `ACTIVE` |
| `backend/src/services/challenge.service.ts` | Nonce and challenge sequence generation/verification | `prisma`, `crypto` | Controllers | `ACTIVE` |
| `backend/src/services/crypto.service.ts` | Argon2id password hashing & AES-256-GCM template encryption | `argon2`, `bcrypt`, `crypto` | Controllers, services | `ACTIVE` |
| `backend/src/services/cache.service.ts` | Redis interface for atomic OTP checking and rate limiting | `ioredis`, `logger` | Controllers, middleware | `ACTIVE` |
| `backend/src/services/calibration.service.ts` | Evidence score calibration and normalization | None | `fusion.service.ts` | `ACTIVE` |
| `backend/src/services/config.service.ts` | Cached access to database-backed fusion parameters | `prisma` | `fusion.service.ts` | `ACTIVE` |
| `backend/src/services/systemDiagnostics.service.ts` | Hardware security telemetry (UEFI Secure Boot, TPM, OS specs) | `os`, `child_process`, `crypto` | `routes/index.ts` | `ACTIVE` |
| `backend/src/services/audit.service.ts` | Audit log recorder | `prisma`, `logger` | Controllers, services | `ACTIVE` |

---

## 4. Biometric Python Microservice

| File | Purpose | Depends On | Used By | Status |
|---|---|---|---|---|
| `biometric-service/main.py` | FastAPI application exposing face, sequence, and voice endpoints | `fastapi`, `uvicorn`, `insightface`, `speechbrain`, `transformers` | Node backend, browser client | `ACTIVE` |
| `biometric-service/face_processor.py` | InsightFace `buffalo_l` wrapper, landmark extraction, blur scoring | `cv2`, `numpy`, `insightface` | `main.py` | `ACTIVE` |
| `biometric-service/calibrate_ecapa.py` | Calculates EER and threshold for ECAPA-TDNN using WAV dataset | `speechbrain`, `scipy`, `sklearn` | Standalone calibration utility | `ACTIVE` |
| `biometric-service/audit_faces.py` | Batch inspection utility to audit facial photos for face count | `cv2`, `insightface` | Standalone maintenance | `ACTIVE` |

---

## 5. Frontend Application & Routing

| File | Purpose | Depends On | Used By | Status |
|---|---|---|---|---|
| `frontend/index.tsx` | React 19 bootstrap mount | `react`, `react-dom`, `App.tsx` | `index.html` | `ACTIVE` |
| `frontend/App.tsx` | Master application router, navigation guards, continuous heartbeat monitor | `react-router-dom`, `continuousAuthService`, `authFlowController`, components | `index.tsx` | `ACTIVE` |
| `frontend/types.ts` | Central TypeScript interfaces and data model definitions | None | Entire frontend | `ACTIVE` |
| `frontend/vite.config.ts` | Vite configuration with proxying and `@` alias setup | `vite`, `@vitejs/plugin-react` | Vite dev/build system | `ACTIVE` |

---

## 6. Frontend Services & APIs

| File | Purpose | Depends On | Used By | Status |
|---|---|---|---|---|
| `frontend/services/api.ts` | Comprehensive HTTP API client for backend communication | `fetch`, `@simplewebauthn/browser` | Components, services | `PARTIAL` |
| `frontend/services/authFlowController.ts` | Preserves intent across multi-step verification ceremonies | `sessionStorage` | Components, `App.tsx` | `ACTIVE` |
| `frontend/services/authFlowService.ts` | Tracks step progression across modal login stages | `sessionStorage` | `App.tsx`, `BehavioralLogin.tsx` | `ACTIVE` |
| `frontend/services/continuousAuthService.ts` | 30s background timer sending webcam frames to backend | `navigator.mediaDevices`, `fetch` | `App.tsx` | `ACTIVE` |
| `frontend/services/faceVerificationService.ts` | Frame capture & direct Python engine communication for coaching | `fetch`, `biometricVault` | `FaceScanner.tsx`, `FaceEnrollmentCeremony.tsx` | `ACTIVE` |
| `frontend/services/voiceVerificationService.ts` | Web Audio PCM conversion & backend voice verify client | `AudioContext`, `api` | `VoiceScanner.tsx`, `VoiceEnrollmentCeremony.tsx` | `ACTIVE` |
| `frontend/services/localProfileService.ts` | Local profile persistence in `localStorage` | `localStorage` | Profile components, `BehavioralLogin.tsx` | `ACTIVE` |
| `frontend/services/biometricVault.ts` | Client-side tracking of enrolled biometric modalities | `localStorage` | Scanners, ceremonies | `ACTIVE` |
| `frontend/services/stepUpService.ts` | Observable event bus triggering step-up authentication modal | Event emitter pattern | `continuousAuthService.ts`, `App.tsx` | `ACTIVE` |
| `frontend/services/adminApi.ts` | Client API for administrative user provisioning & status | `fetch` | Admin components, `AddProfile.tsx` | `ACTIVE` |
| `frontend/services/geminiService.ts` | Chat interface calling Google Gemini AI security assistant | `@google/genai` | `App.tsx` AI drawer | `PARTIAL` |

---

## 7. Frontend UI Components

| File | Purpose | Depends On | Used By | Status |
|---|---|---|---|---|
| `frontend/components/BehavioralLogin.tsx` | Root login interface with profile selection & credential forms | `CredentialsLoginForm`, `localProfileService` | `App.tsx` (`/`) | `ACTIVE` |
| `frontend/components/FaceScanner.tsx` | Video camera feed, active pose guidance, sequence verification | `faceVerificationService`, `api` | `FaceModalityPanel.tsx` | `ACTIVE` |
| `frontend/components/VoiceScanner.tsx` | Microphone recorder, challenge phrase display, audio capture | `voiceVerificationService` | `VoiceModalityPanel.tsx` | `ACTIVE` |
| `frontend/components/FaceEnrollmentCeremony.tsx` | 5-step interactive face enrollment wizard | `faceVerificationService`, `localProfileService` | `AddProfile.tsx` | `ACTIVE` |
| `frontend/components/VoiceEnrollmentCeremony.tsx` | 3-sample voice enrollment wizard | `voiceVerificationService`, `localProfileService` | `AddProfile.tsx` | `ACTIVE` |
| `frontend/components/StepUpModal.tsx` | Modal dialog forcing biometric step-up when risk elevated | `FaceModalityPanel`, `VoiceModalityPanel` | `App.tsx` | `ACTIVE` |
| `frontend/components/SystemBoot.tsx` | Startup hardware attestation splash screen | `api` (`/api/system-boot`) | `App.tsx` | `ACTIVE` |
| `frontend/components/auth/AuthContainer.tsx` | Uniform wrapper with step indicators for modality ceremonies | Lucide icons | `App.tsx` | `ACTIVE` |
| `frontend/components/auth/FaceModalityPanel.tsx` | Face verification modality panel wrapper | `FaceScanner.tsx` | `App.tsx` (`/verify/face`) | `ACTIVE` |
| `frontend/components/auth/VoiceModalityPanel.tsx` | Voice verification modality panel wrapper | `VoiceScanner.tsx` | `App.tsx` (`/verify/voice`) | `ACTIVE` |
| `frontend/components/auth/MfaModalityPanel.tsx` | TOTP input & QR enrollment panel | `api` | `App.tsx` (`/verify/mfa`) | `ACTIVE` |
| `frontend/components/console/SecurityConsole.tsx` | Master Zero-Trust administrative and security console | Sub-views (`OverviewView`, `IdentityAccessView`, etc.) | `App.tsx` (`/dashboard`) | `ACTIVE` |
| `frontend/components/profiles/ProfileManagement.tsx` | Management list of local workstation identities | `localProfileService` | `App.tsx` (`/profiles`) | `ACTIVE` |
| `frontend/components/profiles/AddProfile.tsx` | Admin-authorized new identity enrollment wizard | `FaceEnrollmentCeremony`, `VoiceEnrollmentCeremony` | `App.tsx` (`/profiles/add`) | `ACTIVE` |
| `frontend/components/profiles/ProfileDetails.tsx` | Detailed view of biometric factors and profile keys | `localProfileService` | `App.tsx` (`/profiles/:id`) | `ACTIVE` |
| `frontend/components/AdminDashboard.tsx` | Tabbed administrator management console | `src/admin/*` | None (Unrouted in `App.tsx`) | `PARTIAL` |
| `frontend/src/admin/Users.tsx` | Admin user directory and invitation modal | `adminApi` | `AdminDashboard.tsx` | `PARTIAL` |
| `frontend/src/admin/Sessions.tsx` | Admin active session monitoring and revocation table | `adminApi` | `AdminDashboard.tsx` | `PARTIAL` |
| `frontend/src/admin/SystemHealth.tsx` | Real-time health indicators for Redis, DB, Python | `adminApi` | `AdminDashboard.tsx` | `PARTIAL` |
| `frontend/src/admin/AuditLogs.tsx` | Platform-wide audit log inspector | `adminApi` | `AdminDashboard.tsx` | `PARTIAL` |
| `frontend/components/PalmScanner.tsx` | Simulated palm vascular biometric scanner | `api.verify` (mock) | None (Demonstration mock) | `MOCK` |
| `frontend/components/FingerprintScanner.tsx` | Simulated optical fingerprint scanner | `api.verify` (mock) | None (Demonstration mock) | `MOCK` |
| `frontend/components/CognitiveScanner.tsx` | Simulated cognitive/behavioral biometric scanner | `api.verify` (mock) | None (Demonstration mock) | `MOCK` |
| `frontend/components/SwarmAuth.tsx` | Simulated multi-device ambient mesh authenticator | None | None (Demonstration mock) | `MOCK` |
| `frontend/components/PrivacyVault.tsx` | Simulated client-side encrypted document vault | `vaultApi` | `SecurityConsole.tsx` | `MOCK` |
| `frontend/components/ForensicAnalyzer.tsx` | Deepfake detection demonstration interface | `api` | None (Demonstration mock) | `MOCK` |

---

## 8. Obsolete & Legacy Assets

| Path | Nature of File | Recommended Action |
|---|---|---|
| `services/api.ts` (root) | Stale prototype API client from initial monorepo layout | Retain for historical reference; do not use in active dev |
| `services/geminiService.ts` (root) | Duplicate Gemini helper at project root | Retain; use `frontend/services/geminiService.ts` instead |
| `services/secureBackend.ts` (root) | Duplicate storage helper at project root | Retain; superseded by `backend/src/` |
| `temp_repo/` | External cloned FastAPI repository | Retain as reference code only; do not build |
