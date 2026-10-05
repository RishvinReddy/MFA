# PROJECT_CONTEXT.md
# BioShield MFA — Master Technical Context Document

> **Confidential & Proprietary — Engineering Architecture & System State Dossier**  
> **Target Audience:** Core AI Engineers, Systems Architects, Security Auditors  
> **Status:** Active Source of Truth (Post-Reconnaissance Audit)

---

## 1. Project Overview

**BioShield MFA** is an intelligent, local-first continuous authentication and Zero-Trust desktop security platform. Its foundational premise is that **initial authentication establishes initial trust, not permanent trust**. 

While traditional security platforms verify credentials once at login and remain trusted until explicit logout or timeout, BioShield treats identity as a dynamic, decaying probability function. The system couples multi-modal physiological biometrics (facial feature vectors, voice acoustics), multi-factor authentication (TOTP, WebAuthn/FIDO2, transactional email OTP), and contextual machine heuristics into a continuous, risk-adaptive authentication loop that evaluates session confidence in real time.

---

## 2. Problem Statement

Traditional identity and access management (IAM) models suffer from the **post-login identity assurance gap**:
1. **Unattended Workstation Hijacking:** A legitimate user authenticates via strong password and hardware token, then steps away from their desk. An unauthorized actor accesses the unlocked machine with the privileges of the authenticated user.
2. **Session Persistence Overconfidence:** Sessions remain valid for hours based purely on inactivity timers without verifying if the person sitting at the screen is still the person who authenticated.
3. **Binary Authentication Failures:** Systems either grant full access or lock out the user, lacking nuanced states such as observation, passive verification, or progressive step-up friction.
4. **Biometric Data Exposure:** Storing raw biometric images or templates creates severe regulatory and privacy liabilities if a central server or local storage is compromised.

---

## 3. Goals

- **Continuous Zero-Trust Assurance:** Maintain an uninterrupted background assessment of identity confidence via passive periodic webcam telemetry (every 30 seconds) and behavioral activity.
- **Multimodal Physiological Fusion:** Combine 512-dimensional facial embeddings (InsightFace) and 192-dimensional voice embeddings (SpeechBrain ECAPA-TDNN) through a mathematically weighted, time-decayed fusion engine.
- **Active Anti-Spoofing & Liveness:** Defeat 2D presentation attacks, video replays, and deepfakes via randomized, nonce-bound challenge-response state machines (e.g., yaw rotations, spoken dynamic passphrases verified via Whisper STT).
- **Cryptographic Template Protection:** Protect all enrolled biometric feature vectors at rest using AES-256-GCM envelope encryption.
- **Stateful Policy & Hysteresis Trust Engine:** Prevent rapid authentication state jitter via a 5-tier finite state machine (`TRUSTED`, `OBSERVE`, `CHALLENGE`, `RESTRICTED`, `LOCKED`).

---

## 4. Users & Actors

1. **Standard User:** Authenticates via behavioral password entry, completes face/voice verification, enrolls MFA factors, accesses authorized dashboard resources, and participates in background continuous verification.
2. **Security Analyst:** Reviews audit logs, investigates forensic deepfake alerts, monitors real-time anomaly scores, and inspects threat telemetry.
3. **Primary Administrator:** Provisions users, issues enrollment tokens, resets MFA secrets, configures system-wide fusion weights/thresholds, and triggers emergency session revocations.
4. **Attacker / Impostor:** Tries presentation attacks (printed photos, smartphone replay), voice synthesis, or session interception.

---

## 5. Core Features

- **Multi-Stage Adaptive Login Ceremony:**
  1. Primary credentials (Argon2id password verification + keystroke/mouse kinematics).
  2. Active face liveness challenge (server-issued nonce, strict temporal pose sequencing).
  3. Active voice challenge (server-issued random phrase, STT transcript matching, ECAPA-TDNN cosine similarity).
  4. Out-of-Band / In-Band MFA (RFC 6238 TOTP via QR code or EmailJS OTP).
- **Zero-Trust Continuous Authentication:**
  - Automated client heartbeat (30s interval) capturing low-friction video frames.
  - Grace-period anomaly detection (delayed, stale, or abandoned heartbeats increase risk).
  - Dynamic step-up authentication triggering modal challenge when confidence drops below thresholds.
- **Dynamic Multimodal Fusion Engine:**
  - Normalized Evidence Contract (`NormalizedEvidence`) with freshness decay and quality gating.
  - Strict separation of human confidence vs. device assurance (device trust cannot override human mismatch).
- **Cryptographic Core:**
  - Argon2id password hashing with transparent legacy bcrypt migration.
  - AES-256-GCM encrypted biometric template storage.
  - Secure hardware attestation telemetry (TPM 2.0, UEFI Secure Boot registry queries).
