# Complete User Flow — Secure Desktop Authentication and System Protection Application

For your project, the authentication system should be divided into **three major flows**:

1. **First-Time Application Setup / Primary Admin Creation**
2. **Adding a New User to an Existing System**
3. **Existing User Login and Continuous Authentication**

A crucial distinction: **“New User” and “Add New User” are not the same flow.** The first person setting up the application becomes the **Primary Administrator**. After that, new accounts should only be created through an authenticated administrator.

---

# 1. First-Time Application Setup

This flow happens **only once**, immediately after the application is installed.

### Step 1 — Launch Application

The desktop application starts and checks local protected storage.

```text
Application Launch
        ↓
Check Application Configuration
        ↓
Is System Already Configured?
       / \
     NO   YES
     ↓     ↓
First-Time   Normal Login
Setup
```

If no system configuration, administrator account, or cryptographic configuration exists, the application starts the **Initial Setup Wizard**.

---

## Step 2 — Initialize Security Environment

Before creating the first user, the application initializes its security environment.

Internally:

```text
Generate Application Instance ID
        ↓
Generate Cryptographic Keys
        ↓
Initialize Encrypted Local Database
        ↓
Create Secure Configuration
        ↓
Initialize Audit Logging
```

The application should **never store passwords, PINs, or raw biometric data directly**.

---

# 2. Primary Administrator Registration

The first registered user becomes the **Primary Administrator / System Owner**.

### Step 3 — Administrator Details

Collect only necessary information:

```text
Full Name
Username
Email (optional/recovery depending on design)
```

The username must be unique.

---

# 3. Password Setup

The administrator creates a strong password.

Example policy:

* Minimum 12 characters
* Uppercase and lowercase characters
* Number
* Special character
* Reject commonly compromised/weak passwords

Flow:

```text
Enter Password
      ↓
Confirm Password
      ↓
Password Policy Check
      ↓
Generate Unique Salt
      ↓
Password KDF
      ↓
Store Password Verifier
```

For the implementation, use a modern password KDF such as **Argon2id**. You store the resulting password verifier/hash and associated parameters—not the plaintext password.

---

# 4. PIN Setup

If your application includes a PIN as an authentication method:

```text
Create PIN
    ↓
Confirm PIN
    ↓
Validate PIN Policy
    ↓
Derive Protected Verifier
    ↓
Store Securely
```

The PIN should **not simply replace the main password** for security-critical operations unless it is protected appropriately by the OS/device security model.

---

# 5. Biometric Enrollment

Next:

```text
Set Up Biometrics
        ↓
Detect Available OS Biometric Capability
        ↓
User Verification
        ↓
OS/Platform Authentication
        ↓
Application Receives Verification Result
        ↓
Bind Credential to User Account
```

### Important architecture decision

Your application should preferably **not capture and store raw fingerprints or facial images itself**.

Use the operating system/platform biometric framework where possible. Your application receives a successful/failed authentication assertion rather than maintaining a database of fingerprint images.

So conceptually:

```text
Fingerprint / Face
       ↓
Operating System
Biometric Framework
       ↓
Secure Hardware / OS
Credential Protection
       ↓
Verification Result
       ↓
Your Application
```

---

# 6. MFA Configuration

The administrator can then configure the authentication policy.

For example:

```text
Factor 1 → Password
Factor 2 → Biometric / PIN
```

Your system can support policies such as:

```text
Normal Risk
Password + Biometric

Elevated Risk
Password + Biometric + Additional Verification
```

This connects directly with your project's **risk-based authentication** concept.

---

# 7. Behavioral Authentication Enrollment

This is where your project becomes more than a conventional login application.

After registration, the system begins establishing a **behavioral baseline**.

Possible signals:

```text
Keystroke timing
Typing rhythm
Key hold duration
Mouse movement characteristics
Mouse velocity
Click patterns
Session characteristics
```

You should avoid presenting this as an instantaneous perfect profile.

Instead:

```text
Initial Account Creation
        ↓
Collect Behavioral Samples
        ↓
Feature Extraction
        ↓
Baseline Development
        ↓
Baseline Updated Over Time
```

The system can initially operate with reduced confidence and improve the behavioral profile as legitimate usage data accumulates.

---

# 8. Recovery Setup

The administrator should configure account recovery.

For a local-first architecture, recovery needs special consideration because there may be no central server capable of simply resetting the account.

Possible design:

```text
Generate Recovery Codes
        ↓
Display Once
        ↓
User Saves Codes Securely
        ↓
Store Only Protected/Hashed Representation
```

If you later introduce your proposed **optional paid cloud functionality**, encrypted account recovery/synchronization could be an additional service.

---

# 9. Registration Completion

After successful setup:

```text
User Account
Password Credential
PIN Credential
Biometric Binding
MFA Policy
Recovery Configuration
Security Policy
```

