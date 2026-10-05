# Phase 1 — Backend Authentication State Analysis

This document outlines the authoritative backend authentication state machine, session lifecycle constraints, and required code adjustments to implement a secure, multi-stage identity verification pipeline before modifying any source code.

---

## 1. CURRENT AUTHSESSION SCHEMA

From the database schema defined in [`backend/prisma/schema.prisma:L109-140`](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/prisma/schema.prisma#L109-140):

* **`id` (String, `@id @default(uuid())`):** 
  * *Purpose:* Primary key; unique identifier for the authentication session. Passed between frontend and backend as `sessionId` or `x-session-id`.
  * *Writes:* Created on session generation; read in subsequent calls.
  * *Value:* Random UUID.
* **`userId` (String):** 
  * *Purpose:* Foreign key mapping this session to the associated user record.
  * *Writes:* Created on session generation.
  * *Value:* Unique user UUID.
* **`ipAddress` (String):** 
  * *Purpose:* Auditing the source IP address of the login attempt.
  * *Writes:* Extracted from `req.ip` on login.
  * *Value:* E.g., `"127.0.0.1"` or `"unknown"`.
* **`device` (String):** 
  * *Purpose:* Fingerprint identifying the hardware device.
  * *Writes:* Stored during password login.
  * *Value:* E.g., user-supplied fingerprint or `"unknown"`.
* **`riskLevel` (String?):** 
  * *Purpose:* Risk severity assessment from the Risk Engine.
  * *Writes:* Read and updated during adaptive evaluations.
  * *Value:* `"LOW"`, `"MEDIUM"`, `"HIGH"`, `"CRITICAL"`, or `"PENDING"`.
* **`identityConfidence` (Float?):** 
  * *Purpose:* Aggregated identity confidence score computed by the Fusion Engine.
  * *Writes:* Adaptive evaluation updates.
  * *Value:* `0.0` to `1.0`.
* **`trustState` (String?):** 
  * *Purpose:* Internal state from the Trust Engine reflecting hysteresis level.
  * *Writes:* Adaptive evaluation updates.
  * *Value:* `"TRUSTED"`, `"OBSERVE"`, `"CHALLENGE"`, `"RESTRICTED"`, `"LOCKED"`.
* **`status` (String, `@default("ACTIVE")`):** 
  * *Purpose:* Overall status of the session. Represents the gate value.
  * *Writes:* Password login, adaptive evaluations, admin revokes, finalization.
  * *Value:* `"ACTIVE"`, `"CHALLENGE_REQUIRED"`, `"STEP_UP_REQUIRED"`, `"RESTRICTED"`, `"LOCKED"`, `"TERMINATED"`.
* **`mfaUsed` (String?):** 
  * *Purpose:* Tracks the MFA factor type completed for this session.
  * *Writes:* Never written in current controllers (**NOT USED**).
  * *Value:* E.g., `"TOTP"`, `"EMAIL"`.
* **`mfaRequired` (Boolean, `@default(false)`):** 
  * *Purpose:* Flag indicating if MFA is mandatory for this session.
  * *Writes:* Set to `true` on login creation.
  * *Value:* `true` or `false`.
* **`isSuccessful` (Boolean, `@default(false)`):** 
  * *Purpose:* General flag indicating if the session is fully completed.
  * *Writes:* Set to `true` inside `finalizeSession()`.
  * *Value:* `true` or `false`.
* **`isActive` (Boolean, `@default(true)`):** 
  * *Purpose:* Quick boolean check if session is active.
  * *Writes:* Initialized to `true` on creation. Never set to `false` during standard logout or revocation (**NOT FULLY USED**).
  * *Value:* `true` or `false`.
* **`expiresAt` (DateTime?):** 
  * *Purpose:* Session absolute expiration date.
  * *Writes:* Set during `finalizeSession()` to 7 days from creation.
  * *Value:* ISO Date String.
* **`refreshTokenHash` (String?):** 
  * *Purpose:* SHA-256 hash of the generated refresh token. Used to validate token rotations.
  * *Writes:* Set during `finalizeSession()`.
  * *Value:* Hex hash.
* **`previousRefreshTokenHash` (String?):** 
  * *Purpose:* SHA-256 hash of the previous refresh token to prevent replay attacks.
  * *Writes:* Never written in current controllers (**NOT USED**).
  * *Value:* Hex hash.
* **`userAgent` (String?):** 
  * *Purpose:* Web browser user-agent header.
  * *Writes:* Stored during password login.
  * *Value:* Request browser agent string.
* **`biometricScore` (Float?):** 
  * *Purpose:* Biometric match verification score.
  * *Writes:* Never written in current controllers (**NOT USED**).
  * *Value:* Float.
* **`biometricType` (String?):** 
  * *Purpose:* Modality type verified.
  * *Writes:* Never written in current controllers (**NOT USED**).
  * *Value:* `"FACE"`, `"VOICE"`.

---

## 2. TRACE EVERY AUTH SESSION WRITE

| File | Function | Operation | Current State | New State | Trigger |
|---|---|---|---|---|---|
| [`auth.service.ts`](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/services/auth.service.ts#L162) | `login` | `create` | None | `"CHALLENGE_REQUIRED"` | Password verified successfully |
| [`auth.service.ts`](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/services/auth.service.ts#L201) | `finalizeSession` | `update` | `"CHALLENGE_REQUIRED"` | `"ACTIVE"` | Identity verification successfully completed |
| [`adaptiveAuth.service.ts`](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/services/adaptiveAuth.service.ts#L94) | `evaluateAuthenticationEvent` | `update` | Stored session status | `policyDecision.nextSessionState` | Biometric verification evaluated |
| [`admin.controller.ts`](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/controllers/admin.controller.ts#L159) | `revokeSession` | `update` | `"ACTIVE"` | `"TERMINATED"` | Admin clicks session revoke |
| [`admin.controller.ts`](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/controllers/admin.controller.ts#L198) | `disableUser` | `updateMany` | Any in `['ACTIVE', 'CHALLENGE_REQUIRED', 'STEP_UP_REQUIRED']` | `"TERMINATED"` | Admin disables user profile |
| [`admin.controller.ts`](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/controllers/admin.controller.ts#L226) | `forceLogout` | `updateMany` | Any in `['ACTIVE', 'CHALLENGE_REQUIRED', 'STEP_UP_REQUIRED']` | `"TERMINATED"` | Admin forces user logout |

---

## 3. TRACE SESSION CREATION

When a client hits `POST /api/auth/login`:
1. **User Lookup:** Queries `prisma.user.findUnique({ where: { email } })` in `auth.service.ts:L92`.
2. **Password Verification:** Calls `CryptoService.verifyPassword()` in `auth.service.ts:L118` to check the password hash using Argon2id. If the password matches and is marked as needing rehash, it generates a new Argon2id hash and saves it.
3. **Session Creation:** Creates a new session record in SQLite (`AuthSession`) with the following fields:
   * `userId`: Associated user ID.
   * `ipAddress`: E.g., `req.ip` or `'unknown'`.
   * `device`: Fingerprint supplied from request or `'unknown'`.
   * `status`: `"CHALLENGE_REQUIRED"` (hardcoded).
   * `mfaRequired`: `true` (hardcoded).
   * `isSuccessful`: `false` (default).
   * `riskLevel`: `"PENDING"`.
4. **Response:** Returns:
   ```json
   {
     "success": true,
     "requiresMfa": true,
     "sessionId": "session-uuid-string",
     "userId": "user-uuid-string",
     "message": "Password valid, MFA required."
   }
   ```

---

## 4. TRACE BIOMETRIC SESSION TRANSITIONS

### When Face Biometric Succeeds:
1. `POST /api/biometric/verify` receives `face` file.
2. Queries the database biometric profile. Compares live embedding with stored embedding using Euclidean distance.
3. If matches: sets `faceResult.status = 'PASS'`.
4. Calls `AdaptiveAuthenticationService.evaluateAuthenticationEvent`.
5. Since stage is `'CONTINUOUS'`, it evaluates with the Policy Engine. If `completedFactors` contains only `['FACE']` (assuming face passes and voice has not yet run), the policy action returns `REQUIRE_MFA` requesting `['VOICE']`.
6. `AuthSession` is updated in `adaptiveAuth.service.ts:L94` to state `CHALLENGE_REQUIRED`.
7. `biometric.controller.ts` sees `authenticated = false` because `decision.action` is not `ALLOW`.
8. The session remains in `CHALLENGE_REQUIRED` status. It does **not** call `finalizeSession()`, does **not** generate JWTs, and does **not** transition `AuthSession` status to `ACTIVE`.

### When Voice Biometric Succeeds:
1. `POST /api/biometric/verify` receives `voice` file.
2. Calls Python `/compare-voice?profile_id=<profileId>` to compare voice MFCC embeddings.
3. If similarities match: sets `voiceResult.status = 'PASS'`.
4. Calls `AdaptiveAuthenticationService.evaluateAuthenticationEvent`.
5. If both face and voice have now passed, `completedFactors` contains `['FACE', 'VOICE']`. The Trust Engine sets the trust state to `TRUSTED`. The Policy Engine returns `ALLOW`.
6. `AuthSession` is updated to status `ACTIVE` in `adaptiveAuth.service.ts:L94`.
7. In `biometric.controller.ts:L213`, `authenticated` is evaluated as `true`.
8. The controller calls `authService.finalizeSession()`, which updates `AuthSession` status to `ACTIVE`, creates access/refresh tokens, and writes the `refreshTokenHash` to the database.

---

## 5. IMPORTANT ARCHITECTURAL DECISION

### Current Design: Model A
The backend biometric endpoint is currently designed to transition the session to `ACTIVE` once biometrics pass (Model A), bypassing the TOTP MFA requirement:
* Credentials Login (`CHALLENGE_REQUIRED`) → Face Verification → Voice Verification → trustState evaluates as `TRUSTED` → policy action evaluates as `ALLOW` → session becomes `ACTIVE` (MFA is bypassed).

### Required Design: Model B
The target system must require all factors (Credentials → Face → Voice → TOTP) before the session transitions to `ACTIVE`:
* Credentials Login (`CHALLENGE_REQUIRED`)
* Face Verification (`FACE_VERIFIED` intermediate status)
* Voice Verification (`VOICE_VERIFIED` intermediate status)
* TOTP Verification (`MFA_VERIFIED` / final check) → only here does session status become `ACTIVE`.

### Smallest Safe Modification to Support Model B:
1. Change the Policy Engine (`policy.service.ts`) to prevent returning `ALLOW` after biometrics pass. It should require `TOTP` next.
2. Change `verifyBiometric` in `biometric.controller.ts` to **never** call `finalizeSession()`. It should only update the session status to indicate biometric completion.
3. Require the client to send the TOTP challenge to `POST /api/mfa/totp/verify-login` as the final step.
4. Have `verifyLoginTotp` in `mfa.controller.ts` call `finalizeSession()` to transition the session to `ACTIVE` and generate the final JWT tokens.

---

## 6. DESIGN THE AUTH SESSION STATE MACHINE

To avoid database migrations, we must represent the intermediate verification states within the existing schema. 

### Proposed State Machine:
* **`CHALLENGE_REQUIRED`:** Initial state after password login.
* **`FACE_VERIFIED`:** Face biometric matched. (We can store this inside `AuthSession.trustState` as `"FACE_VERIFIED"` or update `AuthSession.status` to `"FACE_VERIFIED"`. Since `status` is a free text string in Prisma, we can safely set `AuthSession.status = "FACE_VERIFIED"`).
* **`VOICE_VERIFIED`:** Voice biometric matched. We can set `AuthSession.status = "VOICE_VERIFIED"`.
* **`ACTIVE`:** TOTP validated. Final token generation.

This uses the existing `status` string field in Prisma without needing database migrations.

---

## 7. MFA SESSION FINALIZATION

When `POST /api/mfa/totp/verify-login` is invoked:
1. **Validation:** Checks if `x-session-id` is provided in headers. `requireChallengeSession` middleware ensures the session is present and has status `CHALLENGE_REQUIRED`.
2. **Intermediate Checks:** We must update the middleware or controller to ensure the session status is `"VOICE_VERIFIED"` (confirming biometrics were completed) instead of allowing users to bypass biometrics.
3. **MFA Verification:** Verifies the 6-digit TOTP token against the user's secret.
4. **Finalization:** Calls `AuthService.finalizeSession(sessionId, userId, 'TRUSTED')` to update the session status to `ACTIVE` in the DB and generate access/refresh tokens.

---

## 8. TOKEN GENERATION

From [`authUtils.ts`](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/authUtils.ts#L9-22) and [`auth.service.ts`](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/backend/src/services/auth.service.ts#L195-200):

* **Access Token Payload:**
  ```json
  {
    "id": "user-uuid-string",
    "email": "user-email-string",
    "role": "USER_ROLE_STRING"
  }
  ```
* **Refresh Token Payload:** Identical structure as access token.
* **Expiration:** Access token expires in 15 minutes (`'15m'`); refresh token in 7 days (`'7d'`).
* **Claims mapping:** The tokens contain `id`, `email`, and `role`. They do **not** contain `sessionId` or `username` (fullName).

### Smallest Safe Change:
Update `finalizeSession` to include `sessionId` in the JWT token payload:
```typescript
const tokenPayload = { id: user.id, email: user.email, role: user.role, sessionId };
```
This enables the frontend to extract and store the `sessionId` directly from the token.

---

## 9. LOGOUT

To invalidate the session on the backend:
1. **Route definition:** `POST /api/auth/logout` is currently protected by `requireActiveSession`.
2. **Implementation:** Update `logout` in `auth.controller.ts` to read the user's session ID from the decoded JWT payload (leveraging the `sessionId` claim added in section 8):
   ```typescript
   const sessionId = (req as any).user?.sessionId;
   if (sessionId) {
       await prisma.authSession.update({
           where: { id: sessionId },
           data: { status: 'TERMINATED', isActive: false }
       });
   }
   ```
3. **Middleware Gate:** Update `requireActiveSession` in `middleware.ts` to lookup the session in the database if the JWT contains `sessionId`. If the session status is `"TERMINATED"`, reject the request with `403 Forbidden: Session revoked`.

---

## 10. REFRESH TOKEN

The `POST /api/auth/refresh` route returns a `501 Not Implemented` error in `auth.controller.ts:L52`.

* **`RefreshToken` schema:**
  * Maps `token` (plaintext hash), `userId`, `expiresAt`, `createdAt`.
* **Database relationship:** None directly to the `AuthSession` except via `AuthSession.refreshTokenHash`.
* **State of implementation:** Implementing token rotation requires significant state management for token revocation and replay attacks.
* **Can it be deferred?** Yes. We can safely defer the token refresh implementation to a later phase. During Phase 1, we can extend the JWT access token expiry to `1h` (1 hour) to ensure development testing is not disrupted.

---

## 11. SECURITY GATES

After Phase 1 implementation:

* **Requirement A (No Face-only ACTIVE):** True. Biometric verify only transitions session status to `FACE_VERIFIED`.
* **Requirement B (No Face+Voice-only ACTIVE):** True. Biometrics transition status to `VOICE_VERIFIED` but do not call `finalizeSession()`.
* **Requirement C (No TOTP-only ACTIVE):** True. `verifyLoginTotp` checks that the session status is `"VOICE_VERIFIED"` before allowing TOTP token verification.
* **Requirement D (No Terminated session API access):** True. Middleware `requireActiveSession` rejects terminated session IDs.
* **Requirement E (No Local bypass):** True. Dashboard requires a valid access token in `sessionStorage` and verifies it against the backend.
* **Requirement F (No Terminated JWT access):** True. Terminated session records in the DB will invalidate any request carrying that `sessionId` in the JWT.

---

## 12. PROPOSED CHANGE LOCATION SUMMARY

### Files & Functions to Modify in Phase 1

1. **`backend/prisma/schema.prisma`**
   * No schema changes required (we will reuse the `status` and `trustState` string fields).
2. **`backend/src/services/policy.service.ts`**
   * Modify `evaluate` (L28) to require `TOTP` after biometrics are completed.
3. **`backend/src/controllers/biometric.controller.ts`**
   * Modify `verifyBiometric` (L127) to update session status to `"FACE_VERIFIED"` or `"VOICE_VERIFIED"` instead of finalizing the session.
4. **`backend/src/controllers/mfa.controller.ts`**
   * Modify `verifyLoginTotp` (L146) to assert that the session status is `"VOICE_VERIFIED"` and call `authService.finalizeSession` on success.
5. **`backend/src/services/auth.service.ts`**
   * Modify `finalizeSession` (L191) to add `sessionId` into the JWT payload.
   * Modify `login` (L90) to ensure the newly created session starts with `"CHALLENGE_REQUIRED"` status.
6. **`backend/src/controllers/auth.controller.ts`**
   * Modify `logout` (L58) to query and update the session status to `"TERMINATED"`.
7. **`backend/src/middleware.ts`**
   * Modify `requireActiveSession` (L63) to validate the `sessionId` from the decoded token against the database session status.
   * Modify `requireChallengeSession` (L115) to support intermediate status values (`"FACE_VERIFIED"`, `"VOICE_VERIFIED"`).
8. **`start-all.bat`**
   * Change frontend launch URL to `http://localhost:3000`.

---

## 13. RISKS & MIGRATION

* **Risk of Stuck Sessions:** If the user refreshes the page during intermediate states (`FACE_VERIFIED`), the frontend state is reset. If the frontend cannot retrieve the session status on mount, the user is locked out.
  * *Mitigation:* Ensure that on mount, if a `sessionId` is present in `sessionStorage`, the frontend calls a status query endpoint (`GET /api/auth/session-status`) to restore the exact state machine stage.
* **Existing Session Invalidation:** Implementing this state machine will invalidate existing active sessions.
  * *Mitigation:* Run prisma migrations / cleanup script to clear stale session database tables before starting the server.

---

## 14. TESTING REQUIREMENTS

* **Credentials login:** Confirm that entering valid credentials returns a session ID and sets DB session to `CHALLENGE_REQUIRED`.
* **Biometric verification steps:**
  * Verify that completing face biometric updates DB session to `FACE_VERIFIED`.
  * Verify that completing voice biometric updates DB session to `VOICE_VERIFIED`.
* **Access Control checks:**
  * Try calling TOTP verification with a session in `CHALLENGE_REQUIRED` status (should fail with `403 Forbidden`).
  * Verify that a session in `VOICE_VERIFIED` status succeeds on TOTP check and transitions to `ACTIVE`.
* **Revocation/Logout:** Call logout and assert that database status changes to `TERMINATED`. Try calling a protected route using the terminated JWT (should be rejected).
* **Camera / HTTP check:** Confirm camera opens and frame capture operates successfully over `http://localhost:3000`.

---

*End of Phase 1 Backend Authentication Analysis.*