- **Enterprise Security Console:**
  - Comprehensive dashboard reporting system health, active sessions, risk telemetry, and audit trails.

---

## 6. Technology Stack

### Frontend Client
| Layer | Technology | Version | Location / Purpose |
|---|---|---|---|
| Runtime / Framework | React | ^19.2.0 | `frontend/`, UI view layer |
| Language | TypeScript | ~5.8.2 | Type-safe client architecture |
| Build Tool | Vite | ^6.2.0 | `frontend/vite.config.ts`, Dev server & bundling (Port 3000) |
| Routing | React Router DOM | ^6.30.3 | `frontend/App.tsx`, SPA route management |
| Icons | Lucide React | ^0.554.0 | Dashboard and console iconography |
| Charts & Viz | Chart.js / Recharts | ^4.5.1 / ^3.4.1 | Telemetry & biometric fusion graphs |
| WebAuthn Client | @simplewebauthn/browser | ^13.3.0 | FIDO2 / Passkey browser ceremony |
| Media Capture | Web Audio API / HTML5 Video | Native Browser | Audio PCM encoding & webcam frame acquisition |

### Backend API Server
| Layer | Technology | Version | Location / Purpose |
|---|---|---|---|
| Runtime | Node.js (ts-node) | v18+ / v20+ | `backend/src/index.ts` (Port 8080) |
| Framework | Express | ^4.18.2 | HTTP REST API orchestration |
| ORM / Database Client | Prisma | ^6.19.2 | Schema management & SQLite interface (`backend/prisma`) |
| Password Hashing | Argon2 / Bcrypt | ^0.45.1 / ^5.1.1 | Argon2id primary with legacy bcrypt support |
| Symmetric Crypto | Node.js `crypto` | Native | AES-256-GCM template encryption, HKDF, SHA-256 |
| Token Management | JSONWebToken (jsonwebtoken) | ^9.0.3 | Stateless access (15m) & refresh (7d) tokens |
| TOTP Engine | Speakeasy / QRCode | ^2.0.0 / ^1.5.4 | RFC 6238 TOTP secrets & QR generation |
| WebAuthn Server | @simplewebauthn/server | ^9.0.3 | FIDO2 challenge generation & assertion verification |
| Caching & Rate Limiting | ioredis / rate-limit-redis | ^6.0.0 / ^6.0.1 | Redis client, brute-force protection, OTP storage |
| Security Headers | Helmet / CORS | ^8.1.0 / ^2.8.6 | HTTP defense-in-depth headers |
| Schema Validation | Zod | ^4.3.6 | Request payload schema validation |
| Multipart Uploads | Multer | ^1.4.5-lts.1 | Temporary disk storage for image/audio frames |

### Biometric Inference Microservice
| Layer | Technology | Version | Location / Purpose |
|---|---|---|---|
| Framework | FastAPI / Uvicorn | ^0.100+ | `biometric-service/main.py` (Port 5000) |
| Language | Python | 3.10 / 3.11 | ML inference service runtime |
| Face Engine | InsightFace (`buffalo_l`) | 0.7.3 | 512-d feature vector extraction & landmark pose |
| Runtime Engine | ONNX Runtime | 1.24.2 | CPU execution for InsightFace ONNX models |
| Voice Engine | SpeechBrain ECAPA-TDNN | Latest | 192-d x-vector acoustic speaker embeddings |
| STT Engine | HuggingFace Whisper (`whisper-tiny`) | Latest | Audio transcription for verbal challenge verification |
| Computer Vision | OpenCV (`opencv-python`) | ^4.8+ | Frame decoding, grayscale conversion, Laplacian blur analysis |

### Database & Infrastructure
| Layer | Technology | Details |
|---|---|---|
| Primary Database | SQLite | `backend/prisma/bioshield.db`, file-based relational store |
| Distributed Cache | Redis 7 | Port 6379, Session caching, OTP verification, rate limit counters |
| Containers | Docker & Docker Compose | Multi-container setup defined in `docker-compose.yml` |

---

## 7. Architecture

```
                    ┌─────────────────────────────────────────────────────┐
                    │               USER / BROWSER CLIENT                 │
                    │               (React 19 on Port 3000)               │
                    └───────────┬─────────────────────────────▲───────────┘
                                │                             │
                  REST Requests │ (Proxied via Vite)          │ Live Video Frames
                  & Auth Flow   │                             │ (/analyze-frame)
                                ▼                             │
                    ┌─────────────────────────┐               │
                    │  EXPRESS BACKEND (8080) │               │
                    │   - Adaptive Auth Loop  │               │
                    │   - Policy Engine       │               │
                    │   - Crypto Service      │               │
                    │   - Session Manager     │               │
                    └─────┬───────┬───────┬───┘               │
                          │       │       │                   │
         Prisma ORM Queries│       │       │ HTTP /multipart   │
                          │       │       └───────────┐       │
                          ▼       ▼ Redis             ▼       ▼
    ┌──────────────────────┐  ┌─────────────┐   ┌───────────────────────────┐
    │   SQLite Database    │  │ Redis Cache │   │  BIOMETRIC SERVICE (5000) │
    │   (bioshield.db)     │  │ (Port 6379) │   │   - InsightFace (512-d)   │
    │  Users, Sessions,    │  │ Rate limits,│   │   - ECAPA-TDNN (192-d)    │
    │  Templates, Audits   │  │ OTPs, Nonces│   │   - Whisper-tiny STT      │
    └──────────────────────┘  └─────────────┘   └───────────────────────────┘
```

