# Phase 3B — Authentication UX & UI Architecture Implementation Plan

This document outlines the detailed implementation plan for simplifying the BioShield frontend user experience, unifying component containers, and consolidating modality panels, while preserving the verified Phase 2 backend authentication architecture.

---

## 1. Final Component Hierarchy

```text
frontend/src/
├── components/
│   ├── auth/
│   │   ├── AuthContainer.tsx           <-- Shared glassmorphic container layout
│   │   ├── StepProgress.tsx            <-- Standardized 4-step progress indicator
│   │   ├── AuthHeader.tsx              <-- Header with title & plain-English guidance
│   │   ├── AuthStatusBanner.tsx        <-- Unified feedback, error, & loading messages
│   │   ├── RecoveryNotice.tsx          <-- Dedicated "Resume Account Setup" banner
│   │   ├── CredentialsLoginForm.tsx    <-- Account password authentication form & profile cards
│   │   ├── AccountSetupForm.tsx        <-- First-time account registration form
│   │   ├── FaceModalityPanel.tsx       <-- Consolidated Face scanner (Enrollment + Verification)
│   │   ├── VoiceModalityPanel.tsx      <-- Consolidated Voice scanner (Enrollment + Verification)
│   │   └── MfaModalityPanel.tsx        <-- Consolidated MFA panel (Setup QR + Verification)
│   └── ...
```

---

## 2. Screen Flows

### Registration Screen Flow
```text
[Step 1: Account Creation]  ──►  [Step 2: Face Enrollment]  ──►  [Step 3: Voice Enrollment]  ──►  [Step 4: MFA Setup]  ──►  [Completion Screen]
 (AccountSetupForm)               (FaceModalityPanel)              (VoiceModalityPanel)             (MfaModalityPanel)           (Active Confirmation)
```

### Login Screen Flow
```text
[Step 1: Password Auth]     ──►  [Step 2: Face Verification] ──►  [Step 3: Voice Verification] ──►  [Step 4: MFA Verification] ──►  [Dashboard Entry]
 (CredentialsLoginForm)            (FaceModalityPanel)              (VoiceModalityPanel)             (MfaModalityPanel)            (SecurityConsole)
```

### Recovery Screen Flow
```text
Profile Card (Lock Screen)
          ↓
CredentialsLoginForm (Password Input)
          ↓
POST /api/auth/login → { requiresEnrollment: true, enrollmentToken }
          ↓
RecoveryNotice Banner ("Resume Account Setup — Step 2: Face Verification")
          ↓
[ Resume Setup Button ] ──► Mounts directly at FaceModalityPanel (or Voice/MFA)
```

---

## 3. Shared vs. Modality Component Responsibilities

### Shared Components (Presentation Layer)
* `AuthContainer`: Manages visual card boundary, background gradients, header title, and sub-views.
* `StepProgress`: Renders progress stepper: `● Identity ─── ○ Face ─── ○ Voice ─── ○ MFA` with completion checkmarks (`✓`).
* `AuthHeader`: Displays clear plain-English answers to: *Where am I?*, *Why am I doing this?*, and *What happens next?*.
* `RecoveryNotice`: Displays explicit notice when resuming an interrupted registration.

### Modality Components (UI + Service Integration)
* `FaceModalityPanel`: Renders camera viewport, liveness prompt, progress ring, and status messages. Delegates frame capture and server API calls to `faceVerificationService`.
* `VoiceModalityPanel`: Renders passphrase prompt, microphone status, soundwave visualizer, and recording controls. Delegates audio capture to `voiceVerificationService`.
* `MfaModalityPanel`: Renders QR code barcode (for registration) or 6-digit TOTP input fields (for login). Delegates API verification calls to `api.ts`.

> [!IMPORTANT]
> Modality components handle **UI rendering and user interactions only**. All cryptography, token validation, biometric embedding processing, and session state transitions remain strictly delegated to existing frontend services (`faceVerificationService`, `voiceVerificationService`, `api.ts`) and backend APIs.

---

## 4. Components Strategy (Merge, Create, Delete, Preserve)

