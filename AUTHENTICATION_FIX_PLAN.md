# Authentication Fix Plan — Pre-Implementation Analysis

This document provides a detailed, file-level pre-implementation analysis to establish a single, authoritative, secure authentication flow across the BioShield identity pipeline.

---

## 1. CRITICAL FILE INVENTORY

### Frontend Component & Service Locations

| File Path | Purpose / Summary | Key Symbols / Imports |
|---|---|---|
| [App.tsx](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/App.tsx) | App router and global UI flow manager. | `MainApp`, `App`, `VerifyGuard`, `handleLogin`, `handleStageComplete` |
| [types.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/types.ts) | Shared types, enums (`AuthStage`, `FactorStatus`), and environmental constants. | `AuthStage`, `VerificationResult`, `LocalProfile`, `SecureAction` |
| [components/BehavioralLogin.tsx](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/components/BehavioralLogin.tsx) | Coordinator wrapper for the lock screen and local profile select views. | `BehavioralLogin`, `handleBioShieldVerification`, `handleManageProfiles` |
| [components/login/UnlockView.tsx](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/components/login/UnlockView.tsx) | Welcome back lock screen card. Prompts identity verification. | `UnlockView` |
| [components/login/PinUnlockView.tsx](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/components/login/PinUnlockView.tsx) | Pin unlock UI. Checks PIN against local profile registry. | `PinUnlockView` |
| [components/login/FirstRunSetup.tsx](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/components/login/FirstRunSetup.tsx) | Setup screen shown when no local profiles exist in the app. | `FirstRunSetup` |
| [components/login/EnrollView.tsx](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/components/login/EnrollView.tsx) | Enrollment wizard coordinating details, PIN, and face scan. | `EnrollView`, `handleFormSubmit` |
| [components/FaceScanner.tsx](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/components/FaceScanner.tsx) | Live camera capture and face verification logic. | `FaceScanner`, `executeVerification` |
| [components/VoiceScanner.tsx](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/components/VoiceScanner.tsx) | Mic capture, phrase prompt, and voice verification logic. | `VoiceScanner`, `handleRecordToggle` |
| [components/FaceEnrollmentCeremony.tsx](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/components/FaceEnrollmentCeremony.tsx) | Capture poses (center, left, right, expression, liveness) for enrollment. | `FaceEnrollmentCeremony`, `capturePose` |
| [components/VoiceEnrollmentCeremony.tsx](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/components/VoiceEnrollmentCeremony.tsx) | Capture audio recordings for enrollment speaker profiling. | `VoiceEnrollmentCeremony` |
| [components/FinalizingVerification.tsx](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/components/FinalizingVerification.tsx) | Runs policy checks on biometric verifications and logs session in. | `FinalizingVerification`, `evaluatePolicy` |
| [components/StepUpModal.tsx](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/components/StepUpModal.tsx) | Adaptive re-verification overlay for step-up challenges. | `StepUpModal` |
| [components/console/SecurityConsole.tsx](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/components/console/SecurityConsole.tsx) | Zero-trust workstation dashboard. Displays trust metrics and options. | `SecurityConsole`, `handleSendAi` |
| [services/api.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/services/api.ts) | HTTP client definitions for all backend endpoints. | `api` |
| [services/authFlowService.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/services/authFlowService.ts) | Manages in-flight session stage progression (sessionStorage). | `authFlowService` |
| [services/authFlowController.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/services/authFlowController.ts) | Tracks post-authorization routing logic and secure action intents. | `authFlowController` |
| [services/localProfileService.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/services/localProfileService.ts) | Persistent local profile index (localStorage wrapper). | `localProfileService` |
| [services/biometricVault.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/services/biometricVault.ts) | Keyed XOR-obfuscated local template storage sentinel. | `biometricVault` |
| [services/faceVerificationService.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/services/faceVerificationService.ts) | Integrates camera capture blobs with the backend biometric API. | `faceVerificationService` |
| [services/voiceVerificationService.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/services/voiceVerificationService.ts) | Integrates mic audio blobs with Python comparison endpoints. | `voiceVerificationService` |
| [services/stepUpService.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/services/stepUpService.ts) | Central listener registrar to trigger Step-Up UI modally. | `stepUpService` |

### Backend Component & Database Locations

