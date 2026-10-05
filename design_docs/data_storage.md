# Data Storage Architecture for the Project

For this project, I recommend a **local-first, security-oriented storage architecture** rather than putting all user data in a centralized cloud database.

The key principle is:

> **Sensitive authentication and behavioral data stays on the user's device by default. Cloud storage, if introduced later, should be optional and limited to encrypted synchronization, backup, remote management, and premium/enterprise features.**

## 1. Overall Storage Architecture

```text
                    DESKTOP APPLICATION
                           │
          ┌────────────────┼─────────────────┐
          │                │                 │
          ▼                ▼                 ▼
   Authentication     Behavioral        Security
       Module          Monitoring         Engine
          │                │                 │
          └────────────────┼─────────────────┘
                           ▼
                  DATA ACCESS LAYER
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
      Local Database   Secure Secret   ML/Profile
        (SQLite)         Storage         Storage
            │              │              │
            └──────────────┼──────────────┘
                           ▼
                    USER'S DEVICE
                           │
                   Optional / Future
                           ▼
                    CLOUD SERVICES
                 Backup • Sync • Admin
```

The important architectural distinction is that **not every type of data should be stored in the same place**.

---

# 2. Three Main Storage Areas

Your application should conceptually use three local storage categories.

| Storage                   | Purpose                        | Example Data                           |
| ------------------------- | ------------------------------ | -------------------------------------- |
| **SQLite Database**       | Structured application data    | Users, settings, sessions, risk events |
| **OS Secure Storage**     | Highly sensitive secrets       | Encryption keys, protected MFA secrets |
| **Model/Profile Storage** | Behavioral authentication data | Feature baselines, model parameters    |

This is better than simply saying:

> "Everything is stored in SQLite."

because authentication secrets and encryption keys need stronger handling.

---

# 3. Local SQLite Database

**SQLite** is a strong choice for the prototype because it is:

* Embedded
* Lightweight
* Serverless
* Offline
* Easy to integrate
* Suitable for desktop applications

You don't need a separate database server.

Conceptually:

```text
Application
     │
     ▼
SQLite
     │
     ├── Users
     ├── Behavioral Profiles
     ├── Sessions
     ├── Risk Events
     ├── Security Logs
     └── Settings
```

---

# 4. Recommended Database Structure

A clean database design could contain these main tables:

```text
LOCAL DATABASE
│
├── users
│
├── behavioral_profiles
│
├── behavioral_features
│
├── sessions
│
├── risk_events
│
├── authentication_events
│
├── security_logs
│
└── settings
```

You do **not necessarily need every table in version 1**, but this gives you a scalable design.

---

# 5. Users Table

Stores basic account information.

Example:

```text
users
────────────────────────
user_id
username
password_hash
mfa_enabled
created_at
updated_at
account_status
```

The password itself is **never stored**.

Instead:

```text
Password
   ↓
Argon2id / bcrypt
   ↓
Password Hash
   ↓
Database
```

So the database contains something conceptually like:

```text
password_hash = "$argon2id$..."
```

not:

```text
password = "mypassword123"
```

---

# 6. MFA Storage

MFA requires special treatment.

For TOTP authentication, the application needs a secret used to generate/verify time-based codes.

That secret should **not simply be stored as plaintext in SQLite**.

A better design is:

```text
TOTP Secret
     ↓
Encrypted / Protected
     ↓
OS Secure Storage
```

Depending on the operating system, this can eventually use mechanisms such as:

```text
Windows → DPAPI / Credential Manager

macOS → Keychain

Linux → Secret Service / Keyring
```

For a Windows-focused prototype, Windows-protected storage is particularly relevant.

---

# 7. Behavioral Data Storage

This is one of the most important architectural decisions.

The application should avoid permanently storing raw keyboard content.

You want to store **behavioral characteristics**, not what the person typed.

### Avoid

```text
User typed:
"my email password is..."
```

### Store