| Action | Component Name | Rationale & Details |
| --- | --- | --- |
| **CREATE** | `AuthContainer.tsx` | Central unified container for registration and login. |
| **CREATE** | `StepProgress.tsx` | Standardized 4-step progress bar component. |
| **CREATE** | `RecoveryNotice.tsx` | Banner component for interrupted registration resumption. |
| **CREATE** | `FaceModalityPanel.tsx` | Consolidated component merging `FaceScanner.tsx` and `FaceEnrollmentCeremony.tsx`. |
| **CREATE** | `VoiceModalityPanel.tsx` | Consolidated component merging `VoiceScanner.tsx` and `VoiceEnrollmentCeremony.tsx`. |
| **CREATE** | `MfaModalityPanel.tsx` | Consolidated component merging `MfaUnlockView.tsx` and `EnrollView` MFA setup card. |
| **MERGE / REFACTOR** | `BehavioralLogin.tsx` | Refactored to delegate to `AuthContainer` and unified modality panels. |
| **MERGE / REFACTOR** | `EnrollView.tsx` | Refactored to use `AuthContainer` and unified modality panels. |
| **MERGE / REFACTOR** | `PasswordUnlockView.tsx` | Refactored into `CredentialsLoginForm.tsx`. |
| **DELETE** | `UnlockView.tsx` | Removed legacy workstation PIN unlock view to eliminate PIN confusion. |
| **PRESERVE** | `api.ts`, `faceVerificationService.ts`, `voiceVerificationService.ts`, `authFlowService.ts`, `localProfileService.ts` | All service files and backend endpoints remain 100% preserved and untouched. |

---

## 5. State / Prop Contracts

```typescript
// Step Definition Type
export type AuthStep = 'IDENTITY' | 'FACE' | 'VOICE' | 'MFA' | 'COMPLETE';
export type AuthMode = 'REGISTRATION' | 'LOGIN' | 'RECOVERY';

// Shared AuthContainer Props
export interface AuthContainerProps {
    mode: AuthMode;
    currentStep: AuthStep;
    completedSteps: AuthStep[];
    title: string;
    description: string;
    nextInstruction?: string;
    children: React.ReactNode;
    onCancel?: () => void;
}

// StepProgress Props
export interface StepProgressProps {
    mode: AuthMode;
    currentStep: AuthStep;
    completedSteps: AuthStep[];
}

// FaceModalityPanel Props
export interface FaceModalityPanelProps {
    mode: AuthMode;
    userId: string;
    sessionId?: string;
    enrollmentToken?: string;
    onSuccess: () => void;
    onError: (message: string) => void;
}

// VoiceModalityPanel Props
export interface VoiceModalityPanelProps {
    mode: AuthMode;
    userId: string;
    sessionId?: string;
    enrollmentToken?: string;
    onSuccess: () => void;
    onError: (message: string) => void;
}

// MfaModalityPanel Props
export interface MfaModalityPanelProps {
    mode: AuthMode;
    userId: string;
    sessionId?: string;
    enrollmentToken?: string;
    onSuccess: (data?: any) => void;
    onError: (message: string) => void;
}
```

---

## 6. Exact Files Subject to Modification

1. `frontend/App.tsx`: Update routes to use unified `AuthContainer` and simplified step navigation.
2. `frontend/components/BehavioralLogin.tsx`: Update view switching to integrate `AuthContainer`.
3. `frontend/components/login/PasswordUnlockView.tsx`: Refactor into `CredentialsLoginForm.tsx` with explicit account password labels.
4. `frontend/components/login/EnrollView.tsx`: Refactor to consume unified modality panels.
5. `frontend/components/FaceScanner.tsx` & `FaceEnrollmentCeremony.tsx`: Merge into `FaceModalityPanel.tsx`.
6. `frontend/components/VoiceScanner.tsx` & `VoiceEnrollmentCeremony.tsx`: Merge into `VoiceModalityPanel.tsx`.
7. `frontend/components/login/MfaUnlockView.tsx`: Refactor into `MfaModalityPanel.tsx`.

---

## 7. Exact Files to Preserve

* `frontend/services/api.ts`
* `frontend/services/faceVerificationService.ts`
* `frontend/services/voiceVerificationService.ts`
* `frontend/services/authFlowService.ts`
* `frontend/services/authFlowController.ts`
* `frontend/services/localProfileService.ts`
* `backend/src/middleware.ts`
* `backend/src/controllers/mfa.controller.ts`
* `backend/src/controllers/biometric.controller.ts`
* `backend/src/controllers/auth.controller.ts`
* `backend/src/services/auth.service.ts`

---

## 8. UI Terminology Standardization Map