are associated with the administrator.

The application records an audit event such as:

```text
ACCOUNT_CREATED
Role: PRIMARY_ADMIN
Timestamp
Device/Application Instance
Result: SUCCESS
```

The administrator reaches the dashboard.

---

# Complete First-Time User Flow

```text
Install Application
        ↓
Launch Application
        ↓
Detect First-Time Setup
        ↓
Initialize Secure Local Environment
        ↓
Create Primary Administrator
        ↓
Create Username
        ↓
Create Password
        ↓
Configure PIN
        ↓
Enroll / Bind Biometrics
        ↓
Configure MFA
        ↓
Configure Recovery
        ↓
Initialize Behavioral Learning
        ↓
Apply Security Policies
        ↓
Registration Complete
        ↓
Dashboard
        ↓
Continuous Protection Begins
```

---

# 10. Adding a New User

This is a **different flow**.

Once the primary administrator exists, somebody should not simply be able to open the application and press:

> Create Account

Otherwise an attacker with physical access could potentially create another account.

Instead:

```text
Administrator Login
       ↓
User Management
       ↓
Add New User
```

---

## Step 1 — Administrator Authentication

The administrator logs in normally.

For sensitive operations such as adding users, use **step-up authentication**.

```text
Admin → User Management → Add User
                    ↓
            Re-authentication
                    ↓
          Password / Biometric
                    ↓
                 Verified
```

This protects against someone using an administrator's already-unlocked session.

---

# 11. Create User Profile

Administrator enters:

```text
Full Name
Username
Role
Permissions
```

Potential roles:

| Role                  | Access                          |
| --------------------- | ------------------------------- |
| Primary Administrator | Complete system control         |
| Administrator         | User/security management        |
| Standard User         | Normal protected desktop access |
| Restricted User       | Limited access                  |

For your academic prototype, even **Administrator + Standard User** may be sufficient if you don't need a complex RBAC implementation.

---

# 12. New User Credential Enrollment

The important security design is:

> **The administrator should not choose the new user's permanent password.**

Instead:

```text
Administrator Creates Account
          ↓
Account Status = ENROLLMENT_REQUIRED
          ↓
New User Begins Enrollment
          ↓
Identity/Enrollment Verification
          ↓
User Creates Own Password
          ↓
User Configures PIN
          ↓
User Enrolls Biometrics
          ↓
Recovery Configuration
```

This keeps the user's authentication secrets private.

---

# 13. Behavioral Profile for New User

Initially:

```text
behavioral_profile_status = LEARNING
```

During legitimate sessions:

```text
Keyboard Events ──┐
                  │
Mouse Events ─────┼──→ Feature Extraction
                  │
Session Context ──┘
                         ↓
                  Behavioral Model
                         ↓
                  User Baseline
```

Once sufficient data is available:

```text
LEARNING
    ↓
BASELINE_ESTABLISHED
    ↓
CONTINUOUS_MONITORING
```

---

# Complete Add-New-User Flow

```text
Administrator Login
        ↓
Dashboard
        ↓
User Management
        ↓
Add New User
        ↓
Admin Step-Up Authentication
        ↓
Enter User Information
        ↓
Select Role / Permissions
        ↓
Create Enrollment-Pending Account
        ↓
New User Starts Enrollment
        ↓
Create Password
        ↓
Configure PIN
        ↓
Enroll Biometrics
        ↓
Configure MFA / Recovery
        ↓
Initialize Behavioral Learning
        ↓
Activate Account
        ↓
Audit Event Recorded
        ↓
User Ready
```

---

# 14. Existing User Login Flow

Now consider a normal user returning to the computer.

This process should contain more than:

```text
Username → Password → Dashboard
```

because your project combines **MFA + risk assessment + behavioral authentication + continuous protection**.

The architecture should be:

```text
Identification
      ↓
Credential Verification
      ↓
Risk Assessment
      ↓
MFA
      ↓
Authorization
      ↓
Session Creation
      ↓
Continuous Authentication
      ↓
Continuous System Protection
```

---

# 15. Application Startup

When the application starts:

```text
Launch
   ↓
Integrity / Configuration Check
   ↓
Load Protected Configuration
   ↓
Initialize Security Services
   ↓
Display Login
```

The user enters their username.

---

# 16. Password Authentication

```text
Username
    ↓
Find User
    ↓
Account Exists?
   /       \
 NO        YES
 ↓          ↓
Generic    Password
Failure    Verification
             ↓
         Valid?
        /     \
      NO       YES
      ↓         ↓
 Failed      Continue
 Attempt
```

Use a generic authentication error such as:

> Invalid credentials.

Avoid unnecessarily revealing whether a particular username exists.

---

# 17. Failed Login Protection

For repeated failures:

```text
Failed Attempt
      ↓
Increment Failure Counter
      ↓
Update Risk Score
      ↓
Check Threshold
```