### Communication Protocols
1. **Frontend ↔ Backend:** HTTP/1.1 REST (`http://localhost:8080`), JSON payloads, multipart/form-data for media, JWT Bearer tokens + `x-session-id` headers.
2. **Frontend ↔ Biometric Engine:** Direct HTTP POST (`http://localhost:5000/analyze-frame`), bypassing Node backend for sub-100ms real-time coaching feedback.
3. **Backend ↔ Biometric Engine:** Server-to-server HTTP POST (`http://127.0.0.1:5000`), secured via `x-biometric-api-key` header with exponential retry backoff.
4. **Backend ↔ Redis:** Redis serialization protocol over TCP port 6379 (`ioredis`).
5. **Backend ↔ Database:** Synchronous C-bindings via Prisma SQLite driver.

---

## 8. Repository Structure

```
bioshield-mfa-18-sep/
└── bioshield-mfa-2025 v9 31 july/
    ├── .gitignore
    ├── docker-compose.yml            # Docker multi-service spec (backend, biometric-service, redis)
    ├── package.json                  # Root orchestration package scripts
    ├── start-all.bat                 # Unified Windows process launcher (3 separate CMD windows)
    ├── stop-all.bat / stop-all.ps1   # Unified shutdown scripts
    ├── README.md                     # Comprehensive architecture and theoretical specifications
    ├── PHASE_*.md                    # Historic phase reports, audits, and empirical evaluations
    │
    ├── backend/                      # Node.js / Express Enterprise API
    │   ├── Dockerfile
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── jest.config.js
    │   ├── .env / .env.example
    │   ├── prisma/
    │   │   ├── schema.prisma         # Relational database schema
    │   │   ├── bioshield.db          # Active SQLite database file
    │   │   ├── seed.ts               # Default user seeding script
    │   │   └── migrations/           # Prisma migration history
    │   ├── scripts/                  # Administrative and diagnostic CLI scripts
    │   ├── tests/                    # Integration and unit tests
    │   └── src/
    │       ├── index.ts              # Server bootstrap and lifecycle entry point
    │       ├── middleware.ts         # Rate limiting, auth guards, error handlers
    │       ├── routes/               # API route declarations
    │       ├── controllers/          # Route controller handlers
    │       ├── services/             # Core business logic (AdaptiveAuth, Fusion, Risk, Trust, Policy)
    │       ├── validators/           # Zod schema definitions
    │       └── utils/                # Logging, KMS crypto, similarity math
    │
    ├── biometric-service/            # Python / FastAPI Biometric Inference Engine
    │   ├── Dockerfile
    │   ├── requirements.txt          # Python dependencies
    │   ├── main.py                   # FastAPI service routes and endpoints
    │   ├── face_processor.py         # InsightFace buffalo_l wrapper & pose math
    │   ├── calibrate_ecapa.py        # Voice threshold calibration script
    │   └── venv/                     # Python virtual environment (pre-installed models)
    │
    ├── frontend/                     # React 19 / Vite Web Application
    │   ├── index.html
    │   ├── vite.config.ts            # Vite config (proxying /api to 8080)
    │   ├── package.json
    │   ├── App.tsx                   # Master router and session monitor
    │   ├── types.ts                  # Shared client TypeScript types
    │   ├── services/                 # API clients, local storage profile services, telemetry
    │   ├── components/               # UI components (Scanners, Panels, Console, Layouts)
    │   │   ├── auth/                 # Step-by-step modality panels (Face, Voice, MFA)
    │   │   ├── console/              # Enterprise Security Console views
    │   │   ├── login/                # First-run setup, profile selectors, unlock forms
    │   │   └── profiles/             # User profile management and enrollment ceremonies
    │   └── src/                      # Sub-module views (Admin overview, sessions, users)
    │
    ├── design_docs/                  # Architectural whitepapers & system specifications
    ├── voice_calibration/            # 5-speaker calibration WAV dataset (A, B, C, D, E)
    ├── services/                     # [LEGACY / ORPHANED] Early prototype frontend services
    └── temp_repo/                    # [EXTERNAL ARCHIVE] Cloned reference FastAPI repository
```