| Current Technical Term | Public Security Term | Context & Guidance |
| --- | --- | --- |
| Behavioral Login | Secure Login | System portal title. |
| BioIdentity Verification | Identity Verification | Header step title. |
| BioShield Pipeline | Security Check | Process description. |
| Unlock Workstation | Sign In | Primary action button. |
| Face Scanner | Face Verification | Modality title. |
| Voice Scanner | Voice Verification | Modality title. |
| MFA Unlock | MFA Verification | Modality title. |
| Enrollment Ceremony | Account Setup | Registration flow title. |
| Embedding Generated | Face Detected | Real-time status feedback. |
| Liveness Score | Identity Check | Real-time status feedback. |
| Speaker Confidence | Voice Verified | Real-time status feedback. |

---

## 9. UI State Matrix (Loading, Error, Success, Retry)

| Component State | Visual Representation | User Message / Action |
| --- | --- | --- |
| **Idle / Ready** | Blue camera/mic/shield icon, clean borders | "Click Start Scan when ready" |
| **Scanning / Recording** | Pulsing blue/indigo ring, animated soundwave | "Scanning face... / Recording voice..." |
| **Processing** | Centered spinner with glowing aura | "Verifying credentials with backend..." |
| **Success** | Green checkmark animation, green border glow | "Face verified successfully. Proceeding..." |
| **Failure / Retry** | Amber/Red warning border, retry button | "Verification failed. Position face clearly and click Retry." |
| **Recovery Resume** | Blue recovery notice box with list of steps | "Resuming setup at Step 2: Face Verification." |

---

## 10. Responsive Layout Strategy

* **Container Boundary**: `max-w-xl` (576px wide) centered card with glassmorphism (`bg-white/90 backdrop-blur-xl border border-slate-200/80 shadow-2xl rounded-3xl`).
* **Viewport Adaptability**: Full responsive scaling for mobile screens (`px-4`, `py-6`), tablet, and desktop displays.
* **Camera / Canvas Views**: Responsive `aspect-[4/3]` camera container with rounded corners (`rounded-2xl`).

---

## 11. Security Invariants

> [!CAUTION]
> Phase 3 UI implementation MUST NOT modify the following Phase 2 backend security contracts:
> 1. `POST /api/auth/register` creates `User.status = 'ENROLLMENT_REQUIRED'`.
> 2. `enrollmentToken` remains memory-only and transient.
> 3. `POST /api/auth/login` returns `{ requiresEnrollment: true }` without issuing session/JWT for incomplete accounts.
> 4. `requireActiveSessionOrEnrollmentToken` middleware derives canonical `req.user` from database-verified token or active session.
> 5. `User.status` transitions to `ACTIVE` only in `verifyTotpSetup` when `passwordEnrolled`, `faceEnrolled`, `voiceEnrolled`, and `recoveryConfigured` are all `true`.
> 6. Temporary enrollment tokens are deleted upon account activation.

---

## 12. Implementation Order

1. **Step 1 — Create Shared Auth Components**:
   * Create `AuthContainer.tsx`, `StepProgress.tsx`, `AuthHeader.tsx`, `RecoveryNotice.tsx`.
2. **Step 2 — Create Modality Panels**:
   * Create `FaceModalityPanel.tsx` (consolidating face scanning logic).
   * Create `VoiceModalityPanel.tsx` (consolidating voice recording logic).
   * Create `MfaModalityPanel.tsx` (consolidating TOTP setup & login logic).
3. **Step 3 — Create Unified Credentials Form**:
   * Create `CredentialsLoginForm.tsx` (replacing `UnlockView` & `PasswordUnlockView`).
4. **Step 4 — Refactor Registration & Login Views**:
   * Update `EnrollView.tsx` and `BehavioralLogin.tsx` to use the unified components.
5. **Step 5 — Update App Routes & Verify Complete Journey**:
   * Update `App.tsx` routes to mount unified containers.

---

## 13. Verification Strategy

1. **Frontend Compilation Check**: Execute `npm run build` in `frontend/` to verify zero TypeScript or bundle errors.
2. **Backend Regression Check**: Execute all backend integration test suites (`mfa-enrollment-fix.ts`, `phase1-e2e.ts`, `milestone2.test.ts`, `adaptive-auth.test.ts`).
3. **End-to-End User Experience Journey Verification**:
   * Journey 1: New User Registration -> Face -> Voice -> MFA Setup -> Complete -> Dashboard.
   * Journey 2: Existing User Login -> Face -> Voice -> MFA Verification -> Dashboard.
   * Journey 3: Registration Interruption & Recovery -> Resume notice banner -> Direct step resumption.
   * Journey 4: Negative Paths (Wrong password, biometric mismatch, invalid TOTP code, expired token).
