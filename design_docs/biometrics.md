# Multi-Factor Authentication (MFA) — Complete Design for Your Project

For your **Continuous Authentication & Zero-Trust Desktop Security System**, MFA should be designed as more than just **password + OTP**.

A stronger architecture can combine **three categories of evidence**:

1. **Knowledge factor** — something the user knows.
2. **Human biometric / inherence factor** — something the user is.
3. **Device / possession factor** — something the user has or a trusted device can prove.

Then, after login, your behavioral authentication system provides **continuous identity assurance**.

---

# 1. What Is Multi-Factor Authentication?

Multi-factor authentication verifies identity using **independent authentication factors**.

The classical categories are:

| Factor                 | Meaning                 | Examples                               |
| ---------------------- | ----------------------- | -------------------------------------- |
| **Knowledge**          | Something you know      | Password, PIN                          |
| **Possession**         | Something you have      | Phone, security key, trusted device    |
| **Inherence**          | Something you are       | Fingerprint, face                      |
| **Behavioral**         | Something you do        | Typing rhythm, mouse dynamics          |
| **Contextual signals** | Circumstances of access | Device state, location/network context |

A crucial distinction:

> **Two methods are not necessarily two factors.**

For example, password + security question is still primarily two **knowledge-based** methods. Fingerprint + face are two biometric modalities, but both belong to the **inherence** factor category.

---

# 2. MFA Architecture for Your Project

I would structure your authentication architecture as:

```text
                    USER
                      │
                      ▼
             ┌─────────────────┐
             │   IDENTIFICATION│
             │    Username     │
             └────────┬────────┘
                      ▼
             ┌─────────────────┐
             │ FACTOR 1        │
             │ Password / PIN  │
             │ Something Known │
             └────────┬────────┘
                      ▼
             ┌─────────────────┐
             │ FACTOR 2        │
             │ Human Biometric │
             │ Fingerprint/Face│
             └────────┬────────┘
                      ▼
             ┌─────────────────┐
             │ FACTOR 3        │
             │ Device Proof    │
             │ Trusted Device  │
             └────────┬────────┘
                      ▼
             ┌─────────────────┐
             │ Initial Trust   │
             │ Established     │
             └────────┬────────┘
                      ▼
             CONTINUOUS SESSION
                      │
                      ▼
             Behavioral Signals
             Keyboard + Mouse
                      │
                      ▼
                Risk Engine
                      │
            ┌─────────┼─────────┐
            ▼         ▼         ▼
          ALLOW    STEP-UP     LOCK
```

You don't necessarily require all three factors on every login. Your **risk engine can decide how much assurance is necessary**.

---

# 3. Factor 1 — Password Authentication

The first factor is normally:

> **Something the user knows**

Examples:

* Password
* PIN
* Passphrase

For your system:

```text
Username + Password
        ↓
Retrieve User Record
        ↓
Password Verification
        ↓
Valid?
   ┌────┴────┐
   NO        YES
   ↓          ↓
 Reject    Continue MFA
```

Passwords should never be stored directly.

```text
Password
    ↓
Argon2id
    ↓
Password Hash
    ↓
Local Database
```

During authentication:

```text
Entered Password
       +
Stored Password Hash
       ↓
Argon2 Verification
       ↓
Valid / Invalid
```

---

# 4. Human Biometrics

The second major area is **human biometrics**.

These are characteristics associated with the person.

They can be divided into two broad categories:

```text
HUMAN BIOMETRICS
│
├── Physiological Biometrics
│
│   ├── Fingerprint
│   ├── Face
│   ├── Iris
│   ├── Retina
│   └── Palm/hand characteristics
│
└── Behavioral Biometrics
    │
    ├── Keystroke dynamics
    ├── Mouse dynamics
    ├── Touch dynamics
    ├── Signature dynamics
    ├── Voice characteristics
    └── Interaction patterns
```

For your project, the distinction between **physiological biometrics for explicit authentication** and **behavioral biometrics for continuous authentication** is particularly useful.

---

# 5. Fingerprint Authentication

Fingerprint authentication is:

> **Something you are**

If the computer has a fingerprint sensor:

```text
User
 ↓
Fingerprint Sensor
 ↓
OS Biometric System
 ↓
Biometric Verification
 ↓
Success / Failure
```

For a real desktop application, your application generally should **not store raw fingerprint images** itself.

Prefer:

```text
Your Application
       ↓
Operating System Authentication API
       ↓
OS Biometric Framework
       ↓
Fingerprint Sensor / Secure Hardware
       ↓
Authentication Result
```

On Windows, for example, you would normally integrate with the operating system's authentication capabilities rather than building your own fingerprint matching database.

---

# 6. Fingerprint Data Storage

Avoid an architecture like:

```text
Fingerprint
     ↓
Fingerprint Image
     ↓
SQLite Database
```

That's unnecessary and creates significant privacy/security risk.

Prefer:

```text
Application
     ↓
Request Biometric Authentication
     ↓
OS / Secure Biometric System
     ↓
Fingerprint Verification
     ↓
Signed/protected authentication result
     ↓
Application
```

The operating system and hardware security mechanisms should handle the biometric material wherever possible.

---

# 7. Facial Authentication

Another physiological biometric is facial recognition.

Conceptually:

```text
Camera
   ↓
Face Detection
   ↓
Biometric Verification
   ↓
Liveness / Anti-spoofing
   ↓
Identity Verification
```

However, **camera image matching alone is not automatically strong authentication**.

A basic webcam implementation can potentially be attacked using:

* Printed photographs
* Images displayed on another screen
* Recorded video
* Deepfake/replay techniques

Therefore, strong facial authentication requires **anti-spoofing/liveness mechanisms** and preferably hardware/OS-backed biometric authentication.

For your project, it is better to use the platform's established biometric subsystem where available than to claim that a normal webcam classifier provides equivalent security.

---

# 8. Iris / Eye Biometrics

Iris recognition can provide strong biometric identification but usually requires specialized hardware.

```text
Eye
 ↓
Iris Sensor
 ↓
Feature Extraction
 ↓
Protected Template Comparison
 ↓
Verification
```

For your project:

**Conceptually supported → Yes**

**Necessary for prototype → No**

You can mention iris authentication as an extensible biometric modality.

---

# 9. Voice Biometrics

Voice can also be treated as a biometric signal.

```text
Microphone
    ↓
Voice Sample
    ↓
Voice Features
    ↓
Speaker Verification
    ↓
Confidence Score
```

However, voice authentication has challenges:

* Background noise
* Illness
* Microphone differences
* Recorded voice attacks
* Synthetic/deepfake speech

So I wouldn't make voice authentication a core requirement for your initial prototype.

---

# 10. Behavioral Biometrics

This is where your project becomes much more interesting.

Unlike fingerprint authentication:

```text
Fingerprint
     ↓
Explicit verification
```

behavioral biometrics can operate continuously:

```text
User Interaction
       ↓
Keyboard + Mouse
       ↓
Behavioral Features
       ↓
User Profile Comparison
       ↓
Identity Confidence
       ↓
Risk Engine
```

---

# 11. Keystroke Dynamics

Keystroke dynamics analyzes **how a person types**, rather than what they type.

Features could include:

```text
Key Press
   ↓
┌────────────────────────┐
│ Dwell Time             │
│ Flight Time            │
│ Inter-key Interval     │
│ Typing Speed           │
│ Rhythm                 │
│ Correction Patterns    │
└────────────────────────┘
```

For example:

```text
Legitimate User

Average dwell time:  92 ms
Average flight time: 115 ms
Typing rhythm:       Profile A
```

Later:

```text
Current User

Average dwell time:  171 ms
Average flight time: 240 ms
Typing rhythm:       Different
```

The anomaly score increases.

Again, one metric should not be enough to conclude that the user changed.

---

# 12. Mouse Dynamics

Mouse behavior provides another continuous biometric signal.

Possible features:

```text
Mouse Movement
│
├── Velocity
├── Acceleration
├── Direction
├── Curvature
├── Click interval
├── Double-click timing
├── Scroll behavior
└── Movement trajectories
```

The advantage is that it works passively while the user operates the computer.

---

# 13. Human Biometrics in Your Architecture

You can therefore divide human biometric authentication into:

| Biometric          | Role                         | Frequency       |
| ------------------ | ---------------------------- | --------------- |
| Fingerprint        | Strong explicit verification | Login / Step-up |
| Face               | Explicit verification        | Login / Step-up |
| Iris               | Strong explicit verification | Optional        |
| Voice              | Additional verification      | Optional        |
| Keystroke dynamics | Passive verification         | Continuous      |
| Mouse dynamics     | Passive verification         | Continuous      |