| File Path | Purpose / Summary | Key Symbols / Imports |
|---|---|---|
| [backend/src/index.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/index.ts) | Express configuration, server boot checks, route mounting. | `app`, `server` |
| [backend/src/middleware.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/middleware.ts) | Auth gates (`requireActiveSession`, `requireChallengeSession`). | `requireActiveSession`, `requireChallengeSession` |
| [backend/src/authUtils.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/authUtils.ts) | JWT signature, verification, password hashing, token hashing. | `generateToken`, `verifyToken`, `comparePassword` |
| [backend/src/routes/auth.routes.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/routes/auth.routes.ts) | Primary credential auth endpoints. | `router` |
| [backend/src/routes/mfa.routes.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/routes/mfa.routes.ts) | Setup and verification routes for TOTP / Email codes. | `router` |
| [backend/src/routes/biometric.routes.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/routes/biometric.routes.ts) | Endpoints to register/verify biometric face and voice. | `router` |
| [backend/src/routes/webauthn.routes.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/routes/webauthn.routes.ts) | WebAuthn challenge, registration, and verification endpoints. | `router`, `webAuthnRoutes` |
| [backend/src/controllers/auth.controller.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/controllers/auth.controller.ts) | Maps password validation and session boot data to services. | `register`, `login`, `refreshToken` |
| [backend/src/controllers/mfa.controller.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/controllers/mfa.controller.ts) | TOTP verification handler, EmailJS integration. | `setupTotp`, `verifyLoginTotp`, `sendPreRegOtp` |
| [backend/src/controllers/biometric.controller.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/controllers/biometric.controller.ts) | Handles multipart registration/verification files, decrypts templates. | `registerBiometric`, `verifyBiometric` |
| [backend/src/services/auth.service.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/services/auth.service.ts) | Generates TOTP secret and creates the challenge session record. | `AuthService` |
| [backend/src/services/crypto.service.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/services/crypto.service.ts) | Hardened cryptographic wrappers (Argon2id, AES-256-GCM). | `CryptoService` |
| [backend/src/services/risk.service.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/services/risk.service.ts) | Time-decay risk engine computation. | `RiskEngineService` |
| [backend/src/services/adaptiveAuth.service.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/services/adaptiveAuth.service.ts) | Coordinates trust/risk/policy evaluations. | `AdaptiveAuthenticationService` |
| [backend/src/services/fusion.service.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/services/fusion.service.ts) | Implements weighted identity confidence calculations. | `FusionEngineService` |
| [backend/src/services/trust.service.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/services/trust.service.ts) | State machine representing trust states using hysteresis. | `TrustEngineService` |
| [backend/src/services/policy.service.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/services/policy.service.ts) | Dictates access authorization given trust/risk inputs. | `PolicyEngineService` |
| [backend/prisma/schema.prisma](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/prisma/schema.prisma) | Data models representing Users, Sessions, Biometrics, and Logs. | `User`, `AuthSession`, `BiometricProfile`, `EnrollmentState` |

---

## 2. CURRENT AUTHENTICATION CONTRACT

### 1. User Registration / Signup
* **METHOD:** `POST`
* **URL:** `/api/auth/register`
* **REQUEST BODY:** `{ email, password, fullName }`
* **HEADERS:** `Content-Type: application/json`
* **AUTH REQUIREMENT:** None
* **RESPONSE (201):**
  ```json
  {
    "message": "User registered successfully",
    "userId": "usr-uuid-string",
    "qrCode": "data:image/png;base64,...",
    "enrollmentToken": "secure-raw-token-hex"
  }
  ```
* **ERROR RESPONSES:** `400 Bad Request` ("User already exists" or validation errors)
* **SIDE EFFECTS:** Creates a cryptographically randomized `speakeasy` base32 TOTP secret. Generates an enrollment token hash (SHA-256) valid for 24 hours.
* **DATABASE CHANGES:** Inserts one record into `User` status=`ENROLLMENT_REQUIRED` (casted as `ACTIVE` inside transaction), `mfaSecretEnc` (AES encrypted base32 secret). Inserts one record into `TotpSecret`. Inserts one record into `EnrollmentToken`. Inserts one record into `AuditLog`.
* **SESSION CHANGES:** None.

### 2. Password Credentials Login
* **METHOD:** `POST`
* **URL:** `/api/auth/login`
* **REQUEST BODY:** `{ email, password, behavioralMetrics: { typingSpeed, mouseVariance }, deviceFingerprint }`
* **HEADERS:** `Content-Type: application/json`
* **AUTH REQUIREMENT:** None
* **RESPONSE (200):**
  ```json
  {
    "success": true,
    "requiresMfa": true,
    "sessionId": "session-uuid-string",
    "userId": "user-uuid-string",
    "message": "Password valid, MFA required."
  }
  ```
