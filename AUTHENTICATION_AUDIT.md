# Authentication System — Full Project Audit

You are auditing an existing authentication/security application.

**IMPORTANT:**
Do NOT modify, refactor, delete, rename, or create any files yet.

Your job in this phase is ONLY to inspect the complete project and report how the current system actually works.

The project is intended to be a:

**Secure Desktop Authentication and System Protection Application**

The application includes authentication, biometric verification, MFA, risk-based authentication, continuous/behavioral verification, session protection, and a security-focused UI.

I suspect there are inconsistencies and bugs in:

* Login flow
* Registration/enrollment flow
* User flow
* Authentication state management
* Biometric/camera flow
* MFA flow
* Protected routes
* Session handling
* Logout flow
* Security checks
* UI/UX flow
* Error handling
* Frontend/backend communication
* HTTP/HTTPS/camera permissions
* Component navigation
* Authentication edge cases

I need a complete factual audit of the CURRENT implementation.

---

## 1. PROJECT STRUCTURE

Inspect the complete project structure.

Report:

* Frontend framework
* Backend framework
* Database
* Authentication libraries
* Biometric libraries
* MFA implementation
* State management
* Routing
* API architecture
* Security-related services
* Important configuration files
* Environment/configuration files
* Major components
* Major services
* Major hooks
* Major middleware
* Major database models/schemas

Create a concise architecture tree showing the important files and folders.

For example:

```
Frontend
├── routes
├── pages
├── components
├── services
├── hooks
└── state

Backend
├── routes
├── controllers
├── services
├── middleware
├── models
└── database
```

Do not assume anything. Inspect the actual files.

---

## 2. COMPLETE USER JOURNEY

Trace the actual user journey from beginning to end.

Document what happens when a completely new user:

1. Opens the application
2. Reaches the landing/login screen
3. Creates an account
4. Enters username/email/password
5. Enrolls biometric information
6. Grants camera permission
7. Completes biometric enrollment
8. Configures MFA
9. Finishes registration
10. Attempts first login
11. Enters credentials
12. Performs biometric verification
13. Performs MFA
14. Enters the protected application
15. Uses the application
16. Encounters continuous authentication
17. Fails a security check
18. Gets challenged again
19. Logs out
20. Attempts to access the application again

For EVERY step identify:

* Screen/page
* Component
* Route
* API endpoint
* Backend service
* Database interaction
* Authentication state change
* Navigation action
* Security decision
* Expected behavior
* Actual behavior

Clearly distinguish:

**EXPECTED FLOW**

from

**CURRENT IMPLEMENTED FLOW**

---

## 3. LOGIN FLOW AUDIT

Trace the login flow in code.

Answer precisely:

### Credentials

* Where are credentials collected?
* How are they validated?
* Where is password verification performed?
* Is the password ever sent/stored insecurely?
* What happens on incorrect credentials?

### Authentication state

Identify:

* access token/session mechanism
* refresh token mechanism if any
* cookies/localStorage/sessionStorage usage
* authentication context/store
* logged-in state
* initialization state
* loading state
* logout state

Explain exactly how the frontend knows:

"User is authenticated"

and how the backend knows the same.

### Login sequence

Determine whether the actual sequence is:

```
Credentials
→ biometric
→ MFA
→ risk assessment
→ session creation
→ dashboard
```

or something different.

Show the exact current sequence.

---

## 4. REGISTRATION / ENROLLMENT FLOW

Audit the complete registration process.

Determine:

* Account creation
* Password creation
* Password validation
* Biometric enrollment
* Camera initialization
* Permission handling
* Face detection
* Face capture
* Template/embedding creation
* Template storage
* MFA enrollment
* Recovery mechanism
* Registration completion
* Redirect/navigation

Identify whether registration can become partially completed.

For example:

```
User creates account
→ biometric enrollment fails
→ user leaves page
→ account exists but biometric is missing
```

Determine whether the application handles this correctly.

---

## 5. BIOMETRIC / CAMERA FLOW

This is especially important.

Inspect every file related to:

* camera
* webcam
* MediaDevices API
* getUserMedia
* face detection
* face recognition
* biometric enrollment
* biometric verification
* permissions
* HTTPS
* localhost
* browser security restrictions

Explain:

1. How the camera is requested
2. When permission is requested
3. What happens if permission is denied
4. What happens if permission is granted
5. What happens if no camera exists
6. What happens if the camera is already in use
7. How the video stream is started
8. How the video stream is stopped
9. Whether streams are properly cleaned up
10. Whether multiple camera requests can happen
11. Whether biometric verification actually succeeds
12. Whether the biometric result affects authentication state

Also inspect the current HTTP/HTTPS setup.

Determine:

* frontend URL
* backend URL
* API URL
* whether HTTP is used
* whether HTTPS is configured
* certificate configuration
* localhost behavior
* browser security restrictions
* CORS
* secure cookies
* camera permission requirements

Explain why the current HTTPS/camera behavior may be failing.

---

## 6. MFA FLOW

Inspect the MFA implementation.

Determine:

* MFA method
* enrollment process
* verification process
* secret generation
* QR code generation if applicable
* OTP validation
* backup/recovery mechanism
* MFA state
* failed attempts
* retry behavior

Trace:

```
Login
→ credentials
→ biometric
→ MFA
→ authenticated session
```

Determine if MFA can be bypassed accidentally through frontend navigation, API calls, route manipulation, or state manipulation.

---

## 7. ROUTING AND PROTECTED ROUTES

Inspect every route.

Create a table:

| Route | Public/Protected | Authentication Required | MFA Required | Biometric Required | Current Behavior |
| ----- | ---------------- | ----------------------- | ------------ | ------------------ | ---------------- |

Check whether protected pages can be accessed directly by entering their URL.

Check:

* route guards
* middleware
* frontend protection
* backend authorization
* redirect behavior
* loading states
* unauthenticated access
* partially authenticated states

Pay particular attention to the difference between:

AUTHENTICATED

and

FULLY VERIFIED.

If the application has multiple authentication stages, document them separately.

---

## 8. AUTHENTICATION STATE MACHINE

Determine whether the application implicitly or explicitly has states such as:

```
UNAUTHENTICATED
↓
CREDENTIALS_VERIFIED
↓
BIOMETRIC_PENDING
↓
BIOMETRIC_VERIFIED
↓
MFA_PENDING
↓
FULLY_AUTHENTICATED
↓
CONTINUOUS_VERIFICATION
↓
REAUTHENTICATION_REQUIRED
↓
LOCKED
↓
LOGGED_OUT
```

Determine the actual implementation.

If this state model does not exist explicitly, infer the current state transitions from the code.

Identify inconsistent or impossible states.

Example:

```
Frontend thinks user is authenticated
but backend session is invalid.
```

Or:

```
Biometric verification is incomplete
but dashboard is accessible.
```

---

## 9. CONTINUOUS AUTHENTICATION

Inspect all continuous authentication / behavioral authentication code.

Determine:

* What is monitored?
* When monitoring starts?
* When monitoring stops?
* What signals are collected?
* How risk score is calculated?
* What thresholds exist?
* What happens when risk increases?
* What happens when risk becomes critical?
* Does the system lock the user?
* Does it request reauthentication?
* Is the mechanism actually connected to authorization?

Trace the complete flow from:

```
User enters dashboard
→ monitoring starts
→ behavior collected
→ risk calculated
→ threshold crossed
→ security action
```

Determine whether this is actually implemented or only represented in the UI.

---

## 10. RISK ENGINE

Inspect the risk scoring implementation.

Identify:

* risk factors
* weights
* thresholds
* scoring algorithm
* default values
* APIs
* frontend/backend responsibilities
* security actions

Provide the actual formula if one exists.

Example:

```
Risk Score =
  credential risk
+ biometric risk
+ behavioral risk
+ device risk
+ session risk
```

Do not invent a formula if none exists.

---

## 11. SESSION MANAGEMENT

Audit:

* session creation
* expiration
* idle timeout
* token expiration
* refresh
* logout
* session invalidation
* multiple sessions
* browser refresh
* page reload
* closing/reopening browser
* expired sessions

Determine whether a logged-out user can continue accessing protected APIs.

---

## 12. API SECURITY

Inspect backend endpoints.

Create a table:

| Endpoint | Method | Purpose | Authentication | Authorization | Validation | Security Issues |
| -------- | ------ | ------- | -------------- | ------------- | ---------- | --------------- |

Check:

* authentication middleware
* authorization
* input validation
* rate limiting
* CORS
* CSRF protection where applicable
* password handling
* sensitive data exposure
* error responses
* logging
* secrets

Do not expose actual secrets or environment values in the report.

---

## 13. DATABASE / DATA MODEL

Inspect database models/schema.

Document:

* User
* Credentials
* Biometric data/template
* MFA data
* Sessions
* Risk data
* Security events
* Audit logs

Identify relationships.

Pay special attention to whether raw biometric data is stored.

Determine:

* what biometric information is stored
* where it is stored
* whether it is encrypted
* whether it is hashed
* whether it can be reconstructed
* whether raw images are retained

---

## 14. ERROR HANDLING

Trace failure cases.

At minimum inspect:

* wrong password
* unknown user
* camera permission denied
* camera unavailable
* biometric mismatch
* biometric service unavailable
* MFA failure
* expired session
* backend unavailable
* network error
* invalid token
* unauthorized API
* registration interrupted
* page refresh during authentication