---

## 9. Frontend Architecture

### Entry Point & Bootstrapping
- `frontend/index.html` loads `frontend/index.tsx`, which mounts `frontend/App.tsx` wrapped in `BrowserRouter`.
- `App.tsx` enforces an initial hardware diagnostic boot ceremony (`SystemBoot.tsx`) before exposing the application.

### State & Navigation Model
- The router maps routes:
  - `/` -> `BehavioralLogin.tsx` (Credentials + Local Profile Selector)
  - `/verify/face` -> `FaceModalityPanel.tsx` (wrapped in `AuthContainer`)
  - `/verify/voice` -> `VoiceModalityPanel.tsx`
  - `/verify/mfa` -> `MfaModalityPanel.tsx`
  - `/dashboard` -> `SecurityConsole.tsx`
  - `/profiles/*` -> Local profile management (`ProfileManagement`, `AddProfile`, `ProfileDetails`)
- Navigation between stages is guarded by `VerifyGuard` checking session state stored in `sessionStorage` (`accessToken`, `sessionId`, `userId`).

### Continuous Heartbeat Architecture
- When `isAuthenticated === true`, `continuousAuthService.startMonitoring` fires every 30 seconds.
- It accesses the background video stream, captures a single frame, and posts it to `/api/auth/continuous-verify`.
- If the response demands step-up authentication, `StepUpModal` is activated. If the session is revoked or locked, `handleLock()` cleans storage and redirects to `/`.

---

## 10. Backend Architecture

### Application Bootstrap
- `backend/src/index.ts` validates mandatory environment variables (`DATABASE_URL`, `JWT_SECRET`, `MASTER_KEY_HEX`, `BIOMETRIC_SERVICE_URL`, `BIOMETRIC_API_KEY`).
- Validates the 64-character hex `BIOMETRIC_KEY` via `CryptoService.validateBiometricKey()`.
- Mounts Helmet, strict CORS policy, JSON body parsing (10MB limit), and request logging.
- Launches background garbage collection worker (prunes `TERMINATED` sessions older than 30 days every hour).

### Layered Service Architecture
1. **Controllers (`src/controllers/`):** Request deserialization, schema validation, HTTP response dispatch.
2. **Services (`src/services/`):**
   - `adaptiveAuth.service.ts`: Master orchestrator uniting evidence, fusion, risk, and policy.
   - `fusion.service.ts`: Mathematical evidence weight aggregator.
   - `risk.service.ts`: Exponential time-decay risk engine.
   - `trust.service.ts`: Hysteresis-driven trust state machine.
   - `policy.service.ts`: Action dispatcher (`ALLOW`, `REQUIRE_MFA`, `RESTRICT`, `LOCK`).
   - `challenge.service.ts`: Nonce and challenge sequence persistence.
   - `crypto.service.ts`: Argon2id hashing and AES-256-GCM encryption.
   - `cache.service.ts`: Redis connection and atomic verification helpers.
3. **Data Access Layer:** Direct Prisma Client calls into SQLite.

---

## 11. Database Architecture

### Engine & Schema
- **Database Engine:** SQLite 3 (stored at `backend/prisma/bioshield.db`).
- **Schema Definition:** `backend/prisma/schema.prisma`.

### Entity-Relationship Structure
```text
User (1) ──┬── (1) BiometricProfile
           ├── (1) BehavioralProfile
           ├── (1) EnrollmentState
           ├── (1) TotpSecret
           ├── (0..*) EnrollmentToken
           ├── (0..*) WebAuthnCredential
           ├── (0..*) RefreshToken
           ├── (0..*) AuthSession (1) ── (0..*) LivenessChallenge
           ├── (0..*) AuditLog
           ├── (0..*) SecurityEvent
           └── (0..*) TrustEvent

Stand-Alone Config Models:
├── SecurityConfiguration
└── FusionConfiguration
```

### Key Models & Fields
- **`User`:** Identity root (`id`, `email`, `passwordHash`, `role`, `status`, `mfaEnabled`, `failedAttempts`, `lockedUntil`, `biometricAttempts`, `biometricLockedUntil`).
- **`BiometricProfile`:** Encrypted templates (`faceTemplate`, `voiceTemplate`, `fingerprintTemplate`, salts).
- **`AuthSession`:** Active sessions (`id`, `userId`, `status`, `riskLevel`, `trustState`, `isActive`, `expiresAt`, `refreshTokenHash`).
- **`LivenessChallenge`:** Ephemeral challenge tracking (`nonce`, `sequence`, `isConsumed`, `expiresAt`).
- **`FusionConfiguration`:** Dynamic engine weights (`faceWeight`, `voiceWeight`, `behaviorWeight`, `deviceWeight`).