* **ERROR RESPONSES:** `401 Unauthorized` ("Invalid credentials"), `403 Forbidden` ("Account disabled", "Account locked", "Account enrollment not completed")
* **SIDE EFFECTS:** Resets failed password attempts on success. Locks account on 5 consecutive failures for 15 minutes.
* **DATABASE CHANGES:** Updates `User` with `failedAttempts`, `lockedUntil`, and `status`. Inserts one record into `AuthSession` with status=`CHALLENGE_REQUIRED`. Inserts one record into `AuditLog`.
* **SESSION CHANGES:** Allocates a new database session in `CHALLENGE_REQUIRED` state.

### 3. Biometric Modality Registration
* **METHOD:** `POST`
* **URL:** `/api/biometric/register`
* **REQUEST BODY:** `multipart/form-data` with files `face` and/or `voice`
* **HEADERS:**
  * Requires either:
    * `x-enrollment-token` containing the raw enrollment token.
    * `Authorization: Bearer <JWT>`
    * `x-session-id: <sessionId>`
* **AUTH REQUIREMENT:** Access token, enrollment token, or session ID required (`requireActiveSessionOrEnrollmentToken` middleware).
* **RESPONSE (200):**
  ```json
  {
    "success": true,
    "message": "Biometrics registered successfully"
  }
  ```
* **ERROR RESPONSES:** `400 Bad Request` ("Face enrollment failed", "Voice enrollment failed", "No usable biometric data provided"), `401 Unauthorized` ("Missing user context"), `403 Forbidden` ("Invalid or expired enrollment token")
* **SIDE EFFECTS:** Cleans up temporary uploaded files via `fs.unlinkSync()`. If face is provided, calls Python biometric engine `/extract-face`, decrypts/verifies. If voice is provided, calls Python service `/enroll-voice`.
* **DATABASE CHANGES:** Upserts one record into `BiometricProfile` (`faceTemplate` encrypted with AES-256-GCM using `BIOMETRIC_KEY`). Upserts one record into `EnrollmentState` updating `faceEnrolled` and/or `voiceEnrolled`. If all conditions are met (`passwordEnrolled` (see bugs section), `faceEnrolled`, and `voiceEnrolled` all `true`), updates `User` status to `ACTIVE` and deletes the enrollment token.
* **SESSION CHANGES:** None directly, unless status transitions.

### 4. Biometric Verification
* **METHOD:** `POST`
* **URL:** `/api/biometric/verify`
* **REQUEST BODY:** `multipart/form-data` with files `face` and/or `voice`
* **HEADERS:** `x-session-id: <sessionId>` (Required by `requireChallengeSession` middleware)
* **AUTH REQUIREMENT:** Active challenge session.
* **RESPONSE (200):**
  ```json
  {
    "success": true,
    "evidences": [...],
    "action": "ALLOW",
    "token": "final-access-token-jwt-string",
    "lockout": false
  }
  ```
* **ERROR RESPONSES:** `401 Unauthorized` ("Missing session ID"), `403 Forbidden` ("Biometric authentication locked", "Session not in CHALLENGE_REQUIRED state"), `404 Not Found` ("Biometric profile not found")
* **SIDE EFFECTS:** Computes Euclidean distance against decrypted face template. Updates biometric lockout counter on fail (5 failures locks biometric for 5 minutes). Calls Python speaker comparison `/compare-voice` if voice supplied. Invokes adaptive authentication orchestrator.
* **DATABASE CHANGES:** Updates `User` `biometricAttempts` and `biometricLockedUntil`. If orchestrator confirms success (`action: 'ALLOW'`), updates `AuthSession` to status=`ACTIVE`, trustState=`TRUSTED`, updates token hash fields, and sets session expiry.
* **SESSION CHANGES:** Transitions session state to `ACTIVE` on success.

### 5. TOTP Verification (MFA Login)
* **METHOD:** `POST`
* **URL:** `/api/mfa/totp/verify-login`
* **REQUEST BODY:** `{ userId, token }`
* **HEADERS:** `x-session-id: <sessionId>` (Required by `requireChallengeSession` middleware)
* **AUTH REQUIREMENT:** Active challenge session.
* **RESPONSE (200):**
  ```json
  {
    "success": true,
    "accessToken": "access-token-string",
    "refreshToken": "refresh-token-string",
    "user": { "id", "email", "role" }
  }
  ```