For each determine:

* backend response
* frontend handling
* user-visible message
* navigation
* security consequence

---

## 15. UI/UX AUDIT

Inspect the actual UI implementation.

Do NOT judge only individual components.

Evaluate the complete user journey.

Identify:

### Navigation problems

* confusing navigation
* dead-end screens
* unnecessary screens
* inconsistent back behavior
* incorrect redirects

### Authentication UX

* unclear authentication stage
* confusing loading states
* unclear errors
* repeated prompts
* unclear biometric instructions
* unclear MFA instructions

### Visual hierarchy

Check:

* typography
* spacing
* cards
* buttons
* forms
* status indicators
* security indicators
* information density
* dashboard complexity

### Consistency

Check:

* button styles
* colors
* spacing
* icons
* terminology
* headings
* error states
* success states

### Accessibility

Check:

* keyboard navigation
* labels
* contrast
* focus states
* screen-reader semantics
* form errors

---

## 16. UI FLOW VS SECURITY FLOW

This is critical.

Determine whether the UI accurately represents the actual security state.

For example:

If the UI says:

> "Identity verified"

but the backend has only verified the password, identify it.

If the UI says:

> "Secure session"

but no session security mechanism exists, identify it.

If biometric verification visually succeeds but authentication state does not change correctly, identify it.

Create a table:

| UI Claim | Actual Backend State | Match? | Problem |
| -------- | -------------------- | ------ | ------- |

---

## 17. SECURITY VULNERABILITY REVIEW

Perform a defensive security review.

Look specifically for:

* authentication bypass
* authorization bypass
* protected-route bypass
* token exposure
* insecure storage
* weak password handling
* biometric data exposure
* MFA bypass
* session fixation
* session persistence after logout
* insecure CORS
* insecure cookies
* missing validation
* client-side-only security checks
* sensitive information in errors
* race conditions
* duplicate authentication requests

Classify each issue:

```
CRITICAL
HIGH
MEDIUM
LOW
UX
ARCHITECTURAL
```

Do not exploit anything externally. Review the source code only.

---

## 18. BUILD / RUNTIME PROBLEMS

Inspect package configuration, scripts, environment configuration, and build setup.

Identify:

* build errors
* dependency conflicts
* deprecated packages
* incorrect scripts
* environment mismatches
* development-only assumptions
* localhost assumptions
* HTTPS configuration issues
* frontend/backend port mismatches

---

## 19. ACTUAL FLOW DIAGRAM

Based strictly on the code, produce an ASCII flow diagram showing the current authentication flow.

Example:

```
START
↓
Landing Page
↓
Login
↓
Credentials
↓
Backend Verification
↓
Biometric
↓
MFA
↓
Session
↓
Dashboard
↓
Continuous Verification
↓
Risk Decision
├── LOW    → Continue
├── MEDIUM → Reverify
└── HIGH   → Lock / Logout
```

Again, use ONLY what actually exists.

---

## 20. IDEAL FLOW PROPOSAL

After documenting the current implementation, propose a corrected target flow.

Separate this section clearly as:

**PROPOSED TARGET FLOW**

Do not modify code.

The target flow should prioritize:

* security
* simplicity
* predictable state transitions
* clear UX
* proper error recovery
* biometric reliability
* MFA reliability
* protected routes
* session security
* continuous verification

---

## 21. FINAL AUDIT SUMMARY

End the report with these sections:

### A. Critical Problems

List only the most important issues.

### B. Authentication Flow Problems

### C. User Flow Problems

### D. Biometric/Camera Problems

### E. MFA Problems

### F. Routing Problems

### G. Session Problems

### H. Backend/API Problems

### I. UI/UX Problems

### J. Architecture Problems

### K. Security Problems

### L. Build/Configuration Problems

### M. Recommended Fix Order

Rank fixes in this order:

1. Critical security issues
2. Authentication/state-machine issues
3. Backend/API issues
4. Biometric/camera issues
5. Routing/session issues
6. User-flow issues
7. UI/UX issues
8. Visual polish

---

## IMPORTANT OUTPUT RULES

Do NOT modify the project.

Do NOT generate code yet.

Do NOT guess.

Do NOT assume that a feature works just because a component exists.

For every important conclusion, identify the relevant:

* file
* function/component
* route
* API endpoint
* state/store
* configuration

If something cannot be determined, explicitly write:

**NOT DETERMINED FROM CURRENT CODE**

At the end, provide a concise:

**PROJECT HEALTH SCORE**

with separate scores for:

* Architecture
* Authentication
* Biometric
* MFA
* Session Security
* Routing
* Backend Security
* UX
* UI
* Reliability

Use a 0–10 scale and explain each score briefly.

The goal is to give another engineer enough information to understand the existing system without seeing the entire project.