---

## 12. AI / Machine Learning Architecture

### Model Inventory
1. **InsightFace (`buffalo_l`):**
   - **Purpose:** Facial detection, landmark tracking, head pose estimation, and 512-dimensional feature embedding.
   - **Model Location:** Downloaded to `biometric-service/pretrained_models` or cached in user directory.
   - **Inference:** Executed on CPU using ONNX Runtime via `FaceAnalysis(name="buffalo_l")`.
   - **Operational Threshold:** Cosine similarity threshold calibrated at `>= 0.50` (or `FACE_SIMILARITY_THRESHOLD` in `.env`).
2. **SpeechBrain ECAPA-TDNN (`spkrec-ecapa-voxceleb`):**
   - **Purpose:** 192-dimensional acoustic speaker verification vector extraction.
   - **Model Location:** Loaded from SpeechBrain HuggingFace hub via `EncoderClassifier.from_hparams`.
   - **Inference:** CPU execution over 16kHz mono audio tensors.
   - **Operational Threshold:** Calibrated on local 5-speaker calibration dataset at `>= 0.40`.
3. **OpenAI Whisper (`openai/whisper-tiny`):**
   - **Purpose:** Speech-to-text transcription to verify spoken passphrases during voice liveness challenges.
   - **Inference:** HuggingFace transformers pipeline on CPU.

### Fusion Math & State Transition
- **Formula:**
  $$\text{Confidence} = \frac{\sum (w_i \times q_i \times f_i \times c_i)}{\sum (w_i \times q_i \times f_i)}$$
  Where $w$ is modality weight, $q$ is sample quality ($0.0-1.0$), $f$ is temporal freshness decay ($1.0 - \text{age}/\text{lifespan}$), and $c$ is calibrated similarity.
- **Hysteresis Guard:** Exiting `CHALLENGE` requires $\ge 0.80$ confidence; entering `CHALLENGE` requires dropping below $0.70$.

---

## 13. API Reference Summary

All API routes are mounted under `/api` on port `8080`.

| Method | Path | Purpose | Auth Requirement |
|---|---|---|---|
| `POST` | `/api/auth/register` | Initial admin registration & seed | Public / Enrollment Token |
| `POST` | `/api/auth/login` | Phase 1 primary credential verification | Public (Rate-limited) |
| `POST` | `/api/auth/refresh` | Refresh token exchange | Refresh Token (Returns 501) |
| `GET` | `/api/auth/session-status` | Poll active session lifecycle | `x-session-id` / Bearer token |
| `GET` | `/api/auth/enrollment-status` | Check modal enrollment completion | Active Session or Enrollment Token |
| `POST` | `/api/auth/generate-challenge` | Issue face/voice liveness challenge | Active Session or Enrollment Token |
| `POST` | `/api/auth/continuous-verify` | Periodic background verification | Active Session + Bearer Token |
| `POST` | `/api/auth/logout` | Terminate session | Active Session + Bearer Token |
| `GET` | `/api/auth/me` | Fetch authenticated user profile | Active Session + Bearer Token |
| `GET` | `/api/auth/audit` | Fetch personal user audit logs | Active Session + Bearer Token |
| `POST` | `/api/biometric/register` | Enroll face/voice embeddings | Active Session or Enrollment Token |
| `POST` | `/api/biometric/verify` | Verify face/voice against challenge | Challenge Session (`x-session-id`) |
| `POST` | `/api/biometric/revoke` | Revoke stored biometric templates | Active Session + Bearer Token |
| `GET` | `/api/biometric/stats` | Biometric telemetry metrics | Admin Role |
| `POST` | `/api/mfa/totp/setup` | Generate TOTP secret & QR code | Active Session or Enrollment Token |
| `POST` | `/api/mfa/totp/verify` | Verify and enable TOTP factor | Active Session or Enrollment Token |
| `POST` | `/api/mfa/totp/verify-login` | Finalize session via TOTP code | Challenge Session (`VOICE_VERIFIED`) |
| `POST` | `/api/mfa/send-email-code` | Dispatch email OTP via EmailJS | Challenge Session |
| `POST` | `/api/mfa/verify-email` | Verify email OTP code | Challenge Session |
| `POST` | `/api/mfa/email/send-pre-reg`| Send pre-registration OTP | Public |
| `POST` | `/api/mfa/email/verify-pre-reg`| Verify pre-registration OTP | Public (Rate-limited) |
| `POST` | `/api/webauthn/register/options`| Generate WebAuthn creation options | Active Session |
| `POST` | `/api/webauthn/register/verify` | Verify WebAuthn registration | Active Session |
| `POST` | `/api/webauthn/authenticate/options`| Generate WebAuthn auth options | Challenge Session |
| `POST` | `/api/webauthn/authenticate/verify` | Verify WebAuthn auth assertion | Challenge Session |
| `GET` | `/api/admin/overview` | Platform high-level overview | Admin Role |
| `GET` | `/api/admin/users` | List registered user directory | Admin Role |
| `POST` | `/api/admin/users` | Provision new user & invite | Admin Role (Privileged) |
| `GET` | `/api/admin/sessions` | List active sessions | Admin Role |
| `DELETE` | `/api/admin/session/:id` | Force terminate user session | Admin Role (Privileged) |
| `PATCH` | `/api/admin/user/:id/disable` | Disable user account | Admin Role (Privileged) |
| `PATCH` | `/api/admin/user/:id/enable` | Re-enable user account | Admin Role (Privileged) |
| `POST` | `/api/admin/user/:id/reset-mfa`| Reset user MFA configuration | Admin Role (Privileged) |
| `GET` | `/api/admin/system-health` | Probe database, Redis & Python | Admin Role |
| `POST` | `/api/vault/decrypt` | Decrypt secure vault document | Active Session (Privileged) |
| `POST` | `/api/forensics/analyze-alert` | Run deepfake analysis on sample | Active Session |
| `GET` | `/api/system-boot` | System telemetry & Secure Boot | Public |

