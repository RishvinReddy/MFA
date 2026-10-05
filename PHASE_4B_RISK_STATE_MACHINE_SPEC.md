# Phase 4B — Risk Model & Post-Login State Machine Specification

This document provides the formal design specification for post-authentication continuous monitoring, heartbeat API contracts, time-decayed risk evaluation, and adaptive step-up enforcement.

---

## 1. Baseline Isolation Constraint

Initial authentication and continuous post-login monitoring are strictly decoupled:

```text
INITIAL AUTHENTICATION BASELINE (Phases 2–3)
[Password] ──► [Face] ──► [Voice] ──► [TOTP MFA] ──► AuthSession.status = ACTIVE
                                                                │
                                                                ▼
POST-AUTHENTICATION CONTINUOUS PROTECTION (Phase 4)
Continuous Heartbeat ──► Risk Engine ──► Trust Engine ──► Policy Engine ──► Step-Up / Lock / Continue
```

> [!IMPORTANT]
> The initial authentication state machine MUST NOT be modified during Phase 4. Continuous monitoring activates **only after** `AuthSession.status === 'ACTIVE'`.

---

## 2. Post-Login State Machine Specification

### Formal State Transition Table

| Current `status` | Current `trustState` | Trigger / Event | Evaluated Risk Level | New `status` | New `trustState` | Policy Action |
| --- | --- | --- | --- | --- | --- | --- |
| `ACTIVE` | `TRUSTED` | Normal 30s Heartbeat | `LOW` (0–19) | `ACTIVE` | `TRUSTED` | `ALLOW` |
| `ACTIVE` | `TRUSTED` | Mild Behavioral Anomaly | `MEDIUM` (20–49) | `ACTIVE` | `OBSERVE` | `OBSERVE` |
| `ACTIVE` | `OBSERVE` | Presence Restored | `LOW` (0–19) | `ACTIVE` | `TRUSTED` | `ALLOW` |
| `ACTIVE` | `OBSERVE` | Stale Heartbeat (60s) | `HIGH` (50–79) | `STEP_UP_REQUIRED` | `CHALLENGE` / `RESTRICTED` | `REQUIRE_MFA` |
| `ACTIVE` | `TRUSTED` | Sudden Anomaly / Sensitive Action | `HIGH` (50–79) | `STEP_UP_REQUIRED` | `CHALLENGE` / `RESTRICTED` | `REQUIRE_MFA` |
| `STEP_UP_REQUIRED` | `CHALLENGE` | Step-Up Verification PASS | `LOW` (0–19) | `ACTIVE` | `TRUSTED` | `ALLOW` |
| `STEP_UP_REQUIRED` | `CHALLENGE` | Step-Up Verification FAIL | `CRITICAL` (80–100) | `LOCKED` | `LOCKED` | `LOCK` |
| `ACTIVE` | Any | Heartbeat Timeout (≥ 120s) | `CRITICAL` (80–100) | `LOCKED` | `LOCKED` | `LOCK` |
| Any | Any | User Logout | N/A | `TERMINATED` | `LOCKED` | `LOCK` |

---

## 3. Authoritative Session States & Frontend Mappings

```text
                                 ┌──────────────┐
                                 │    ACTIVE    │  (Full Dashboard Access)
                                 └──────┬───────┘
                                        │
                         Elevated Risk / Stale Heartbeat
                                        │
                                        ▼
                                ┌────────────────┐
                                │STEP_UP_REQUIRED│ (Dashboard Paused + StepUpModal Overlay)
                                └──────┬─────────┘
                                       │
                     ┌─────────────────┴─────────────────┐
                     ▼                                   ▼
              Step-Up PASS                        Step-Up FAIL
                     │                                   │
              Restore ACTIVE                      Lock & Terminate Session
```

| Backend `AuthSession.status` | Backend `trustState` | Frontend UI State | Route Access |
| --- | --- | --- | --- |
| `ACTIVE` | `TRUSTED` | Normal Dashboard | Full Access |
| `ACTIVE` | `OBSERVE` | Monitored Dashboard (Background logging) | Full Access |
| `STEP_UP_REQUIRED` | `CHALLENGE` / `RESTRICTED` | Dashboard Paused + `StepUpModal` Overlay | Restricted (`403 STEP_UP_REQUIRED`) |
| `RESTRICTED` | `RESTRICTED` | Read-Only Dashboard | Admin Actions Blocked (`403 RESTRICTED`) |
| `LOCKED` | `LOCKED` | Lock Screen Displayed | All Routes Blocked (`403 LOCKED`) |
| `TERMINATED` | `LOCKED` / N/A | Login Screen | All Routes Blocked (`403 TERMINATED`) |

---

## 4. Heartbeat API Contract