That is a strong architecture because **explicit biometrics and continuous behavioral biometrics serve different purposes**.

---

# 14. Device Authentication / "Device Biometrics"

This requires an important terminology correction.

When people say **device biometrics**, they may mean two different things:

### Biometrics performed by a device

Example:

> Fingerprint authentication using the laptop's fingerprint sensor.

That is still **human biometric authentication**.

### Device identity / device fingerprinting

This verifies:

> **Is this the expected/trusted device?**

That is not a human biometric. Technically, terms such as **device identity, device attestation, device fingerprinting, or trusted-device verification** are more accurate.

For your presentation, I recommend using:

> **Human Biometrics + Device Trust / Device Authentication**

rather than putting both under the same "biometrics" label.

---

# 15. Device Identity

The system can determine whether authentication is occurring from an enrolled/trusted computer.

Conceptually:

```text
Device
  ↓
Device Identity
  ↓
Cryptographic Verification
  ↓
Trusted Device?
  │
 ┌┴─────────────┐
YES              NO
 │                │
Normal Risk    Increase Risk
```

---

# 16. Hardware-Based Device Identity

A stronger implementation uses a cryptographic key protected by hardware/OS facilities.

For example:

```text
Device Enrollment
       ↓
Generate Device Key Pair
       ↓
Private Key
       ↓
Hardware / OS Protected Storage

Public Key
       ↓
Registered as Device Identity
```

Later:

```text
Authentication Challenge
          ↓
Trusted Device
          ↓
Private-Key Operation
          ↓
Verification
          ↓
Device Identity Confirmed
```

This is much stronger than relying only on easily copied identifiers.

---

# 17. TPM

For Windows-oriented devices, a **Trusted Platform Module (TPM)** is highly relevant.

Conceptually:

```text
             TPM
              │
      Protected Private Key
              │
              ▼
Application Challenge
              │
              ▼
Cryptographic Proof
              │
              ▼
Device Trust Established
```

The private key can be protected so it isn't simply exposed as a normal file.

This supports a stronger statement:

> The device proves possession of a protected cryptographic key.

rather than:

> The application recognizes the device because its name is "Rishvin-Laptop."

---

# 18. Device Fingerprinting

You can also collect non-secret device attributes to build a device fingerprint.

Examples might include:

```text
Device Context
│
├── OS / OS version
├── Hardware characteristics
├── Application installation identity
├── TPM availability
├── Security configuration
└── Other stable device signals
```

These signals can contribute to risk assessment.

But avoid treating easily spoofable values as strong authentication.

---

# 19. MAC Address Is Not Enough

For example:

```text
MAC Address = Device Identity
```

is not a strong security architecture.

MAC addresses can change and can be spoofed.

Similarly, don't rely solely on:

* Computer name
* Username
* IP address
* MAC address
* OS version

These can be useful **contextual signals**, but they should not be your cryptographic root of device trust.

---

# 20. Trusted Device Enrollment

When a new device is registered:

```text
User Authentication
        ↓
MFA Verification
        ↓
Device Enrollment
        ↓
Generate Device Key
        ↓
Protect Private Key
        ↓
Register Device
        ↓
Trusted Device Created
```

The application can store metadata such as:

```text
Device ID
Device Name
Public Key / Credential Reference
Enrollment Date
Last Verified
Trust Status
```

---

# 21. Device Trust Score

Device verification can also feed into your risk engine.

For example:

```text
Known Device
TPM Available
Protected Credential Valid
Expected Security State

        ↓

HIGH DEVICE TRUST
```

versus:

```text
Unknown Device
No Existing Device Credential
Unexpected Configuration

        ↓

LOW DEVICE TRUST
```

Then:

```text
Device Trust
     +
Human Authentication
     +
Behavioral Confidence
     +
Session Context
     ↓
Overall Risk Engine
```

---

# 22. Contextual Device Signals

You can further evaluate device context.

Examples:

* Trusted-device status
* OS security status
* Application integrity
* Secure Boot/TPM availability where accessible
* Significant device configuration changes
* Network context

These should generally be treated as **risk signals**, not independent authentication factors by themselves.

---

# 23. MFA + Human Biometrics + Device Trust

Now we can combine everything.

