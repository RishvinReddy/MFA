# Phase 3A — Authentication UX & User-Flow Audit Report

This report presents the complete audit of the frontend user experience, component layout, and navigation flows against the verified backend authentication state machine.

---

## 1. Current Journeys Overview

### Current Registration Journey
```text
BehavioralLogin (view: ENROLL) ──► EnrollView
                                        │
                                        ├── Step 1: Account Form (Name, Email, Password, PIN)
                                        ├── Step 2: Face Enrollment (FaceEnrollmentCeremony)
                                        ├── Step 3: Voice Enrollment (VoiceEnrollmentCeremony)
                                        └── Step 4: MFA Setup (QR Code + Code Verification)
```

### Current Login Journey
```text
App.tsx (Route "/") ──► BehavioralLogin ──► ProfileSelector / PasswordUnlockView
                                                   │
                                                   ▼ (POST /api/auth/login -> sessionId)
                                            Navigate /verify/face
                                                   │
                                                   ▼ (AppLayout + StepIndicator + FaceScanner)
                                            Navigate /verify/voice
                                                   │
                                                   ▼ (AppLayout + StepIndicator + VoiceScanner)
                                            Navigate /verify/mfa
                                                   │
                                                   ▼ (AppLayout + StepIndicator + MfaUnlockView)
                                            Navigate /dashboard
```

### Current Recovery Journey
```text
Browser Refresh / Relaunch
        ↓
ProfileSelector (Incomplete Profile Card)
        ↓
PasswordUnlockView ("Unlock Profile" prompt)
        ↓
POST /api/auth/login returns { requiresEnrollment: true, enrollmentToken }
        ↓
BehavioralLogin sets view to ENROLL (EnrollView with resume token)
        ↓
GET /api/auth/enrollment-status
        ↓
Mounts at incomplete step inside EnrollView
```

---

## 2. Current UI vs. Backend State Mapping

| Backend State | API Response | Frontend Component | Rendered UI Element | Issues / Mismatches |
| --- | --- | --- | --- | --- |
| **Unauthenticated** | N/A | `ProfileSelector` / `PasswordUnlockView` | Profile cards, Password input form | Works, but password unlock view says "Unlock Profile" instead of "Authenticate Account". |
| `ENROLLMENT_REQUIRED` | `{ requiresEnrollment: true, enrollmentToken }` | `EnrollView` | Multi-step enrollment modal | Uses circular step wizard separate from normal login layout. |
| `CHALLENGE_REQUIRED` | `{ requiresMfa: true, sessionId }` | `FaceScanner` (`/verify/face`) | Tech HUD face scanner card | Route guard checks session status asynchronously; temporary blank state on refresh. |
| `FACE_VERIFIED` | `{ status: "FACE_VERIFIED" }` | `VoiceScanner` (`/verify/voice`) | Split 2-column voice scanner | Visual layout completely different from Face scanner screen. |
| `VOICE_VERIFIED` | `{ status: "VOICE_VERIFIED" }` | `MfaUnlockView` (`/verify/mfa`) | Compact numeric keypad TOTP form | Visual styling and button layouts differ from biometric screens. |
| `ACTIVE` | `{ accessToken, refreshToken }` | `SecurityConsole` (`/dashboard`) | Security dashboard console | Seamless transition once tokens are set. |

---

## 3. Identified UX / UI Problems

### Critical Severity
1. **Dual Component Duplication for Biometrics**:
   - `FaceScanner.tsx` (Login) vs `FaceEnrollmentCeremony.tsx` (Registration): Separate implementations with duplicate camera video element setup and canvas frame extraction logic.
   - `VoiceScanner.tsx` (Login) vs `VoiceEnrollmentCeremony.tsx` (Registration): Separate implementations with duplicate AudioContext and wave visualizer code.
   - `MfaUnlockView.tsx` (Login) vs MFA Step in `EnrollView.tsx` (Registration): Separate TOTP code verification UI cards.
2. **Dual Step Wizard & Layout Inconsistency**:
   - Registration uses `EnrollView` with a circular step modal card.
   - Login uses `AppLayout` with top navbar + `StepIndicator` pill bar + full-page route views (`/verify/face`, `/verify/voice`, `/verify/mfa`).
   - This creates visual fragmentation where registration and login feel like two entirely separate applications.

### High Severity
3. **Confusing Terminology**:
   - Terms like "BioIdentity Verification", "BioShield Pipeline", "Behavioral Login", "Secure Action", "Unlock Workstation", and "Profile Key" are mixed with standard identity terms ("Email Login", "Registration", "MFA Setup").
4. **Misleading Step Indicators**:
   - Login's `StepIndicator` displays `(1 / 4) Face`, `(2 / 4) Voice`, `(3 / 4) MFA`. Step 4 (Dashboard/Complete) is omitted, making step 3 of 4 feel like an incomplete progress bar.
   - Registration's step indicator displays `Step 1 of 4` Account, `Step 2 of 4` Face, `Step 3 of 4` Voice, `Step 4 of 4` MFA.
5. **Over-Exposed Technical Details**:
   - `FaceEnrollmentCeremony` displays raw ONNX model loading logs, vector dimensions, raw embedding numbers, and face bounding box parameters directly to end users.
   - `VoiceEnrollmentCeremony` displays raw decibel numbers, audio sample rates, and FFT buffer sizes.
6. **Abrupt Recovery & Completion Transitions**:
   - When resuming incomplete registration after entering a password, the UI immediately jumps into the wizard without an explicit notification banner explaining: *"Resuming setup at Step 2 (Face Enrollment)"*.
   - When completing MFA setup during registration, the wizard completes without a clear celebratory success screen explaining: *"Account fully enrolled and activated. You can now log in."*

