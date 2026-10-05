# API_MAP.md
# BioShield MFA — Master Backend API Specification & Contract Dossier

> **Base URL:** `http://localhost:8080/api`  
> **Global Middleware:** Helmet, CORS (`allowedOrigins`), JSON Body Parser (10MB limit), Request Logger, API Rate Limiter (`apiLimiter`, 100 req/15min).

---

## 1. Authentication Routes (`/api/auth`)

### `POST /api/auth/register`
- **Purpose:** Registers a new user account (primary administrator setup or invited user registration).
- **Authentication:** Public or Enrollment Token (`x-enrollment-token` header).
- **Request Body (JSON):**
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!",
    "fullName": "John Doe",
    "behavioralMetrics": { "typingSpeed": 120 },
    "deviceFingerprint": "fp_abc123"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "User registered successfully",
    "userId": "usr_uuid",
    "qrCode": "data:image/png;base64,...",
    "enrollmentToken": "raw_hex_token"
  }
  ```
- **Database Effect:**
  - Creates `User` record with Argon2id `passwordHash`.
  - Creates `TotpSecret` record.
  - Creates `EnrollmentState` with `passwordEnrolled: true`.
  - Creates `EnrollmentToken` with SHA-256 hash.
  - Creates `AuditLog` entry (`USER_REGISTERED`).
- **External Effect:** None.
- **Error Cases:**
  - `400 Bad Request`: User already exists or validation fails (password complexity).

---

### `POST /api/auth/login`
- **Purpose:** Primary credential validation step. Verifies email & password; initiates MFA session.
- **Authentication:** Public (Rate-limited via `loginLimiter`: 20 req/15min, fail-closed Redis).
- **Request Body (JSON):**
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!",
    "behavioralMetrics": { "typingSpeed": 120, "mouseVariance": 0.15 },
    "deviceFingerprint": "fp_abc123"
  }
  ```
- **Response (200 OK — MFA Required):**
  ```json
  {
    "success": true,
    "requiresMfa": true,
    "sessionId": "ses_uuid",
    "userId": "usr_uuid",
    "message": "Password valid, MFA required."
  }
  ```
- **Response (200 OK — Enrollment Incomplete):**
  ```json
  {
    "success": true,
    "requiresEnrollment": true,
    "userId": "usr_uuid",
    "enrollmentToken": "raw_hex_token",
    "message": "Account enrollment incomplete. Please complete biometrics and MFA."
  }
  ```
- **Database Effect:**
  - Creates `AuthSession` in status `CHALLENGE_REQUIRED`.
  - Resets `failedAttempts` to 0 on success; increments on failure.
  - Locks user for 15 mins if `failedAttempts >= 5`.
  - Rehashes legacy bcrypt passwords to Argon2id if valid.
  - Logs `LOGIN_FAILED` or `PASSWORD_VERIFIED` in `AuditLog`.
- **External Effect:** None.
- **Error Cases:**
  - `401 Unauthorized`: Invalid credentials.
  - `403 Forbidden`: Account `DISABLED` or `LOCKED`.
  - `429 Too Many Requests`: Rate limit exceeded.

---

### `POST /api/auth/refresh`
- **Purpose:** Exchange a valid refresh token for a new access token.
- **Authentication:** Refresh token payload.
- **Request Body (JSON):**
  ```json
  { "refreshToken": "jwt_refresh_token" }
  ```
- **Response (501 Not Implemented):**
  ```json
  { "success": false, "message": "Refresh token rotation not fully implemented in prototype yet." }
  ```
- **Database Effect:** None.
- **External Effect:** None.
- **Error Cases:**
  - `400 Bad Request`: Missing refresh token.
  - `501 Not Implemented`: Always returns 501 in current code.

---

### `GET /api/auth/session-status`
- **Purpose:** Polls the active status, expiration, and lifecycle state of an authentication session.
- **Authentication:** `x-session-id` header or `Authorization: Bearer <token>`.
- **Request Headers:** `x-session-id: <sessionId>`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "status": "CHALLENGE_REQUIRED",
    "isActive": true
  }
  ```
- **Database Effect:** None (Read-only query on `AuthSession`).
- **External Effect:** None.
- **Error Cases:**
  - `400 Bad Request`: Missing session identifier.
  - `404 Not Found`: Session not found.
  - `403 Forbidden`: Session identity mismatch against provided token.

---

### `GET /api/auth/enrollment-status`
- **Purpose:** Checks the completion status of all 4 enrollment modalities (Password, Face, Voice, Recovery).
- **Authentication:** `requireActiveSessionOrEnrollmentToken` (`x-session-id` or `x-enrollment-token`).
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "userId": "usr_uuid",
    "passwordEnrolled": true,
    "faceEnrolled": true,
    "voiceEnrolled": false,
    "recoveryConfigured": false
  }
  ```