The system can apply progressively stronger controls, such as temporary rate limiting or requiring stronger verification. Avoid simplistic permanent lockouts that make denial-of-service attacks easy.

All relevant events should be written to the security audit log.

---

# 18. Pre-Authentication Risk Assessment

After the primary credential is validated, calculate contextual risk.

Possible factors:

```text
Login time
Device state
Recent failed attempts
Unusual authentication pattern
Session history
Integrity/security alerts
```

Conceptually:

```text
Risk Engine
    ↓
Risk Score
0 ─────────────── 100
```

For example:

| Risk     | Response                                 |
| -------- | ---------------------------------------- |
| Low      | Normal MFA                               |
| Medium   | Stronger MFA                             |
| High     | Step-up verification                     |
| Critical | Deny / quarantine / administrator review |

These thresholds should be configurable rather than treated as universally correct fixed numbers.

---

# 19. MFA Verification

Example normal flow:

```text
Password ✓
     ↓
Biometric Challenge
     ↓
Biometric ✓
     ↓
Authentication Complete
```

If biometrics are unavailable, your policy could permit a protected fallback:

```text
Biometric unavailable
        ↓
Approved fallback
        ↓
PIN / Recovery mechanism
```

The fallback mechanism must not be dramatically weaker than the primary authentication path.

---

# 20. Authorization

Authentication answers:

> **Who is this user?**

Authorization answers:

> **What is this user allowed to do?**

After authentication:

```text
User Identity
      ↓
Retrieve Role
      ↓
Retrieve Permissions
      ↓
Apply Access-Control Policy
```

Example:

```text
ADMIN
 ├── User Management
 ├── Security Configuration
 ├── Audit Logs
 └── System Protection

STANDARD USER
 ├── Dashboard
 ├── Personal Security Status
 └── Approved User Functions
```

---

# 21. Secure Session Creation

After successful authentication:

```text
Generate Secure Session
        ↓
Associate User Identity
        ↓
Associate Role
        ↓
Set Session State
        ↓
Initialize Monitoring
```

The application records:

```text
LOGIN_SUCCESS
User ID
Timestamp
Authentication Methods
Risk Level
Session ID
```

Sensitive audit data should be minimized and protected.

---

# 22. Continuous Behavioral Authentication

This is one of the central features of your project.

Authentication **doesn't stop after login**.

Traditional model:

```text
Login → Authenticated → Trust until logout
```

Your proposed model:

```text
Login
 ↓
Authenticate
 ↓
Use System
 ↓
Observe Behavior
 ↓
Re-evaluate Trust
 ↓
Continue / Challenge / Lock
```

---

# 23. Continuous Behavior Collection

During the session:

```text
Keyboard Dynamics
       +
Mouse Dynamics
       +
Session Context
       ↓
Feature Extraction
       ↓
Behavior Comparison
       ↓
Confidence / Anomaly Score
```

You should focus on behavioral **features**, rather than recording sensitive user content.

For example, analyze timing characteristics rather than storing everything the user types.

---

# 24. Continuous Risk Engine

Combine relevant security signals:

```text
Authentication Signals ──┐
Behavioral Signals ───────┤
System Security Events ───┼──→ Risk Engine
Session Context ──────────┤
Integrity Signals ────────┘
```

The engine continuously determines the current trust/risk state.

For example:

```text
LOW
 ↓
Allow normal operation

MEDIUM
 ↓
Increase monitoring

HIGH
 ↓
Step-Up Authentication

CRITICAL
 ↓
Lock / terminate protected session
```

---

# 25. Behavioral Anomaly Detected

Suppose User A logs in successfully but somebody else begins operating the computer.

The behavioral engine may detect:

```text
Different typing rhythm
        +
Different mouse dynamics
        +
Abnormal session activity
        ↓
Behavioral Confidence Falls
        ↓
Risk Score Increases
```

Instead of immediately declaring an attacker based on one anomaly, aggregate sufficient evidence to reduce false positives.

---

# 26. Step-Up Authentication

When the risk threshold is crossed:

```text
Risk Increased
      ↓
Step-Up Authentication Required
      ↓
Biometric / Strong Authentication
     / \
 PASS  FAIL
 ↓      ↓
Reset/  Restrict or
Reduce  Lock Session
Risk
```

Successful verification restores confidence.

Repeated failures can trigger stronger protective action.

---

# 27. System Protection Layer

Your project title includes:

> **Secure Desktop Authentication and System Protection Application**

Therefore authentication should feed into your protection layer.

Conceptually:

```text
                SECURITY ENGINE

Authentication ───────────┐
                          │
Behavioral Monitoring ────┤
                          ↓
                    Risk Engine
                          ↑
System Monitoring ────────┤
                          │
Integrity Monitoring ─────┘
                          ↓
                    Policy Engine
                          ↓
              ┌───────────┼───────────┐
              ↓           ↓           ↓
            Allow      Challenge     Protect
```