* **ERROR RESPONSES:** `400 Bad Request` ("Invalid code", "MFA not set up"), `404 Not Found` ("User not found")
* **SIDE EFFECTS:** Validates 6-digit TOTP against speakeasy secret with verification window 5.
* **DATABASE CHANGES:** None! **(CRITICAL ISSUE: The AuthSession status in database is NEVER updated to ACTIVE here.)**
* **SESSION CHANGES:** None in DB.

### 6. Pre-Registration OTP Send
* **METHOD:** `POST`
* **URL:** `/api/mfa/email/send-pre-reg` **(Mismatched in api.ts to /api/mfa/send-pre-reg-otp)**
* **REQUEST BODY:** `{ email }`
* **HEADERS:** `Content-Type: application/json`
* **AUTH REQUIREMENT:** None
* **RESPONSE (200):**
  ```json
  {
    "success": true,
    "message": "Verification code sent"
  }
  ```
* **ERROR RESPONSES:** `400 Bad Request` ("Email required"), `500 Internal Server Error` ("Email service not configured")
* **SIDE EFFECTS:** Generates random 6-digit code. Submits email via EmailJS API. Logs code in plain text.
* **DATABASE CHANGES:** None.
* **SESSION CHANGES:** In-memory map stores verification state.

---

## 3. AUTHENTICATION SESSION LIFECYCLE

The target backend session lifecycle traverses the following state transitions:

```
[Credentials login]
        ↓ (1)
AuthSession created: CHALLENGE_REQUIRED
        ↓ (2)
[Biometric verification (face/voice) + x-session-id]
        ↓ (3)
Orchestration (evaluateAuthenticationEvent) -> Decision action ALLOW
        ↓ (4)
finalizeSession() -> ACTIVE
        ↓ (5)
Access Token (JWT) issued -> Dashboard
        ↓ (6)
[Logout] -> session status TERMINATED + tokens cleared
```

### Inconsistencies & Deviations Identified in Current Code:

1. **Disconnected Verification Routes:** 
   * In `biometric.controller.ts` (verifyBiometric), when verification succeeds:
     * It calls `AuthService.finalizeSession(sessionId, userId, 'TRUSTED')`.
     * This updates the `AuthSession` status to `ACTIVE`.
     * It generates the final tokens, but it only returns `sessionTokens.accessToken` as `token`. **It forgets to return the `refreshToken`** (line 223, 243).
2. **TOTP Session Bypasses DB Session Finalization:**
   * In `mfa.controller.ts` (verifyLoginTotp), if the TOTP code is valid:
     * It generates and returns the JWT `accessToken` and `refreshToken` (lines 174–182).
     * **It never calls `finalizeSession()`** to transition the `AuthSession` status to `ACTIVE`.
     * Therefore, the `AuthSession` record in the database remains stuck in `CHALLENGE_REQUIRED` status forever.
3. **Logout Is a No-Op on the Backend:**
   * In `auth.controller.ts` (logout), the function returns a JSON success string but **never updates the database session status** or invalidates the refresh token (lines 58–60).
4. **No Auth Token Validation Against Session DB:**
   * While `requireActiveSession` in `middleware.ts` checks the `x-session-id` against the database session table (lines 77–85), it only checks it **if the header is passed**. If the header is absent, the middleware assumes the JWT signature verify is sufficient (lines 49–59), allowing expired or revoked sessions to continue calling APIs as long as the JWT signature is valid.

---

## 4. FRONTEND AUTH STATE

To resolve the bypasses and page refresh bugs, the global authentication state in `App.tsx` must be refactored to support a strict state model.

### Proposed Authentication State Model

```typescript
export type AuthStage =
  | 'UNAUTHENTICATED'
  | 'CREDENTIALS_VERIFIED' // Password matched, sessionId obtained
  | 'FACE_PENDING'          // Prompting face verification
  | 'FACE_VERIFIED'          // Face matched on backend
  | 'VOICE_PENDING'         // Prompting voice verification
  | 'VOICE_VERIFIED'         // Voice matched on backend
  | 'MFA_PENDING'           // Prompting TOTP verification
  | 'AUTHENTICATED'         // Fully verified, JWT issued, access allowed
  | 'STEP_UP_REQUIRED'      // Re-verification challenge in progress
  | 'LOCKED';               // Biometric or credentials lock state
```

### Variable Replacements in `App.tsx`:

* **`isAuthenticated`:** Replace the local state boolean loaded from localStorage with `isAuthenticated: boolean` computed from the presence of a valid `accessToken` in `sessionStorage` (preventing persistent unauthorized dashboard access).
* **`bioshield_authenticated_session`:** Eliminate this insecure localStorage boolean. It must be replaced by the presence of `accessToken` and `refreshToken` in storage.
* **`userId`, `username`, `userRole`:** Restore these variables on page load by extracting the decoded payload from the stored `accessToken` or by calling `/api/auth/me` on mount instead of initializing them to empty strings.

---

## 5. LOGIN RECONSTRUCTION

Currently, the frontend flow relies on local profiles and local face/voice matches without involving the backend. The reconstruction will require credentials, a database session, and multi-stage backend verification.

```
[Lock Screen Select Profile]
       ↓
[PIN / Credentials Entered]
       ↓
[POST /api/auth/login] -> Get sessionId
       ↓
[Navigate /verify/face] -> Upload face blob + x-session-id
       ↓
[Navigate /verify/voice] -> Upload voice blob + x-session-id
       ↓
[Navigate /mfa] -> Verify TOTP token + x-session-id
       ↓
[Finalize Session] -> Get JWTs
       ↓
[Navigate /dashboard]
```

### Detailed Transition Mapping

| Step | Transition | Current Code Location | Current Behavior | Required Behavior | Backend Endpoint | Frontend Service |
|---|---|---|---|---|---|---|
| **1** | Profile Select / PIN | `BehavioralLogin.tsx` / `PinUnlockView.tsx` | Validates PIN locally via `localProfileService` and fires `onSuccess`. | Prompts user for credentials (password/PIN) and calls backend. | `POST /api/auth/login` | `api.login` |
| **2** | Login → Face Scan | `App.tsx` (handleLogin) | Calls `handleLogin` directly with hardcoded user credentials. | Stores `sessionId` and navigates to face verification. | None | `authFlowService.start` |
| **3** | Face Scan Verify | `FaceScanner.tsx` (executeVerification) | Calls `faceVerificationService.verifyLiveCapture` locally. | Uploads camera blob to backend with `x-session-id` header. | `POST /api/biometric/verify` | `faceVerificationService` |
| **4** | Face → Voice | `App.tsx` (handleStageComplete) | Completes stage locally and navigates to `/verify/voice`. | Receives backend confirmation and transitions stage to voice. | None | `authFlowService.completeStage` |
| **5** | Voice Scan Verify | `VoiceScanner.tsx` | Calls local validation. | Uploads mic blob to backend with `x-session-id` header. | `POST /api/biometric/verify` | `voiceVerificationService` |
| **6** | Voice → TOTP | `App.tsx` (handleStageComplete) | Bypasses TOTP and navigates directly to finalizing decision. | Navigates to `/verify/mfa` for TOTP token validation. | None | None |
| **7** | TOTP Verify | None | Bypassed. | User enters 6-digit TOTP; verified on backend. | `POST /api/mfa/totp/verify-login` | `api.verifyLoginTotp` |
| **8** | Finalize Login | `FinalizingVerification.tsx` | Calls `handleLogin` with hardcoded credentials in `App.tsx`. | Saves JWT tokens and navigates to `/dashboard`. | None | `api.setToken` |

---

## 6. USER IDENTITY MAPPING

### IDs Generation:
* **Local profile ID:** Generated on frontend as `lp-timestamp-random` in `localProfileService.ts` (line 41).
* **Backend user ID:** Generated on backend as a UUID (`uuidv4`) via Prisma during database insert.

### Architectural Gap:
* There is no database field in the `User` model, and no property in the `LocalProfile` object mapping these two identifiers together. The local profile and backend user database records are completely separate.

### Proposed Smallest Safe Change:
1. Update `LocalProfile` in `types.ts` to include an optional mapping field:
   ```typescript
   backendUserId?: string;
   ```
2. During registration, store the returned backend `userId` in the `backendUserId` property of the newly created local profile.
3. During login, lookup the profile matching the selected local profile, read its `backendUserId`, and supply that identifier or the email in the request payload.

---

## 7. REGISTRATION RECONSTRUCTION

Currently, registration is fragmented between writing to the backend and creating a local profile independently.

```
Fill Registration Form (fullName, email, password)
       ↓
[POST /api/auth/register] -> Returns: userId, qrCode, enrollmentToken
       ↓
Display QR Code & Verify TOTP -> [POST /api/mfa/totp/verify]
       ↓
Create Local Profile (link backendUserId)
       ↓
Face Scanner Enrollment -> [POST /api/biometric/register + x-enrollment-token]
       ↓
Voice Scanner Enrollment -> [POST /api/biometric/register + x-enrollment-token]
       ↓
[Enrollment State Completed] -> User status is updated to ACTIVE
```

