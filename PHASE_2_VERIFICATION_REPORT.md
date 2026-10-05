# Phase 2 — Frontend Session State Management Verification Report

This document reports the architectural verification findings for Phase 2: Frontend Session State Management. 

---

## 1. Authentication Entry

### Finding:
* The current `BehavioralLogin.tsx` lock screen UI still performs local verification of the profile PIN before calling the auth callback:
  ```typescript
  // frontend/components/login/PinUnlockView.tsx: Line 32
  const valid = localProfileService.validatePin(profile.id, pin);
  if (valid) {
      setVerifying(false);
      onSuccess(); // triggers the MainApp handleCredentialsSuccess callback
  }
  ```
* Once local validation succeeds, `MainApp.handleCredentialsSuccess` registers the user on-the-fly if not present, and authenticates the user on the Node backend (`POST /api/auth/login`) using the email `${profile.id}@bioshield.local` and a hardcoded developer password `'Password123!'` to obtain the database `sessionId` in `CHALLENGE_REQUIRED` state.
* **Blocker Status:** **YES**. While the session is created and tracked on the backend, the PIN/password check itself is still evaluated locally in the browser rather than by the backend auth service. This must be refactored during the Phase 3 login screen rewrite.

---

## 2. Session Storage

A search for active token references in the frontend code confirms that all active tokens are now strictly loaded and saved using `sessionStorage`:

| Key Name | Storage Target | Status | Usage |
|---|---|---|---|
| `accessToken` | `sessionStorage` | **CORRECT** | Passed in `Authorization: Bearer` headers. |
| `refreshToken` | `sessionStorage` | **CORRECT** | Used to request new tokens. |
| `sessionId` | `sessionStorage` | **CORRECT** | Enforced as the single canonical key. |
| `currentSessionId` | N/A | **CLEANED** | 0 remaining occurrences. |
| `bioshield_authenticated_session` | `localStorage` | **LEAK** | Used only in `authFlowController.ts` helper flags which are bypassed in App.tsx. Must be deleted in Phase 3. |

---

## 3. Dashboard Authorization

* **Validation:** **CONFIRMED**.
* Access to `/dashboard`, `/admin/*`, and `/profiles/*` requires that `stage === AuthStage.DASHBOARD`. 
* The state variable `stage` is strictly derived from the backend session status:
  - On mount/reload: `restoreSession()` queries `/api/auth/session-status` using the stored `sessionId`. If the status is not strictly `'ACTIVE'` or if `isActive` is false, it forces a lock out.
  - On login completion: `stage` is updated to `AuthStage.DASHBOARD` only after `/api/mfa/totp/verify-login` successfully completes and returns valid JWTs.

---

## 4. Session Status Endpoint

The backend implementation of `getSessionStatus` in `auth.controller.ts` enforces the following rules:

* **Headers required:** `x-session-id` and optional `Authorization` Bearer token.
* **User/Session validation:** 
  - If a JWT bearer token is present, it is verified. The database session must match the JWT's claims (`decoded.id === session.userId`), preventing session-status probing by other authenticated users.
  - If no JWT is present, it is treated as an intermediate challenge session check, returning only the minimum status fields:
    ```json
    { "success": true, "status": session.status, "isActive": session.isActive }
    ```
* **Invalid Session cases:**
  - Missing header: Returns `400 Bad Request`.
  - Non-existent sessionId: Returns `404 Not Found`.
  - Expired session (`now > expiresAt`): Returns `{ success: true, status: "TERMINATED", isActive: false }`.
  - Identity mismatch: Returns `403 Forbidden`.
* Arbitrary session enumeration is **impossible** as no user profiles or secrets are exposed, and active sessions require a matching JWT signature to query.

---

## 5. Page Refresh Recovery

When the page is refreshed during any step of the authentication ceremony, `restoreSession()` requests the status from the backend database and recovers the exact screen:

* **Refresh during FACE:** Status is `CHALLENGE_REQUIRED`. Navigates to `/verify/face` (stage `FACE_SCAN`).
* **Refresh during VOICE:** Status is `FACE_VERIFIED`. Navigates to `/verify/voice` (stage `VOICE_VERIFY`).
* **Refresh during MFA:** Status is `VOICE_VERIFIED`. Navigates to `/verify/mfa` (stage `MFA_VERIFY`).
* **Refresh after ACTIVE:** Status is `ACTIVE`. Verifies matching JWT token, retains dashboard session (stage `DASHBOARD`).
* **Refresh after TERMINATED:** Status is `TERMINATED` (or inactive/not found). Clears storage via `handleLock()` and redirects to `/`.

---

## 6. Route Bypass

Routes are protected by `VerifyGuard` using local state `stage` mapped from the backend session:

* `/` (Login): Allowed for `stage = LOGIN` or redirects to intermediate page.
* `/verify/face`: Requires `stage = AuthStage.FACE_SCAN`.
* `/verify/voice`: Requires `stage = AuthStage.VOICE_VERIFY`.
* `/verify/mfa`: Requires `stage = AuthStage.MFA_VERIFY`.
* `/dashboard` & `/profiles/*` & `/admin/*`: Requires `stage = AuthStage.DASHBOARD`.

All manual URL changes that violate these guards trigger immediate redirect to the correct stage.

---

## 7. Biometric Flow

* **Inferred Success Prevention:** **CONFIRMED**.
* When biometrics complete:
  - Face scanner verifies, calls `onComplete`.
  - `handleStageComplete('FACE')` does not assume success. It fetches `session-status` from the backend to verify that the backend updated the DB status to `FACE_VERIFIED` before navigating to the voice page.
  - Voice scanner verifies, calls `onComplete`.
  - `handleStageComplete('VOICE')` fetches status from backend to verify it is `VOICE_VERIFIED` before navigating to the MFA page.
* Frontend never manufactures verification stages independently.

---

## 8. Voice Architecture

* **Flow:** Browser Audio → Node Backend (`http://localhost:8080/api/biometric/verify`) → Python Biometric Service (Port 5000).
* There are **zero** browser-to-Python direct authentication paths remaining. The Python port 5000 is isolated from the client.

---

## 9. Logout

* **Trace:** 
  1. User clicks Logout.
  2. `handleLock()` sets `isAuthenticated` to false, wipes sessionStorage keys, and navigates to `/`.
  3. Sends `POST /api/auth/logout` to the backend.
  4. Backend updates database: `status = 'TERMINATED'`, `isActive = false`.
  5. Subsequent dashboard routes or refresh queries are rejected.

---

## 10. Phase 2 Testing

* **behavioral Verification status:** **NOT TESTED**.
* We did not create automated E2E tests for the frontend router/recovery layer. Behavior was verified by compilation checks (`npm run build`) and manual verification plans.

---

## 11. Security Findings

### 1. Hardcoded Backend Password in Login Loop [HIGH]
* **Risk:** All local lock screen profiles are authenticated on the backend using the standard developer password `'Password123!'`.
* **Blocker:** Yes. This must be refactored during the Phase 3 login screen rewrite to verify real passwords against the backend.

### 2. Local PIN Validation Gate [HIGH]
* **Risk:** The PIN check is still processed locally in `PinUnlockView.tsx`.
* **Blocker:** Yes. This local verification must be removed in Phase 3.

### 3. Bypassed Token Cleanups in authFlowController.ts [MEDIUM]
* **Risk:** The legacy `bioshield_authenticated_session` local storage flag remains in `authFlowController.ts`.
* **Blocker:** No (since the main router `App.tsx` no longer trusts this flag, it is not a direct route bypass vulnerability). Must be cleaned up in Phase 3.

---

## 12. Final Decision

# NOT READY FOR PHASE 3

### Blockers:
1. **Local PIN Check:** `PinUnlockView.tsx` still performs client-side validation of the user's PIN instead of hitting the backend database.
2. **Hardcoded Credentials Loop:** `handleCredentialsSuccess` registers/logs in the user with a hardcoded password `'Password123!'` rather than validating real user passwords.
3. **Bypassed Key Cleanups:** The legacy key `bioshield_authenticated_session` must be completely removed from `authFlowController.ts`.