- **Database Effect:** Upserts default `EnrollmentState` if missing.
- **External Effect:** None.
- **Error Cases:**
  - `401 Unauthorized`: Missing user context or session.
  - `403 Forbidden`: Invalid or expired enrollment token.

---

### `POST /api/auth/generate-challenge`
- **Purpose:** Generates a cryptographically randomized, server-side liveness challenge sequence.
- **Authentication:** `requireActiveSessionOrEnrollmentToken`.
- **Query Parameters:** `?type=FACE` or `?type=VOICE`
- **Response (200 OK — Face Challenge):**
  ```json
  {
    "success": true,
    "challengeId": "ch_uuid",
    "nonce": "c59182879d853c4c800...",
    "sessionId": "ses_uuid",
    "sequence": ["TURN_LEFT", "TURN_RIGHT"],
    "issuedAt": "2026-09-25T15:00:00.000Z",
    "expiresAt": "2026-09-25T15:02:00.000Z",
    "consumed": false
  }
  ```
- **Response (200 OK — Voice Challenge):**
  ```json
  {
    "success": true,
    "challengeId": "ch_uuid",
    "nonce": "c59182879d853c4c800...",
    "sessionId": "ses_uuid",
    "phrase": "blue river",
    "issuedAt": "2026-09-25T15:00:00.000Z",
    "expiresAt": "2026-09-25T15:02:00.000Z",
    "consumed": false
  }
  ```
- **Database Effect:** Inserts `LivenessChallenge` record with 120s TTL.
- **External Effect:** None.
- **Error Cases:**
  - `401 Unauthorized`: Missing session or enrollment token.

---

### `POST /api/auth/continuous-verify`
- **Purpose:** Core background continuous authentication heartbeat (sent by client every 30s).
- **Authentication:** `requireActiveSession` (`Authorization: Bearer <token>`, `x-session-id`).
- **Request (Multipart Form):**
  - `face` (File, Optional): Single webcam JPEG frame.
  - `presence` (Form field, JSON string): `{ "faceDetected": true }`
  - `behavioral` (Form field, JSON string): Keystroke/mouse kinematics.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "sessionStatus": "ACTIVE",
    "action": "ALLOW",
    "reason": "Identity is strongly trusted.",
    "requiredFactors": []
  }
  ```
- **Database Effect:**
  - Evaluates elapsed time since last session update.
  - Injects risk events for stale heartbeats (>36s = 35 sev, >75s = 55 sev, >150s = 85 sev).
  - Updates `AuthSession.status`, `AuthSession.trustState`, and `updatedAt`.
  - Records `TrustEvent` if trust state transitioned.
- **External Effect:** Sends face frame to Python `POST /extract-face`.
- **Error Cases:**
  - `401 Unauthorized`: Missing user or session token.
  - `403 Forbidden`: Session terminated or locked.

---

### `POST /api/auth/logout`
- **Purpose:** Explicit user logout; terminates active session.
- **Authentication:** `requireActiveSession`.
- **Response (200 OK):**
  ```json
  { "success": true, "message": "Logged out successfully" }
  ```
- **Database Effect:** Updates `AuthSession` to `status: 'TERMINATED'`, `isActive: false`.
- **External Effect:** None.

---

### `GET /api/auth/me`
- **Purpose:** Returns currently authenticated user context extracted from JWT and session.
- **Authentication:** `requireActiveSession`.
- **Response (200 OK):**
  ```json
  {
    "user": {
      "id": "usr_uuid",
      "email": "user@bioshield.com",
      "role": "USER",
      "sessionId": "ses_uuid"
    }
  }
  ```

---

### `GET /api/auth/audit`
- **Purpose:** Fetches the last 20 audit events for the authenticated user formatted as timeline items.
- **Authentication:** `requireActiveSession`.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "timeline": [
      {
        "id": "aud_uuid",
        "timestamp": "10:30:15 AM",
        "type": "PASSWORD_VERIFIED",
        "status": "PASSED",
        "description": "Authentication Successful",
        "riskScore": 0,
        "aiExplanation": "{\"sessionId\":\"...\"}"
      }
    ]
  }
  ```