```text
                   USER LOGIN
                       │
                       ▼
              ┌─────────────────┐
              │    Password     │
              │ Knowledge Factor│
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Human Biometric │
              │ Fingerprint/Face│
              │ Inherence Factor│
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Device Identity │
              │ Device Key/TPM  │
              │ Possession Proof│
              └────────┬────────┘
                       │
                       ▼
              Initial Authentication
                       │
                       ▼
                Secure Session
                       │
                       ▼
          ┌────────────────────────┐
          │ Continuous Behavioral  │
          │     Authentication     │
          │                        │
          │ Keyboard + Mouse       │
          └────────────┬───────────┘
                       │
                       ▼
                  Risk Engine
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
        LOW          MEDIUM        HIGH
          │            │            │
          ▼            ▼            ▼
       Allow        Step-up        Lock
```

This architecture is much stronger than simply:

```text
Password + OTP
```

---

# 24. TOTP Should Still Be Included

I would still support **TOTP** as an authentication option.

For example:

```text
Password
   +
TOTP
```

or:

```text
Password
   +
Fingerprint
```

or for high-risk authentication:

```text
Password
   +
Trusted Device
   +
Biometric
```

The authentication policy doesn't need to be identical every time.

---

# 25. Adaptive MFA

This fits perfectly with your risk engine.

Suppose:

```text
Risk Score: LOW
```

The user is on a trusted device and behavior is normal.

```text
→ Continue session
```

Risk increases:

```text
Risk Score: MEDIUM
```

The system can request:

```text
→ Password/PIN re-verification
```

Risk becomes high:

```text
Risk Score: HIGH
```

Require:

```text
→ Strong biometric or TOTP/passkey verification
```

Risk becomes critical or repeated verification fails:

```text
→ Lock session
```

This is called **adaptive or risk-based authentication**.

---

# 26. Authentication Assurance Levels

For your project, you can internally represent authentication strength.

For example:

| Level          | Authentication State             |
| -------------- | -------------------------------- |
| **Level 0**    | Unauthenticated                  |
| **Level 1**    | Password verified                |
| **Level 2**    | Password + second factor         |
| **Level 3**    | Strong MFA + trusted device      |
| **Continuous** | Behavioral confidence maintained |

Then sensitive actions could require higher assurance.

```text
Normal Activity
      ↓
Level 2 sufficient

Sensitive Action
      ↓
Level 3 required
      ↓
Biometric / Strong Re-authentication
```

This makes the Zero-Trust aspect considerably more concrete.

---

# 27. Passkeys / FIDO2 — Strong Future Direction

For a modern architecture, you should also understand **passkeys/WebAuthn/FIDO2-style authentication**.

Rather than transmitting a reusable password, authentication is based on public-key cryptography.

Conceptually:

```text
Registration

Authenticator / Device
        ↓
Generate Key Pair
        ↓
Private Key → Protected
Public Key  → Registered
```

During authentication:

```text
Challenge
   ↓
Authenticator
   ↓
User Verification
Fingerprint / Face / PIN
   ↓
Private-Key Operation
   ↓
Cryptographic Response
   ↓
Verification
```

This combines very naturally with trusted devices and platform biometrics.

For your academic prototype, you don't need to implement every possible FIDO capability. But it is an excellent **future enhancement** and demonstrates awareness of modern authentication architecture.

---

# 28. Where Each Authentication Method Fits

A useful classification for your report is:

| Mechanism          | Category                      | Project Role              |
| ------------------ | ----------------------------- | ------------------------- |
| Password           | Knowledge                     | Initial authentication    |
| PIN                | Knowledge                     | Local verification        |
| TOTP               | Possession                    | MFA                       |
| Security key       | Possession                    | Strong MFA                |
| Trusted device key | Possession/device trust       | Device authentication     |
| Fingerprint        | Human biometric               | Strong verification       |
| Face               | Human biometric               | Strong verification       |
| Iris               | Human biometric               | Optional                  |
| Voice              | Human biometric               | Optional                  |
| Keystroke dynamics | Behavioral biometric          | Continuous authentication |
| Mouse dynamics     | Behavioral biometric          | Continuous authentication |
| Device fingerprint | Context/risk signal           | Device risk assessment    |
| TPM-backed key     | Device cryptographic identity | Strong device trust       |

---

# 29. Authentication Data Storage

Connect this with the storage architecture we discussed earlier.