---

## 14. Data Flow

### Complete Login Flow
```text
1. User enters Email + Password in BehavioralLogin UI
   → POST /api/auth/login
   → Backend verifies Argon2id password hash
   → Creates AuthSession in state 'CHALLENGE_REQUIRED'
   → Returns { sessionId, requiresMfa: true }
   → Client stores sessionId in sessionStorage, navigates to /verify/face

2. Face Verification Ceremony
   → GET /api/auth/generate-challenge?type=FACE
   → Backend creates LivenessChallenge record (nonce + sequence e.g. ["TURN_LEFT", "TURN_RIGHT"])
   → User performs head movements in front of camera
   → Client captures video frame sequence, posts to POST /api/biometric/verify (multipart: face)
   → Backend sends frames to Python /analyze-sequence
   → Python verifies challenge sequence & extracts 512-d InsightFace embedding
   → Backend decrypts stored template (AES-256-GCM), computes cosine similarity
   → AdaptiveAuthService updates AuthSession state to 'FACE_VERIFIED'
   → Client navigates to /verify/voice

3. Voice Verification Ceremony
   → GET /api/auth/generate-challenge?type=VOICE
   → Backend creates challenge with randomized phrase (e.g., "blue river")
   → User records audio speaking the phrase
   → Client converts audio to 16-bit PCM WAV, posts to POST /api/biometric/verify (multipart: voice)
   → Backend sends audio to Python /extract-voice-embedding
   → Python runs Whisper-tiny STT and SpeechBrain ECAPA-TDNN (192-d)
   → Backend verifies phrase matches and speaker similarity >= 0.40
   → AdaptiveAuthService updates AuthSession state to 'VOICE_VERIFIED'
   → Client navigates to /verify/mfa

4. Final MFA & Session Activation
   → User enters 6-digit TOTP code
   → POST /api/mfa/totp/verify-login
   → Backend verifies session is in state 'VOICE_VERIFIED'
   → Backend verifies TOTP via Speakeasy (base32 secret)
   → AuthService.finalizeSession updates AuthSession to 'ACTIVE' and 'TRUSTED'
   → Issues JWT accessToken (15m) and refreshToken (7d)
   → Client stores tokens, starts ContinuousAuthService, navigates to /dashboard
```

---

## 15. Authentication & Authorization

- **Primary Authentication:** Passwords hashed with Argon2id ($m=65536, t=3, p=1$).
- **Session Tokens:** Stateless JWT access tokens signed with `JWT_SECRET` (15m expiry).
- **Session Authority:** Database-backed session records (`AuthSession`). Even with a valid JWT, requests are validated against the database session state via `requireActiveSession`.
- **Role-Based Access Control (RBAC):** `Role` enum (`USER`, `ADMIN`, `PRIMARY_ADMIN`) enforced via `authorize(['ADMIN'])` middleware.
- **Privileged Step-Up Protection:** High-risk administrative actions (user provisioning, account disable, session revocation, vault decryption) pass through `requirePrivilegedAction`, which recalculates continuous trust before executing.

---

## 16. Environment Configuration