---

## 2. Biometric Routes (`/api/biometric`)

### `POST /api/biometric/register`
- **Purpose:** Enrolls biometric reference templates (face and/or voice).
- **Authentication:** `requireActiveSessionOrEnrollmentToken` (`x-session-id`, `x-enrollment-token`, or Bearer token).
- **Request (Multipart Form):**
  - `face` (File, maxCount 30): Image files for enrollment.
  - `voice` (File, maxCount 1): Audio WAV file for voice enrollment.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Biometrics registered successfully",
    "sampleCount": 1
  }
  ```
- **Database Effect:**
  - Encrypts extracted embeddings using AES-256-GCM (`v1:gcm:iv:authTag:cipher`).
  - Upserts `BiometricProfile` record.
  - Updates `EnrollmentState` (`faceEnrolled: true`, `voiceEnrolled: true`).
- **External Effect:** Sends files to Python `/extract-face` or `/extract-voice-embedding`.
- **Error Cases:**
  - `400 Bad Request`: Blurry face, multiple faces, bad audio, or no usable input.
  - `401 / 403`: Unauthorized or invalid token.

---

### `POST /api/biometric/verify`
- **Purpose:** Verifies a live challenge against enrolled templates during login or step-up.
- **Authentication:** `requireChallengeSession` (`x-session-id` header in intermediate challenge state).
- **Request (Multipart Form):**
  - `challengeId` (Form field): ID of active challenge.
  - `nonce` (Form field): Nonce issued with challenge.
  - `face` (Files): Sequence of frames captured during head movement challenge.
  - `voice` (File, Optional): WAV audio recording of user speaking the challenge phrase.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "status": "FACE_VERIFIED",
    "next": "VOICE",
    "evidences": [...],
    "action": "REQUIRE_MFA",
    "lockout": false
  }
  ```
- **Database Effect:**
  - Marks `LivenessChallenge` as `isConsumed: true`.
  - Increments `biometricAttempts` on failure; locks for 5m if attempts >= 5.
  - Transitions `AuthSession.status` (`CHALLENGE_REQUIRED` -> `FACE_VERIFIED` -> `VOICE_VERIFIED`).
- **External Effect:** Sends multi-frame sequence to Python `/analyze-sequence` and audio to `/extract-voice-embedding`.
- **Error Cases:**
  - `400 Bad Request`: Expired/consumed challenge, nonce mismatch, or sequence incomplete.
  - `404 Not Found`: No biometric profile enrolled.

---

### `POST /api/biometric/revoke`
- **Purpose:** Deletes user's enrolled biometric templates, forcing re-enrollment.
- **Authentication:** `requireActiveSession`.
- **Response (200 OK):**
  ```json
  { "success": true, "message": "Biometric authentication revoked. You must re-enroll to use it again." }
  ```
- **Database Effect:**
  - Deletes `BiometricProfile`.
  - Sets `EnrollmentState.faceEnrolled = false`, `voiceEnrolled = false`.
  - Updates `User.status = 'ENROLLMENT_REQUIRED'`.

---

### `GET /api/biometric/stats`
- **Purpose:** Biometric telemetry metrics for admin analytics.
- **Authentication:** Admin role.
- **Response (200 OK):**
  ```json
  { "success": true, "stats": { "totalEnrolled": 0 } }
  ```
  *(Note: Hardcoded mock in prototype).*

---

## 3. Multi-Factor Authentication Routes (`/api/mfa`)