Protection actions depend on what privileges your desktop application actually has on the operating system.

---

# 28. Idle User Flow

If there is no activity for a configured period:

```text
Active Session
      ↓
Idle Threshold Reached
      ↓
Session Lock
      ↓
Authentication Required
      ↓
Verified
      ↓
Resume Session
```

For a high-risk session, the application could require stronger authentication than for an ordinary unlock.

---

# 29. Logout Flow

When the user logs out:

```text
Logout Requested
       ↓
Stop User Monitoring
       ↓
Finalize Session Security State
       ↓
Securely Clear Session Secrets
       ↓
Invalidate Session
       ↓
Write Audit Event
       ↓
Login Screen
```

The behavioral model can be updated carefully using sufficiently trusted sessions so that suspicious activity does not automatically poison the legitimate user's baseline.

---

# 30. Complete Existing-User Flow

This is the **master login flow** I recommend for your architecture:

```text
                APPLICATION START
                       │
                       ▼
              Security Initialization
                       │
                       ▼
                  Login Screen
                       │
                       ▼
                Enter Username
                       │
                       ▼
                Enter Password
                       │
                       ▼
              Credential Verification
                  ┌────┴────┐
                FAIL       PASS
                  │          │
                  ▼          ▼
           Failure Handling  Risk Assessment
                             │
                             ▼
                       MFA Challenge
                        ┌────┴────┐
                      FAIL       PASS
                        │          │
                        ▼          ▼
                  Deny / Retry  Authorization
                                   │
                                   ▼
                            Create Session
                                   │
                                   ▼
                               Dashboard
                                   │
                                   ▼
                     Continuous Authentication
                                   │
                  ┌────────────────┼────────────────┐
                  ▼                ▼                ▼
              Behavior         System          Integrity
              Analysis        Monitoring       Monitoring
                  │                │                │
                  └────────────────┼────────────────┘
                                   ▼
                              Risk Engine
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
                   LOW           MEDIUM          HIGH
                    │              │              │
                 Continue       Enhanced       Step-Up
                                Monitoring       MFA
                                                 │
                                           ┌─────┴─────┐
                                         PASS         FAIL
                                           │            │
                                        Continue    Restrict/
                                                    Lock Session
```

# Overall System Lifecycle

Ultimately, the entire application can be explained with this single lifecycle:

```text
                     INSTALLATION
                          ↓
                FIRST-TIME DETECTION
                          ↓
                 PRIMARY ADMIN SETUP
                          ↓
                SECURITY INITIALIZATION
                          ↓
                     ┌─────────┐
                     │  LOGIN  │
                     └────┬────┘
                          ↓
               Credential Verification
                          ↓
                   Risk Assessment
                          ↓
                         MFA
                          ↓
                    Authorization
                          ↓
                   Secure Session
                          ↓
              ┌───────────┴───────────┐
              ↓                       ↓
      Continuous Authentication   System Protection
              ↓                       ↓
      Behavioral Analysis       Security Monitoring
              └───────────┬───────────┘
                          ↓
                      Risk Engine
                          ↓
                     Policy Engine
                          ↓
           ┌──────────────┼──────────────┐
           ↓              ↓              ↓
        Continue       Challenge       Protect
                          ↓
                   Step-Up MFA
                          ↓
              Continue / Lock Session
                          ↓
                       Logout
                          ↓
                  Session Cleanup
                          ↓
                      Audit Log
```

## Recommended application screens

For the actual implementation, this translates into roughly these screens:

1. **First-Time Setup Wizard** — initial secure configuration.
2. **Primary Admin Registration** — creates the system owner.
3. **Credential Setup** — password/PIN configuration.
4. **Biometric Enrollment** — OS-backed biometric setup.
5. **Recovery Setup** — recovery configuration.
6. **Login Screen** — normal existing-user authentication.
7. **MFA Verification Screen** — secondary authentication.
8. **Dashboard** — security status and application controls.
9. **Security/Risk Dashboard** — current risk, alerts and protection status.
10. **User Management** — administrators manage accounts.
11. **Add User Wizard** — administrator-controlled account enrollment.
12. **User Details & Permissions** — roles/account state.
13. **Security Events / Audit Logs** — authentication and protection events.
14. **Step-Up Authentication Dialog** — displayed when trust falls or a sensitive operation is requested.
15. **Lock Screen** — protected session lock.
16. **Settings / Security Policy** — MFA, timeout, monitoring and security configuration.

This gives you a coherent architecture where **password + OS-backed biometrics establish initial identity, risk-based MFA adapts the login decision, behavioral authentication continuously reassesses identity after login, and the protection/policy engine responds when trust decreases**.