### Environment Variables Inventory
| Variable | Required | Location | Description |
|---|---|---|---|
| `PORT` | Optional (Def 8080) | `backend/.env` | Express server port |
| `NODE_ENV` | Optional | `backend/.env` | Runtime mode (`development`, `production`, `test`) |
| `DATABASE_URL` | **Required** | `backend/.env` | SQLite connection URI (`file:./bioshield.db`) |
| `REDIS_URL` | Optional | `backend/.env` | Redis connection URI (`redis://localhost:6379`) |
| `JWT_SECRET` | **Required** | `backend/.env` | Secret used to sign access tokens |
| `REFRESH_SECRET` | **Required** | `backend/.env` | Secret used to sign refresh tokens |
| `MASTER_KEY_HEX` | **Required** | `backend/.env` | 64-char hex key for KMS envelope encryption |
| `BIOMETRIC_KEY` | **Required** | `backend/.env` | 64-char hex key for AES-256-GCM template storage |
| `BIOMETRIC_SERVICE_URL` | **Required** | `backend/.env` | Target URL for Python service (`http://127.0.0.1:5000`) |
| `BIOMETRIC_API_KEY` | **Required** | `backend/.env` | Shared secret header for Python microservice |
| `EMAILJS_*` | Optional | `backend/.env` | EmailJS credentials for dispatching email OTPs |
| `GEMINI_API_KEY` | Optional | `frontend/.env` | Google Gemini API key for assistant chat |

---

## 17. Running the Project

### Prerequisites
- Node.js v18+ and npm installed and in PATH.
- Python 3.10 or 3.11 with virtual environment in `biometric-service/venv`.
- Redis server running on localhost:6379 (or via Docker).

### Startup Commands
- **Unified Windows Startup:** Double-click or execute `start-all.bat` from repository root.
- **Manual Step-by-Step:**
  ```powershell
  # 1. Biometric Microservice
  cd "biometric-service"
  .\venv\Scripts\python -m uvicorn main:app --host 127.0.0.1 --port 5000 --reload

  # 2. Node Backend API
  cd "backend"
  npm run dev

  # 3. Frontend Client
  cd "frontend"
  npm run dev
  ```
- **Database Initialization & Seeding:**
  ```powershell
  cd "backend"
  npx prisma migrate dev
  npx prisma db seed
  ```

---

## 18. Testing

- **Backend Test Suite:** Executed via `npm test` inside `backend/` using Jest and ts-jest.
- **Coverage Areas:**
  - `tests/e2e-gate.test.ts`: Complete authentication gate evaluation.
  - `tests/continuous-auth.test.ts`: Heartbeat lifecycle, tolerance decay, and step-up triggering.
  - `tests/adaptive-auth.test.ts`: Fusion engine decision boundaries and state transitions.
  - `tests/voice-verification.test.ts`: Acoustic verification and challenge handling.
  - `tests/rate-limiter.test.ts`: Redis fail-closed rate limiter behavior.
- **Frontend Testing:** None configured (no test framework in `frontend/package.json`).
- **Python Service Testing:** Standalone scripts (`test_phase1.py`, `test_whisper.py`, `verify_phase1_5.py`).

---

## 19. Security Findings & Vulnerabilities

| Finding ID | Severity | Category | Description |
|---|---|---|---|
| SEC-01 | **CRITICAL** | Secret Leakage | Live EmailJS credentials and static keys present in `backend/.env`. |
| SEC-02 | **HIGH** | Client Secret Exposure | Microservice API key (`dev_api_key_override_me`) is hardcoded in browser client code (`faceVerificationService.ts`). |
| SEC-03 | **HIGH** | Cryptographic Mismatch | `mfa.controller.ts` calls `utils/kms.ts` (AES-CBC, `KMS_SECRET`), but `auth.service.ts` encrypts with `CryptoService` (AES-GCM, `BIOMETRIC_KEY`). Crashes `/api/mfa/verify-email`. |
| SEC-04 | **HIGH** | Test Overrides in Production | `calibrateVoice()` hardcodes 1.0 confidence for scores $\ge 0.40$; `PolicyEngineService` bypasses spoof rejection for "Phase 9 Repeatability Experiment". |
| SEC-05 | **MEDIUM** | Rate Limiter Fail-Closed Risk | If Redis is offline, login attempts fail with HTTP 500, creating an accidental denial-of-service. |
| SEC-06 | **MEDIUM** | Arbitrary Command Execution | `systemDiagnostics.service.ts` invokes PowerShell via `execSync` to query UEFI registry keys without sandbox constraints. |

---

## 20. Known Issues & Defects

1. **Broken Forensic Alert Route:** `POST /api/forensics/analyze-alert` expects `req.file`, but `forensic.routes.ts` does not attach `multer` upload middleware. Requests will throw a 400 or crash.
2. **WebAuthn Origin Mismatch:** `webauthn.controller.ts` hardcodes origin as `http://localhost:5173`. When client runs on Vite port `3000`, registration/login fails assertion check.
3. **Pre-Registration API Route Mismatch:** Frontend `api.ts` posts to `/api/mfa/send-pre-reg-otp` and `/api/mfa/verify-pre-reg-otp`, but backend routes are `/api/mfa/email/send-pre-reg` and `/api/mfa/email/verify-pre-reg`.
4. **Token Refresh Route Mismatch:** Frontend calls `/api/auth/refresh-token`, backend exposes `/api/auth/refresh` (which returns 501 Not Implemented).
5. **Orphaned Admin Components:** `AdminDashboard.tsx` and `src/admin/*` are not linked to the main router in `App.tsx`.
6. **Dual Profile Identity Drift:** Frontend local profiles (`localProfileService` in `localStorage`) can drift out of sync with Prisma SQLite backend users.