### Medium Severity
7. **Inconsistent Component Layouts**:
   - Face Verification uses a 5xl centered HUD card.
   - Voice Verification uses a split 2-column layout.
   - MFA Verification uses a compact 1-column card with a numeric keypad.
8. **Unnecessary Local PIN UI**:
   - `UnlockView.tsx` renders a 6-digit PIN keypad labeled "Enter Workstation PIN". Because primary backend authentication uses real account passwords, this PIN screen creates confusion for users logging into backend accounts.

### Low Severity
9. **Async Guard Blank Frame**:
   - Navigating directly to `/verify/face` triggers `VerifyGuard` to fetch `session-status` from backend. Before the fetch resolves, a brief blank frame occurs.

---

## 4. Recommended Simplified Target User Journey

We recommend unifying all authentication pathways under **One Single Coherent Verification Container Component** with identical styling, layout, progress indicators, and visual headers.

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 BIOSHIELD AUTHENTICATION                               │
│                                                                                        │
│        MODE: [ REGISTRATION ] or [ AUTHENTICATION ]                                    │
│        PROGRESS: (1) Account  ───  (2) Face  ───  (3) Voice  ───  (4) MFA              │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│                                  STEP CONTENT PANEL                                    │
│                                                                                        │
│   • Step Title & Plain English Guidance                                                │
│   • Modality Scanner / Verification Panel (Unified Layout)                            │
│   • Real-Time Status Feedback (Scanning, Verified, Failed)                             │
│   • Explicit Action Controls (Start Scan, Re-record, Verify Code, Continue)            │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Recommended Standardized Terminology

| Current Term | Recommended Standard Term | Rationale |
| --- | --- | --- |
| `BehavioralLogin` | `Authentication Portal` | Clear, user-centric identity portal title. |
| `EnrollView` | `Account Registration` | Standard industry naming. |
| `PasswordUnlockView` | `Account Login` | Explicit credential authentication prompt. |
| `BioIdentity Verification` | `Identity Verification` | Simple, clear progress header. |
| `Unlock Workstation` | `Sign In` | Removes workstation/OS lock screen ambiguity. |
| `Unlock Profile` | `Account Password Required` | Explains why password is being requested during recovery. |

---

## 6. Proposed Component Architecture & Responsibilities

```text
frontend/
├── components/
│   ├── auth/
│   │   ├── AuthContainer.tsx         <-- Single wrapper with header, step bar, & footer
│   │   ├── StepProgress.tsx          <-- Unified 4-step progress bar component
│   │   ├── AccountSetupForm.tsx      <-- Clean registration form
│   │   ├── CredentialsLoginForm.tsx  <-- Clean login form & profile selector
│   │   ├── FaceModalityPanel.tsx     <-- Unified Face scanner (Enrollment + Verification)
│   │   ├── VoiceModalityPanel.tsx    <-- Unified Voice scanner (Enrollment + Verification)
│   │   ├── MfaModalityPanel.tsx      <-- Unified TOTP MFA panel (Setup + Verification)
│   │   └── RecoveryNoticeBanner.tsx  <-- Banner informing user of resumed enrollment
```

---

## 7. Exact Files Subject to Modification in Phase 3B

1. [`frontend/App.tsx`](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/App.tsx): Simplify routing and use unified `AuthContainer`.
2. [`frontend/components/BehavioralLogin.tsx`](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/components/BehavioralLogin.tsx): Simplify view switching logic and delegate to unified auth components.
3. [`frontend/components/login/PasswordUnlockView.tsx`](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/components/login/PasswordUnlockView.tsx): Update labels and recovery state prompts.
4. [`frontend/components/login/EnrollView.tsx`](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/components/login/EnrollView.tsx): Refactor to use unified `StepProgress` and modality panels.
5. [`frontend/components/FaceScanner.tsx`](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/components/FaceScanner.tsx) & [`FaceEnrollmentCeremony.tsx`](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/components/FaceEnrollmentCeremony.tsx): Consolidate into unified `FaceModalityPanel`.
6. [`frontend/components/VoiceScanner.tsx`](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/components/VoiceScanner.tsx) & [`VoiceEnrollmentCeremony.tsx`](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/components/VoiceEnrollmentCeremony.tsx): Consolidate into unified `VoiceModalityPanel`.
7. [`frontend/components/login/MfaUnlockView.tsx`](file:///c:/Users/Amruth/Desktop/bioshield-mfa-2025%20v9%2031%20july/frontend/components/login/MfaUnlockView.tsx): Refactor into unified `MfaModalityPanel`.

---

## 8. What MUST NOT Be Changed in Backend Architecture

> [!IMPORTANT]
> The following backend security guarantees verified in Phase 2 MUST remain 100% untouched during Phase 3 UI work:
> 1. `POST /api/auth/register` creates `User.status = 'ENROLLMENT_REQUIRED'`.
> 2. `enrollmentToken` remains memory-only and transient.
> 3. `POST /api/auth/login` returns `{ requiresEnrollment: true }` without issuing session/JWT for incomplete accounts.
> 4. `requireActiveSessionOrEnrollmentToken` middleware derives canonical `req.user` from database-verified token or active session.
> 5. `User.status` transitions to `ACTIVE` only in `verifyTotpSetup` when `passwordEnrolled`, `faceEnrolled`, `voiceEnrolled`, and `recoveryConfigured` are all `true`.
> 6. Token deletion occurs upon user activation.

---

## 9. Final Conclusion & Phase 3 Roadmap

Decision: **AUDIT COMPLETE — READY FOR PHASE 3B IMPLEMENTATION PLAN**

By consolidating component duplication, standardizing step progress indicators, using clear non-technical guidance, and adopting a unified card layout, Phase 3B will transform the BioShield frontend into a modern, state-of-the-art, intuitive authentication experience.