### Handling Partial Enrollment / Stuck Accounts:
* Currently, if enrollment is interrupted (e.g., face completed but voice is not), the account status remains `ENROLLMENT_REQUIRED` (or rather remains inactive).
* **Prisma bug:** `EnrollmentState.passwordEnrolled` is defined with a default value of `false` in `schema.prisma`. It is **never** set to `true` during registration inside `auth.service.ts`, which prevents the completeness check (`passwordEnrolled && faceEnrolled && voiceEnrolled`) from ever succeeding.
* **Fix:** Update `auth.service.ts` to set `passwordEnrolled: true` in the `EnrollmentState` model during transaction registration.

---

## 8. BIOMETRIC INTEGRATION

Biometric verification must be changed from local checks to backend-coordinated checks.

### Target Biometric Verification Architecture

```
[Camera / Mic Capture]
       ↓
[Blob to FormData]
       ↓
[POST /api/biometric/verify] with x-session-id
       ↓
[Backend BiometricService]
  ├── Calls http://localhost:5000/extract-face to get embedding
  ├── Decrypts database template from BiometricProfile
  └── Evaluates cosine distance inside Node.js
       ↓
[Backend updates AuthSession status via Orchestrator]
       ↓
[Response to Frontend: success + action]
```

### Necessary Parameter Settings:
* **Headers:** `x-session-id: <sessionId>` must be passed.
* **Biometric Profile Lookup:** Done inside `biometric.controller.ts` by querying `prisma.biometricProfile.findUnique({ where: { userId } })`.
* **Similarity Threshold:** Face distance threshold is hardcoded in `biometric.controller.ts` (line 166) as `distance < 1.2`. Voice threshold is hardcoded in the Python service as `VOICE_MATCH_THRESHOLD = 0.75` (line 30).

---

## 9. MFA INTEGRATION

To complete authentication, the frontend must verify the TOTP token using the challenge session.

* **Endpoint:** `POST /api/mfa/totp/verify-login`
* **Headers:** `x-session-id: <sessionId>`
* **Body:** `{ userId, token }`
* **Response:** `{ success: true, accessToken, refreshToken, user }`
* **Session Finalization:** 
  To fix the database status bug: the controller `mfa.controller.ts` must call `authService.finalizeSession(sessionId, userId, 'TRUSTED')` **before** returning the tokens, so the session status transitions to `ACTIVE` in the database.

---

## 10. SESSION STORAGE DESIGN

To enforce appropriate protection, the storage locations of tokens and profile structures must be organized:

| Data Item | Storage Location | Rationale |
|---|---|---|
| **Access Token (JWT)** | `sessionStorage` | Keeps token in-memory only. Cleared automatically when tab is closed. |
| **Refresh Token (JWT)** | `sessionStorage` | Prevents long-term storage leakage. (In production, this should reside in an HTTPOnly, secure cookie). |
| **Challenge Session ID** | `sessionStorage` | Temporary session ID tracking during step-by-step verification flows. |
| **Local Profiles** | `localStorage` | Keeps profile initials, firstName, lastName, and configurations across browser restarts. |
| **Biometric Templates** | **NOT STORED** | Delete `biometricVault` from frontend. Reference vectors must live solely on the backend database. |

---

## 11. ROUTE GUARD DESIGN

```
UNAUTHENTICATED ROUTE GUARD
  ├── /                      → Allow
  └── All other routes       → Redirect to /

CHALLENGE ROUTE GUARD (requires sessionId in sessionStorage)
  ├── /verify/face           → Allowed if stage is FACE
  ├── /verify/voice          → Allowed if stage is VOICE (face passed)
  ├── /verify/finalizing     → Allowed if stage is DECISION (face + voice passed)
  └── /verify/mfa            → Allowed if biometrics passed

AUTHENTICATED ROUTE GUARD (requires active accessToken)
  ├── /dashboard             → Allow
  ├── /profiles              → Allow if userRole is ADMIN / PRIMARY_ADMIN
  └── /admin                 → Allow if userRole is ADMIN / PRIMARY_ADMIN
```

---

## 12. LOGOUT DESIGN

Logout must invalidate the backend session rather than simply clearing local flags.

### Proposed Logout Lifecycle:

```
User clicks Logout
       ↓
[POST /api/auth/logout] with Authorization Header
       ↓
Backend: find active AuthSession matching decoded token id
       ↓
Update AuthSession: status = "TERMINATED", isActive = false
       ↓
Frontend: clear sessionStorage (accessToken, refreshToken, sessionId)
       ↓
Navigate to /
```