---

## 21. Technical Debt

- **Monolithic Component File Sizes:** `FaceEnrollmentCeremony.tsx` (1,363 lines), `FaceScanner.tsx` (1,051 lines), `UserSettings.tsx` (1,000+ lines) combine camera stream management, mathematical pose estimation, animation loops, and API calls in single files.
- **Simulated Conceptual Scanners:** `PalmScanner.tsx`, `FingerprintScanner.tsx`, `CognitiveScanner.tsx`, and `SwarmAuth.tsx` are non-functional mock UI remnants.
- **Redundant Root Directory Files:** Root-level `services/` (`api.ts`, `geminiService.ts`, `secureBackend.ts`) and `temp_repo/` are obsolete copies.
- **Duplicated KMS Modules:** `backend/src/kms.ts` and `backend/src/utils/kms.ts` provide conflicting implementations.

---

## 22. Current Implementation Status

- **COMPLETED:**
  - Multi-stage credential & biometric login pipeline (Password -> Face Liveness -> Voice STT -> TOTP).
  - Python InsightFace buffalo_l 512-d face feature extraction with pose estimation (yaw, blur, bbox).
  - Python SpeechBrain ECAPA-TDNN 192-d voice embeddings and Whisper-tiny STT verification.
  - Multimodal fusion engine with quality filtering, temporal decay, and hysteresis state machine.
  - 30-second continuous verification background loop with face frame extraction.
  - Enterprise Security Console dashboard views.
- **PARTIALLY COMPLETED:**
  - WebAuthn / Passkeys (backend implemented, but origin mismatch and missing front-end flow).
  - Admin management views (views exist in `src/admin/`, but not routed in `App.tsx`).
- **BROKEN / DEFECTIVE:**
  - Email verification OTP (`/api/mfa/verify-email`) due to KMS crypto mismatch.
  - Forensic sample analysis (`/api/forensics/analyze-alert`) due to missing multer middleware.
  - Pre-registration OTP endpoints due to route naming mismatch.
  - Refresh token rotation (returns 501).
- **SIMULATED / MOCK:**
  - Palm scanning, fingerprint scanning, cognitive scanning, and swarm device mesh.
  - Secure vault document decryption (returns mock decrypted blob).

---

## 23. Important Files

- `backend/src/index.ts`: Backend entry point and worker setup.
- `backend/prisma/schema.prisma`: Authoritative database schema.
- `backend/src/services/adaptiveAuth.service.ts`: Central authentication coordinator.
- `backend/src/services/fusion.service.ts`: Mathematical multimodal fusion engine.
- `backend/src/controllers/biometric.controller.ts`: Biometric verification and lockout handling.
- `biometric-service/main.py`: FastAPI ML microservice endpoints.
- `biometric-service/face_processor.py`: InsightFace wrapper and pose calculations.
- `frontend/App.tsx`: React router, navigation guards, and continuous monitoring listener.
- `frontend/services/api.ts`: Frontend HTTP client for all API interactions.

---

## 24. Development Conventions

- **Language & Runtime:** TypeScript strictly typed across frontend and backend; Python 3.10+ PEP 8 for biometric services.
- **Component Styling:** Tailwind CSS utility classes augmented with custom backdrop filters and modern glassmorphism.
- **Cryptographic Standards:** Argon2id for password hashing; AES-256-GCM for encrypted templates; SHA-256 for nonces and tokens.
- **Commit & Working Discipline:** Fail closed on security verification; zero plaintext biometric vectors stored or transmitted.

---

## 25. Future / Planned Work

- Implement genuine hardware TPM 2.0 / DPAPI key storage for biometric templates.
- Unify the dual-profile registration model into a single backend-synchronized identity store.
- Implement production-grade WebAuthn/Passkeys registration and login.
- Connect administrative console views into the core React Router.
- Implement true passive behavioral keystroke dynamic ML modeling.

---

## 26. Recommended Development Workflow

1. **Pre-flight Checks:** Ensure Redis is running on port 6379 before starting the backend.
2. **Service Initialization:** Use `start-all.bat` or launch all three services in separate terminals.
3. **Database Migrations:** Run `npx prisma migrate dev` when modifying `schema.prisma`.
4. **Verification Testing:** Run `npm test` inside `backend/` to validate engine gates against the test suite.