```text
                AUTHENTICATION DATA

                     │
      ┌──────────────┼───────────────┐
      ▼              ▼               ▼
 Password Data   MFA Secrets      Device Keys
      │              │               │
      ▼              ▼               ▼
Argon2id Hash   OS Protected     TPM / Secure
   SQLite          Storage          Storage


                BIOMETRIC DATA

                     │
       ┌─────────────┴─────────────┐
       ▼                           ▼
Physical Biometrics         Behavioral Biometrics
       │                           │
       ▼                           ▼
Prefer OS biometric         Local protected
framework/storage           feature profiles
```

The key principle:

> **Your application should minimize possession of raw biometric information.**

---

# 30. What Should NOT Be Stored

Avoid storing:

```text
Plaintext Password             ✗

Raw Fingerprint Image          ✗

Unnecessary Face Photos        ✗

Actual Typed Text              ✗

Plaintext TOTP Secret          ✗

Plaintext Device Private Key   ✗

Encryption Key beside DB       ✗
```

Instead:

```text
Password Hash                  ✓

OS Biometric Result            ✓

Protected TOTP Secret          ✓

Behavioral Feature Vector      ✓

TPM/OS-Protected Device Key    ✓

Security/Risk Events           ✓
```

---

# 31. Complete Authentication Lifecycle

Your complete authentication process can ultimately look like:

```text
                    START
                      │
                      ▼
              Identify User
                      │
                      ▼
             Password Verification
                      │
                 Valid?
                 /    \
               NO      YES
               │        │
             DENY       ▼
                   Device Verification
                         │
                    Trusted?
                         │
                         ▼
                   MFA / Biometric
                         │
                    Verified?
                    /       \
                  NO         YES
                  │           │
                DENY          ▼
                       Create Session
                             │
                             ▼
                    Continuous Monitoring
                             │
                 ┌───────────┴───────────┐
                 ▼                       ▼
             Keyboard                  Mouse
                 │                       │
                 └───────────┬───────────┘
                             ▼
                     Behavioral Model
                             │
                             ▼
                       Anomaly Score
                             │
                             ▼
                         Risk Engine
                             │
                ┌────────────┼────────────┐
                ▼            ▼            ▼
              LOW          MEDIUM        HIGH
                │            │            │
                ▼            ▼            ▼
             CONTINUE     STEP-UP       LOCK
                             │
                             ▼
                   Biometric / TOTP
                             │
                             ▼
                     Verify Identity
                             │
                      ┌──────┴──────┐
                      ▼             ▼
                   SUCCESS        FAILURE
                      │             │
                      ▼             ▼
                   CONTINUE        LOCK
                      │
                      └──────┐
                             │
                             ▼
                    Continuous Loop
```

---

# 32. Recommended Prototype Scope

Don't try to implement **fingerprint + face + iris + voice + TOTP + security keys + behavioral biometrics** all at once.

For the actual applicative project, I recommend this scope:

**Initial authentication:** Username + password.

**Second factor:** TOTP and/or OS-supported biometric authentication.

**Device authentication:** Device enrollment + protected cryptographic device identity, with TPM-backed protection where feasible.

**Continuous authentication:** Keystroke dynamics + mouse dynamics.

**Adaptive authentication:** Request strong re-authentication when behavioral risk exceeds defined thresholds.

**Response:** Continue → Step-up MFA → Lock.

This gives you a technically substantial project while keeping it implementable.

---

# 33. The Complete Security Model

Your system can ultimately be explained as **four layers of identity assurance**:

```text
┌──────────────────────────────────────┐
│ 1. KNOWLEDGE                         │
│                                      │
│ Password / PIN                       │
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│ 2. HUMAN IDENTITY                    │
│                                      │
│ Fingerprint / Face                   │
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│ 3. DEVICE TRUST                      │
│                                      │
│ Device Identity / TPM / Device Key   │
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│ 4. CONTINUOUS IDENTITY               │
│                                      │
│ Keyboard + Mouse Behavioral Profile  │
└──────────────────┬───────────────────┘
                   ▼
              RISK ENGINE
                   │
                   ▼
          ADAPTIVE SECURITY
```

That is a much stronger framing for your project than describing it merely as **"MFA with behavioral authentication."**

The core concept becomes:

> **The system establishes identity using multiple independent authentication factors, establishes trust in the device using cryptographic device identity, and then continuously reassesses user identity through behavioral biometrics. When confidence decreases, adaptive MFA is triggered before access is allowed to continue.**

For your Review-1 presentation, I would present **Human Authentication → Device Trust → Continuous Behavioral Verification → Risk-Based Response** as four connected security layers. This keeps the architecture sophisticated but still easy for the panel to understand.