---

## 13. HTTPS / CAMERA CONFIGURATION

### Recommendation: HTTP localhost

To simplify development and eliminate network connectivity errors:
1. **Frontend URL:** Use `http://localhost:3000` (HTTP).
2. **Backend URL:** Use `http://localhost:8080` (HTTP).
3. **Biometric engine URL:** Use `http://localhost:5000` (HTTP).
4. **Browser Permissions:** Modern browsers treat `localhost` as a secure context, so camera access (`getUserMedia`) works without configuring SSL certificates.
5. **Fix `start-all.bat`:** Change `https://localhost:3000` to `http://localhost:3000` to prevent the `ERR_CONNECTION_REFUSED` launch page crash.

---

## 14. SECURITY FIX MAP

| ID | Current Location | Root Cause | Required Fix | Dependencies | Priority |
|---|---|---|---|---|---|
| **V1** | [App.tsx:L32](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/App.tsx#L32) | Insecure localStorage auth state boolean check. | Determine auth from the presence of `accessToken` in sessionStorage. | V3 | CRITICAL |
| **V2** | [App.tsx:L320](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/App.tsx#L320) | Hardcoded `'Rishvin'` and `'local-prof-001'` identity payload. | Supply profile values returned from the backend authentication request. | V3 | CRITICAL |
| **V3** | Architecture | Face/voice scans verify locally instead of checking on the backend. | Route all scans to the backend `/api/biometric/verify` endpoint. | V1, V2 | CRITICAL |
| **V4** | [prisma/schema.prisma:L95](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/prisma/schema.prisma#L95) | TOTP secret stored in plaintext in the database. | Delete the `TotpSecret` table and read/verify TOTP via the encrypted field. | None | HIGH |
| **V5** | [backend/.env:L9](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/.env#L9) | Hardcoded simple secret `JWT_SECRET="supersecret"`. | Define long, random hexadecimal strings. | None | HIGH |
| **V6** | [biometric-service/main.py:L27](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/biometric-service/main.py#L27) | Voice embeddings written in plaintext files. | Encrypt voice references or store templates in SQLite. | None | HIGH |
| **V7** | [vite.config.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/vite.config.ts) | Missing HTTPS config despite `start-all.bat` opening `https://`. | Change `start-all.bat` to launch `http://localhost:3000`. | None | HIGH |
| **V8** | [App.tsx:L58](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/App.tsx#L58) | Insecure localStorage session flag persists indefinitely. | Remove the localStorage auth flag entirely. | V1 | HIGH |
| **V9** | [App.tsx:L34-36](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/App.tsx#L34-36) | User details initialized to blank strings on page load. | Extract properties from the JWT access token on mount. | V1 | HIGH |
| **V10** | [backend/src/index.ts:L24](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/index.ts#L24) | `cors()` configuration enables all origins. | Restrict CORS origin strictly to `http://localhost:3000`. | None | HIGH |
| **V11** | [auth.controller.ts:L58](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/controllers/auth.controller.ts#L58) | Logout function doesn't clear the database session. | Terminate `AuthSession` in database on logout request. | None | HIGH |
| **V12** | [auth.controller.ts:L47](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/controllers/auth.controller.ts#L47) | Refresh token rotation returns 501 Not Implemented. | Implement proper refresh token rotation. | None | HIGH |
| **V13** | [routes/index.ts:L21](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/routes/index.ts#L21) | `/system-boot` diagnostics exposed to public. | Enforce authentication before exposing system statistics. | None | MEDIUM |
| **V14** | [mfa.controller.ts:L77](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/controllers/mfa.controller.ts#L77) | OTP generated values printed to terminal console logs. | Remove logging statements that display plaintext TOTP secrets or codes. | None | MEDIUM |
| **V15** | [mfa.controller.ts:L189](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/controllers/mfa.controller.ts#L189) | Pre-registration OTP stored in-memory (map). | Create a database table `TempOtp` to persist verification codes. | None | MEDIUM |
| **V16** | [biometricVault.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/services/biometricVault.ts) | Biometrics stored on client with XOR scrambling. | Delete the client biometric vault entirely. | V3 | MEDIUM |
| **V17** | [biometric.controller.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/controllers/biometric.controller.ts) | Enrollment token is never flagged as used. | Update `usedAt` in `EnrollmentToken` during registration. | None | MEDIUM |
| **V18** | [auth.service.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/services/auth.service.ts) | `EnrollmentState.passwordEnrolled` never set to true. | Set `passwordEnrolled = true` on registration transaction. | None | MEDIUM |
| **V19** | [biometric.routes.ts:L27](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/routes/biometric.routes.ts#L27) | `/api/biometric/stats` missing session verification. | Mount `requireActiveSession` before route authorization. | None | MEDIUM |
| **V20** | [backend/.env:L14](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/.env#L14) | WebAuthn origin configuration set to port 8080 instead of 3000. | Update origin value to `http://localhost:3000`. | None | MEDIUM |
| **V21** | [stepUpService.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/services/stepUpService.ts) | Step-up modalities never trigger dynamically on risk score. | Set score threshold check in console to open step-up modal. | None | MEDIUM |
| **V22** | [mfa.routes.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/routes/mfa.routes.ts) | No rate-limiting on TOTP login endpoint. | Attach rate-limiter middleware onto TOTP verification routes. | None | MEDIUM |

---

## 15. UI FLOW TARGET

```
START
↓
SystemBoot
↓
LocalProfile exists?
├── NO → Welcome setup & Register Form (Email, Password)
│          ↓
│        Display MFA Setup QR Code & Verify code
│          ↓
│        Face Enrollment poses (center, left, right, expression)
│          ↓
│        Voice Enrollment (speak phrases)
│          ↓
│        Redirect to Login
└── YES → Select Profile Card
           ↓
         Enter Password / PIN
           ↓
         POST /api/auth/login → obtains challenge sessionId
           ↓
         Face Scan verification UI → uploads blob → verified on backend
           ↓
         Voice Scan verification UI → uploads audio → verified on backend
           ↓
         Enter 6-digit TOTP code
           ↓
         POST /api/mfa/totp/verify-login → returns JWT tokens
           ↓
         Navigate to Dashboard (tab selector)
```

---

## 16. FILE-BY-FILE IMPLEMENTATION ORDER

### PHASE 1: Backend Session Setup & Environment
* [backend/.env](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/.env) - Update JWT secret keys, WebAuthn origin, CORS limits.
* [start-all.bat](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/start-all.bat) - Change launch URL to HTTP.
* [backend/src/services/auth.service.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/services/auth.service.ts) - Upsert password enrollment status.

### PHASE 2: Frontend State Refactoring
* [frontend/types.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/types.ts) - Add stage type declarations.
* [frontend/App.tsx](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/App.tsx) - Replace local variables with token checks, handle refresh states on mount.

### PHASE 3: Biometric & Session Alignment
* [backend/src/controllers/biometric.controller.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/controllers/biometric.controller.ts) - Return complete JWT payloads on verification success.
* [backend/src/controllers/mfa.controller.ts](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/controllers/mfa.controller.ts) - Terminate challenge status on login success.

---

## 17. DO NOT IMPLEMENT

This document is purely diagnostic. Do **NOT** modify files, install packages, write databases, or adjust configurations.

---

## 18. FINAL OUTPUT

### Authentication Architecture Decision

```
[Lock Screen Profile] ──> Enter password/PIN ──> Get sessionId
                                                  │
                                                  ▼
Fully active JWT ◄── Verification (TOTP) ◄── Biometric matching
```

### Critical Implementation Dependencies
1. Fix the configuration crash in `start-all.bat` (change to `http://`).
2. Implement backend session database writes before connecting biometric flows.
3. Link local profile references to database identifiers.

### Files Expected To Change
* **Frontend:** `App.tsx`, `types.ts`, `services/api.ts`, `components/FaceScanner.tsx`, `components/VoiceScanner.tsx`, `components/FinalizingVerification.tsx`, `services/faceVerificationService.ts`, `services/voiceVerificationService.ts`
* **Backend:** `src/controllers/mfa.controller.ts`, `src/controllers/biometric.controller.ts`, `src/services/auth.service.ts`, `src/middleware.ts`, `prisma/schema.prisma`
* **Configuration:** `start-all.bat`

### Files That Should NOT Be Changed
* `biometric-service/face_processor.py` (model loading is correct)
* `backend/src/services/risk.service.ts` (time decay code is correct)

### Risks During Implementation
* **Session Desynchronization:** If the backend DB fails to update state, users will get stuck in intermediate stages.
* **Camera Access Interruption:** Incorrect origin headers will block video streams.

### Testing Requirements
* Verify credentials rejection triggers attempt counts correctly.
* Confirm mock biometric scans fail closed if the python backend is offline.
* Assert that manual navigation to `/dashboard` is redirected back to `/` without active JWT keys.