```text
Average key dwell time = 91 ms
Average flight time    = 116 ms
Typing speed           = ...
Variance               = ...
Sample count           = ...
```

So:

```text
Keyboard / Mouse Events
          ↓
    Feature Extraction
          ↓
 Numerical Features
          ↓
 Behavioral Profile
          ↓
      Local Storage
```

This gives you a much stronger **privacy-by-design** argument.

---

# 8. Behavioral Profile Storage

A conceptual table could be:

```text
behavioral_profiles
────────────────────────
profile_id
user_id
profile_version
keyboard_baseline
mouse_baseline
sample_count
model_reference
created_at
updated_at
```

You could store aggregated numerical features directly or serialize structured profile information where appropriate.

---

# 9. ML Model Storage

The trained anomaly-detection model doesn't necessarily belong inside a normal database row.

A cleaner architecture can use:

```text
Application Data Directory
│
├── database/
│   └── security.db
│
├── models/
│   ├── user_001.model
│   └── user_002.model
│
├── logs/
│   └── security.log
│
└── config/
```

However, model files themselves should be treated as **sensitive application data**, because tampering with them could weaken authentication.

You should therefore consider:

* File permissions
* Integrity verification
* Encryption where appropriate
* Secure model loading

---

# 10. Session Storage

The application also needs information about active authentication sessions.

Conceptually:

```text
sessions
────────────────────────
session_id
user_id
created_at
last_activity
authentication_level
current_risk_score
current_trust_score
status
```

Possible statuses:

```text
ACTIVE
REAUTH_REQUIRED
RESTRICTED
LOCKED
EXPIRED
```

However, highly sensitive short-lived session tokens should preferably remain in protected memory or secure storage rather than being unnecessarily persisted.

---

# 11. Risk Event Storage

Every significant change in security state can generate a risk event.

Example:

```text
risk_events
────────────────────────
event_id
user_id
session_id
timestamp
anomaly_score
risk_score
trust_score
reason
action_taken
```

Example event:

```text
Time:        14:35:21
Risk:        HIGH
Trust:       38
Reason:      Behavioral anomaly
Action:      MFA_REQUIRED
```

This becomes extremely useful for your security dashboard.

---

# 12. Authentication Event Storage

Authentication events should also be logged.

For example:

```text
authentication_events
────────────────────────
event_id
user_id
timestamp
event_type
success
failure_reason
```

Possible event types:

```text
LOGIN_SUCCESS
LOGIN_FAILED
MFA_SUCCESS
MFA_FAILED
REAUTH_SUCCESS
REAUTH_FAILED
SESSION_LOCKED
SESSION_UNLOCKED
```

This provides an **audit trail**.

---

# 13. Security Logs

Your dashboard could then show something like:

```text
SECURITY ACTIVITY
──────────────────────────────────────

10:02  Login successful
10:03  MFA verified
10:04  Monitoring started
11:37  Minor behavioral anomaly
11:38  Trust score: 72
11:42  Behavior normalized
13:16  High behavioral anomaly
13:17  Re-authentication requested
13:18  MFA verification failed
13:18  Session locked
```

This would make the application feel like a complete security product rather than only an ML demonstration.

---

# 14. Data Lifecycle

Another important part of your architecture is **how data moves through the system**.

```text
User Interaction
       ↓
Raw Events
       ↓
Feature Extraction
       ↓
Numerical Features
       ↓
Behavior Analysis
       ↓
Risk Evaluation
       ↓
Relevant Results Stored
```

The privacy-conscious design should aim for:

```text
Raw Event
   ↓
Process in Memory
   ↓
Extract Required Feature
   ↓
Discard Unnecessary Raw Data
   ↓
Store Aggregated Feature
```

This minimizes the amount of sensitive information retained.

---

# 15. Complete Data Flow

The complete storage flow could look like this:

```text
                   USER
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
      Keyboard                Mouse
          │                     │
          └──────────┬──────────┘
                     ▼
              Event Collector
                     │
                     ▼
             Feature Extraction
                     │
             Raw events discarded
                     │
                     ▼
             Feature Vector
                     │
          ┌──────────┴─────────┐
          ▼                    ▼
 Behavioral Profile      Anomaly Model
          │                    │
          └──────────┬─────────┘
                     ▼
                Risk Engine
                     │
                     ▼
              Security Decision
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
        Allow     Re-auth      Lock
                     │
                     ▼
              Security Event
                     │
                     ▼
              Local Database
```

---

# 16. Encryption Architecture

There are three different security mechanisms you should distinguish in your presentation.

### Password hashing

Used for passwords.

```text
Password
   ↓
Argon2id
   ↓
Password Hash
```

Hashing is **one-way**.

### Encryption

Used for data that the application needs to retrieve later.

```text
Sensitive Data
      ↓
Encryption
      ↓
Ciphertext
      ↓
Storage
```

### Secure key storage

The encryption key should not simply sit beside the encrypted database.

Bad:

```text
database.db
encryption_key.txt
```

Better:

```text
Encrypted Data
      │
      │
Application
      │
      ▼
OS Secure Storage
      │
Encryption Key
```

This distinction is worth mentioning if your panel asks, **"If your local database is encrypted, where is the key stored?"**

---

# 17. Threat Model for Local Storage

Local storage does **not automatically mean secure storage**.

Suppose someone steals the laptop and obtains:

```text
security.db
```

Your architecture should aim to prevent them from simply opening the file and reading sensitive information.

Therefore:

```text
                 ATTACKER
                    │
                    ▼
              Local Files
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
     Database             ML Profiles
          │                   │
          ▼                   ▼
      Protected           Protected
```

You should combine appropriate encryption, OS access controls, key protection and integrity checks.

---

# 18. Why Not Use Cloud Storage for Everything?

A centralized design would look like:

```text
Computer
   │
   │ Internet
   ▼
Cloud Server
   │
   ▼
Behavioral Database
```

For your core system, this creates unnecessary concerns:

* Internet dependency
* Network latency
* Centralized privacy risk
* Infrastructure cost
* Larger breach impact
* More complicated deployment

Your application doesn't require a server just to decide whether **the person currently using this particular computer behaves like its enrolled user**.

That computation can occur locally.

---

# 19. Local-First Architecture

Therefore:

```text
              USER'S COMPUTER
                     │
     ┌───────────────┼───────────────┐
     ▼               ▼               ▼
 Authentication   Behavioral       Risk
     Engine        Analysis        Engine
     │               │               │
     └───────────────┼───────────────┘
                     ▼
               Local Storage
                     │
                     ▼
              Security Action
```

Core functionality remains available even when:

```text
Internet = OFF
```

That is a significant advantage.

---

# 20. Optional Cloud Architecture

Later, you can extend the system without changing its local-first philosophy.

```text
                    USER DEVICE
                         │
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
        LOCAL SECURITY        OPTIONAL CLOUD
              │                     │
        Authentication        Encrypted Backup
        Behavior Model        Device Sync
        Risk Engine           Remote Alerts
        Local Logs            Analytics
                              Admin Dashboard
```

The **local security engine remains authoritative for immediate device protection**.

Cloud services provide additional capabilities rather than becoming a dependency for basic authentication.

---

# 21. Free vs Cloud/Premium Model

This also supports the product model we previously discussed.

### Core Local Version

```text
Authentication
MFA
Continuous Monitoring
Behavioral Authentication
Risk Detection
Local Security Logs
Local ML Model
Local Database
```

### Optional Cloud / Enterprise

```text
Encrypted Cloud Backup
Multi-device Synchronization
Remote Security Alerts
Centralized Dashboard
Organization Management
Cross-device Analytics
Security Reports
Device Management
```

So you could theoretically support millions of users without storing every user's raw behavioral profile centrally.

---

# 22. Recommended Final Storage Architecture

For the project prototype, I'd structure it like this:

```text
┌────────────────────────────────────────────┐
│            DESKTOP APPLICATION             │
│                                            │
│  React UI / Electron                       │
│              │                             │
│              ▼                             │
│      Local Security Backend                │
│              │                             │
│    ┌─────────┼─────────┐                   │
│    ▼         ▼         ▼                   │
│  Auth     Behavior    Risk                 │
│ Engine     Engine     Engine                │
│    │         │         │                   │
│    └─────────┼─────────┘                   │
│              ▼                             │
│        DATA ACCESS LAYER                   │
│              │                             │
│   ┌──────────┼──────────┐                  │
│   ▼          ▼          ▼                  │
│ SQLite    OS Secure   ML/Profile           │
│ Database   Storage     Storage             │
│   │          │          │                  │
│ Users      Keys       Baselines            │
│ Sessions   Secrets    Models               │
│ Events     MFA        Features              │
│ Logs                                       │
└─────────────────────┬──────────────────────┘
                      │
                 Optional TLS
                      │
                      ▼
             ┌──────────────────┐
             │  CLOUD SERVICES  │
             │                  │
             │ Backup           │
             │ Sync             │
             │ Remote Alerts    │
             │ Admin Dashboard  │
             └──────────────────┘
```

## 23. What Data Goes Where?

| Data                     | Storage                  | Protection                             |
| ------------------------ | ------------------------ | -------------------------------------- |
| Username                 | SQLite                   | DB/file protection                     |
| Password                 | **Never stored**         | —                                      |
| Password hash            | SQLite                   | Argon2id                               |
| MFA secret               | Secure storage           | OS-protected/encrypted                 |
| Keyboard timing features | Local profile/DB         | Protected                              |
| Actual typed text        | **Do not retain**        | —                                      |
| Mouse features           | Local profile/DB         | Protected                              |
| Behavioral baseline      | Local storage            | Encryption/integrity                   |
| ML model                 | Local model storage      | Integrity/access controls              |
| Risk scores              | SQLite                   | Protected DB                           |
| Security events          | SQLite/log storage       | Integrity/access controls              |
| Session metadata         | Memory + DB where needed | Protected                              |
| Encryption keys          | OS secure storage        | **Never plaintext beside DB**          |
| Cloud backup             | Optional cloud           | Client-side encryption where practical |

---

# 24. Important Design Principle

There are **four different concepts** that you should not mix together in your presentation:

**Authentication data** identifies the user.

**Behavioral data** helps determine whether the current user resembles the enrolled user.

**Security telemetry** records what happened.

**Cryptographic secrets** protect the other three.

Therefore:

```text
Authentication Data ──┐
Behavioral Data ──────┼──→ Secure Local Storage
Security Events ──────┘

Cryptographic Secrets ───→ OS Secure Storage
```

---

# 25. Presentation-Friendly Version

For your PPT, don't put the entire detailed architecture on one slide.

A clean **Data Storage Architecture** slide could simply show:

```text
                 DATA STORAGE ARCHITECTURE

                      Application
                          │
                    Data Access Layer
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    Local Database    Secure Storage   Model Storage
       SQLite          OS Protected      Local
          │               │               │
      Users           MFA Secrets     Behavioral
      Sessions        Crypto Keys     Profiles
      Risk Events                     ML Models
      Audit Logs
          │
          └───────────────┬───────────────┘
                          │
                    Local-First
                          │
                          ▼
                   Optional Cloud
                Backup • Sync • Admin
```

And underneath the diagram, keep only **three key points**:

* **Privacy-first:** Behavioral features and models remain local by default.
* **Secure storage:** Passwords are hashed; secrets and encryption keys receive stronger OS-backed protection.
* **Cloud-ready:** Optional encrypted backup, synchronization, remote alerts, and enterprise management can be added later.

This is the storage architecture I would recommend keeping consistent across your **architecture diagram, methodology, implementation plan, Review-1 presentation, and final project report**.