### `POST /api/mfa/totp/setup`
- **Purpose:** Generates a new TOTP secret and data URL QR code.
- **Authentication:** `requireActiveSessionOrEnrollmentToken`.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "qr": "data:image/png;base64,iVBORw0KGgo..."
  }
  ```
- **Database Effect:** Upserts `TotpSecret` record with Speakeasy base32 secret.

---

### `POST /api/mfa/totp/verify`
- **Purpose:** Verifies TOTP during initial setup / enrollment.
- **Authentication:** `requireActiveSessionOrEnrollmentToken` + `loginLimiter`.
- **Request Body (JSON):**
  ```json
  { "token": "123456" }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "MFA Enabled",
    "isFullyEnrolled": true
  }
  ```
- **Database Effect:** Sets `User.mfaEnabled = true`, `EnrollmentState.recoveryConfigured = true`. If all 4 factors enrolled, sets `User.status = 'ACTIVE'` and deletes enrollment tokens.

---

### `POST /api/mfa/totp/verify-login`
- **Purpose:** Final step of login ceremony. Validates TOTP code and activates session.
- **Authentication:** `requireChallengeSession` (`x-session-id`).
- **Precondition:** Session status must strictly equal `VOICE_VERIFIED`.
- **Request Body (JSON):**
  ```json
  { "userId": "usr_uuid", "token": "123456" }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "status": "ACTIVE",
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token",
    "user": { "id": "...", "email": "...", "role": "..." }
  }
  ```
- **Database Effect:** Finalizes session to `ACTIVE`, sets `trustState = 'TRUSTED'`, saves hashed refresh token.

---

### `POST /api/mfa/send-email-code`
- **Purpose:** Dispatches live TOTP OTP to user's registered email via EmailJS.
- **Authentication:** `requireChallengeSession`.
- **Request Body (JSON):**
  ```json
  { "userId": "usr_uuid" }
  ```
- **Response (200 OK):**
  ```json
  { "success": true, "message": "Email sent" }
  ```
- **External Effect:** Dispatches HTTP POST to `https://api.emailjs.com/api/v1.0/email/send`.

---

### `POST /api/mfa/verify-email`
- **Purpose:** Verifies email OTP code.
- **Authentication:** `requireChallengeSession` + `loginLimiter`.
- **Request Body (JSON):**
  ```json
  { "userId": "usr_uuid", "token": "123456" }
  ```
- **Response (200 OK):**
  ```json
  { "success": true, "message": "Email verified successfully" }
  ```
- **Status:** **DEFECTIVE** (Attempts to decrypt `mfaSecretEnc` with missing `KMS_SECRET` / CBC decipher).

---

### `POST /api/mfa/email/send-pre-reg`
- **Purpose:** Dispatches 6-digit verification code to email before registration account creation.
- **Authentication:** Public.
- **Request Body (JSON):**
  ```json
  { "email": "newuser@example.com" }
  ```
- **Response (200 OK):**
  ```json
  { "success": true, "message": "Verification code sent" }
  ```
- **Database Effect:** Caches OTP in Redis (`bioshield:otp:prereg:<email>`, 300s TTL).
- **External Effect:** Dispatches email via EmailJS API.

---

### `POST /api/mfa/email/verify-pre-reg`
- **Purpose:** Verifies the pre-registration code against Redis cache.
- **Authentication:** Public + `loginLimiter`.
- **Request Body (JSON):**
  ```json
  { "email": "newuser@example.com", "code": "123456" }
  ```
- **Response (200 OK):**
  ```json
  { "success": true, "message": "Email verified successfully" }
  ```
- **Database Effect:** Validates and removes key from Redis if attempts < 3.

---

## 4. WebAuthn / FIDO2 Routes (`/api/webauthn`)

### `POST /api/webauthn/register/options`
- **Purpose:** Generates WebAuthn credential creation options (challenge, RP ID, user ID).
- **Authentication:** `requireActiveSession`.
- **Response (200 OK):** SimpleWebAuthn `PublicKeyCredentialCreationOptionsJSON`.
- **Database Effect:** Caches challenge in Redis (`bioshield:webauthn:challenge:<userId>`).

---

### `POST /api/webauthn/register/verify`
- **Purpose:** Verifies WebAuthn attestation response and stores credential public key.
- **Authentication:** `requireActiveSession`.
- **Response (200 OK):**
  ```json
  { "success": true, "verified": true }
  ```
- **Database Effect:** Inserts `WebAuthnCredential` record.
- **Defect:** Hardcoded origin `http://localhost:5173` fails when frontend runs on port `3000`.

---

### `POST /api/webauthn/authenticate/options` & `POST /api/webauthn/authenticate/verify`
- **Purpose:** Generates challenge and verifies WebAuthn assertion for authentication.
- **Authentication:** `requireChallengeSession`.
- **Defect:** Hardcoded origin `http://localhost:5173`.