Post-login continuous monitoring sends periodic evidence payloads from the client to the backend decision engine.

### Request Specification
* **Endpoint**: `POST /api/v1/auth/continuous-verify`
* **Headers**:
  * `Authorization: Bearer <accessToken>`
  * `x-session-id: <sessionId>`
* **Payload Structure**:
  ```json
  {
    "timestamp": "2026-08-20T10:41:00.000Z",
    "nonce": "a1b2c3d4-e5f6-7890",
    "presence": {
      "faceDetected": true,
      "lastActiveSecondsAgo": 5
    },
    "behavioral": {
      "mouseVelocityVariance": 0.14,
      "keyFlightTimeVariance": 0.08
    }
  }
  ```

### Response Specification (ALLOW)
```json
{
  "success": true,
  "sessionStatus": "ACTIVE",
  "trustState": "TRUSTED",
  "riskLevel": "LOW",
  "action": "ALLOW"
}
```

### Response Specification (STEP_UP_REQUIRED)
```json
{
  "success": false,
  "sessionStatus": "STEP_UP_REQUIRED",
  "trustState": "RESTRICTED",
  "riskLevel": "HIGH",
  "action": "REQUIRE_MFA",
  "reason": "Presence missing > 60s or behavioral anomaly detected"
}
```

---

## 5. Heartbeat Stale & Timeout Rules

The backend decision engine evaluates missed or delayed heartbeats using the following rule thresholds:

```text
0s ────────────── 30s ────────────── 60s ──────────────────────── 120s ──────────────► Time
  Normal Heartbeat      Delayed (+15 Risk)     Stale (+35 Risk)          Abandoned Session (+80 Risk)
  STATUS: ACTIVE        STATUS: ACTIVE         STATUS: STEP_UP_REQUIRED  STATUS: LOCKED
```

| Missing Heartbeat Duration | Risk Event Severity | Evaluated Risk Level | `AuthSession.status` | Policy Action |
| --- | --- | --- | --- | --- |
| `0 - 29 seconds` | 0 | `LOW` | `ACTIVE` | `ALLOW` |
| `30 - 59 seconds` | +15 | `MEDIUM` | `ACTIVE` | `OBSERVE` |
| `60 - 119 seconds` | +35 | `HIGH` | `STEP_UP_REQUIRED` | `REQUIRE_MFA` |
| `≥ 120 seconds` | +80 | `CRITICAL` | `LOCKED` | `LOCK` |

---

## 6. Step-Up Verification Semantics

```text
                       RISK ENGINE EVALUATION (Backend)
                                     │
                                     ▼
                      PolicyEngine: REQUIRE_MFA (High Risk)
                                     │
                                     ▼
                    AuthSession.status = STEP_UP_REQUIRED
                                     │
                                     ▼
                    Frontend Detects State via Heartbeat
                                     │
                                     ▼
                           StepUpModal Displays
                                     │
                                     ▼
                     User Scans Face (FaceModalityPanel)
                                     │
                                     ▼
                   POST /api/biometric/verify (stage: STEP_UP)
                                     │
                                     ▼
               AdaptiveAuthenticationService.evaluate(stage: STEP_UP)
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
           Step-Up PASS                             Step-Up FAIL
                 │                                       │
    AuthSession.status = ACTIVE             AuthSession.status = LOCKED
    TrustState = TRUSTED                    Session Terminated
    Modal Closes                            Redirect to Login
```

> [!CAUTION]
> The `StepUpModal` is purely a presentation layer. It **MUST NEVER** set `isAuthenticated: true` or close itself independently. The modal resolves only when the backend returns `sessionStatus: 'ACTIVE'` following biometric template verification.

---

## 7. Security Invariants

1. **Backend Authority**: Risk engine calculations, trust states, and policy actions are computed exclusively on the backend.
2. **Heartbeat Evidence**: A heartbeat payload is evidence supplied to the decision engine; receiving a heartbeat does not automatically mean the user is authenticated.
3. **No Auth Machine Modifications**: Initial login routes (`/verify/face`, `/verify/voice`, `/verify/mfa`) and `ENROLLMENT_REQUIRED` state transitions remain 100% isolated and unchanged.
4. **Step-Up Verification**: Step-up challenges must be verified against backend stored templates using `AdaptiveAuthenticationService.evaluate(stage: 'STEP_UP')`.

---

## 8. Milestone Sub-Phase Sequence

* **Phase 4A**: Continuous-authentication audit (**COMPLETE**)
* **Phase 4B**: Risk model & post-login state-machine specification (**COMPLETE & APPROVED**)
* **Phase 4C**: Background heartbeat & continuous monitoring implementation
* **Phase 4D**: Adaptive step-up & unified verification UI integration
* **Phase 4E**: End-to-end continuous authentication security & performance audit