---

## 5. Admin Routes (`/api/admin`)

All admin routes require `requireActiveSession` and `authorize(['ADMIN', 'PRIMARY_ADMIN'])`.
High-impact mutation routes additionally enforce `requirePrivilegedAction`.

### `GET /api/admin/overview` (and `POST /api/admin/stats`)
- **Response (200 OK):**
  ```json
  {
    "totalUsers": 5,
    "activeSessions": 2,
    "disabledAccounts": 0,
    "highRiskEvents": 1,
    "unresolvedSecurityEvents": 0
  }
  ```

---

### `GET /api/admin/users`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "usr_uuid",
        "email": "user@bioshield.com",
        "role": "USER",
        "status": "ACTIVE",
        "isActive": true,
        "mfaEnabled": true,
        "createdAt": "..."
      }
    ]
  }
  ```

---

### `POST /api/admin/users`
- **Purpose:** Provisions a new user account and creates a single-use enrollment token.
- **Protection:** `requirePrivilegedAction`.
- **Request Body (JSON):**
  ```json
  {
    "email": "invitee@company.com",
    "fullName": "Jane Doe",
    "role": "USER",
    "password": "TemporaryPassword123!"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "user": { "id": "...", "email": "..." },
      "enrollmentToken": "raw_hex_token"
    }
  }
  ```

---

### `DELETE /api/admin/session/:id`
- **Purpose:** Forces immediate termination of a target user session.
- **Protection:** `requirePrivilegedAction`.
- **Database Effect:** Updates `AuthSession.status = 'TERMINATED'`, `isActive = false`.

---

### `PATCH /api/admin/user/:id/disable` & `PATCH /api/admin/user/:id/enable`
- **Purpose:** Disables or re-enables a target user account.
- **Protection:** `requirePrivilegedAction`.
- **Database Effect:** Updates `User.status = 'DISABLED'` or `'ACTIVE'`.

---

### `POST /api/admin/user/:id/reset-mfa`
- **Purpose:** Resets a user's MFA configurations and forces re-enrollment.
- **Protection:** `requirePrivilegedAction`.
- **Database Effect:** Deletes `TotpSecret`, sets `mfaEnabled = false`, resets `EnrollmentState.recoveryConfigured = false`.

---

### `GET /api/admin/system-health`
- **Purpose:** Probes real connectivity to SQLite DB, Redis Cache, and Python Biometric service.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "status": "HEALTHY",
    "database": { "connected": true, "responseTimeMs": 4 },
    "redis": { "connected": true, "responseTimeMs": 1 },
    "biometricService": { "connected": true, "service": "biometric-engine" }
  }
  ```

---

## 6. Vault & Forensic Routes

### `POST /api/vault/decrypt`
- **Purpose:** Simulates hardware TPM-backed document decryption for sensitive enterprise files.
- **Protection:** `requireActiveSession` + `requirePrivilegedAction`.
- **Request Body (JSON):**
  ```json
  { "documentId": "doc_confidential_01" }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "documentId": "doc_confidential_01",
      "decryptedContent": "Simulated decrypted binary content blob",
      "status": "UNLOCKED"
    }
  }
  ```

---

### `POST /api/forensics/analyze-alert`
- **Purpose:** Performs synthetic deepfake artifact and frequency cutoff analysis on an uploaded media file.
- **Protection:** `requireActiveSession`.
- **Status:** **DEFECTIVE** (Route lacks Multer middleware; `req.file` is always undefined).

---

## 7. System Diagnostics Route

### `GET /api/system-boot`
- **Purpose:** Native Windows hardware attestation telemetry.
- **Authentication:** Public.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "timestamp": "2026-09-25T15:00:00.000Z",
    "device": { "os": "Windows 11 (Build 22631)", "architecture": "x64", "cpuModel": "...", "uptimeHours": 42.5 },
    "security": {
      "secureBoot": { "status": "VERIFIED", "enabled": true },
      "tpm": { "status": "VERIFIED", "present": true, "version": "2.0" },
      "appIntegrity": { "status": "VERIFIED", "sha256": "..." }
    },
    "deviceTrust": { "score": 96, "level": "TRUSTED" }
  }
  ```
