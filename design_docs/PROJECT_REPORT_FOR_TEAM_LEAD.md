# BioShield MFA — Executive Project Report & Complete Architecture Specification

**Prepared for:** Technical Leadership, Project Review Panel & Engineering Team  
**Project Title:** Intelligent Continuous Authentication & Zero-Trust Desktop Security System (BioShield MFA 2025)  
**Document Version:** 2.0 (Upgraded & Re-architected)  
**Status:** Comprehensive Technical Specification & Prototype Architecture  

---

## Technical Lead Introduction & Rework Overview

I reviewed the previous **BioShield MFA** report and reworked it around the project's current direction. The old document described a web-oriented, PostgreSQL/Node.js biometric MFA platform and made several production-ready claims. 

The new report is substantially expanded and aligned with what we've finalized recently: **desktop-first continuous authentication, MFA, human biometrics, device trust, behavioral biometrics, dynamic risk scoring, adaptive authentication, local-first storage, secure secret storage, and optional cloud expansion**.

It covers the complete project across **49 sections**, including architecture, problem statement, objectives, MFA, fingerprint/face biometrics, device identity and TPM concepts, keyboard/mouse behavioral authentication, behavioral enrollment, anomaly detection, risk/trust engine, Zero-Trust principles, complete authentication workflow, SQLite/local storage architecture, secure secret storage, ML model storage, data lifecycle/privacy, technology stack, methodology, development phases, FAR/FRR evaluation, threat model, testing scenarios, functional/non-functional requirements, UI modules, implementation priorities, prototype success criteria, future development, and the final end-to-end architecture.

I also added a dedicated **“Changes From the Previous BioShield Report”** section so the team lead can clearly understand how the architecture evolved from the earlier version.

---

# Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Problem Statement — The Post-Login Security Gap](#2-problem-statement--the-post-login-security-gap)
3. [Proposed Solution — Continuous Adaptive Authentication](#3-proposed-solution--continuous-adaptive-authentication)
4. [Primary System Objectives](#4-primary-system-objectives)
5. [Core 6-Layer Architecture Overview](#5-core-6-layer-architecture-overview)
6. [Changes From the Previous BioShield Report](#6-changes-from-the-previous-bioshield-report)
7. [Authentication System (Module 1)](#7-authentication-system-module-1)
8. [Multi-Factor Authentication (MFA) & TOTP Module](#8-multi-factor-authentication-mfa--totp-module)
9. [Human Biometrics — Physiological Factor Integration](#9-human-biometrics--physiological-factor-integration)
10. [Biometric Data Storage & OS-Backed Security](#10-biometric-data-storage--os-backed-security)
11. [Extended Biometric Modalities (Iris & Voice Considerations)](#11-extended-biometric-modalities-iris--voice-considerations)
12. [Device Identity & Hardware Trust](#12-device-identity--hardware-trust)
13. [Trusted Platform Module (TPM) Integration](#13-trusted-platform-module-tpm-integration)
14. [Device Fingerprinting & Contextual Signals](#14-device-fingerprinting--contextual-signals)
15. [Trusted Device Enrollment & Lifecycle](#15-trusted-device-enrollment--lifecycle)
16. [Behavioral Monitoring — Keystroke Dynamics](#16-behavioral-monitoring--keystroke-dynamics)
17. [Behavioral Monitoring — Mouse Dynamics](#17-behavioral-monitoring--mouse-dynamics)
18. [Behavioral Profile Structure](#18-behavioral-profile-structure)
19. [Enrollment Phase & Baseline Generation](#19-enrollment-phase--baseline-generation)
20. [Feature Extraction Pipeline](#20-feature-extraction-pipeline)
21. [Behavioral Anomaly Detection Engine](#21-behavioral-anomaly-detection-engine)
22. [Machine Learning Algorithms & Models](#22-machine-learning-algorithms--models)
23. [Dynamic Risk Engine & Formula](#23-dynamic-risk-engine--formula)
24. [Trust Score Representation (100–0 Scale)](#24-trust-score-representation-1000-scale)
25. [Zero-Trust Security Principles](#25-zero-trust-security-principles)
26. [Adaptive Authentication & Risk Matrix](#26-adaptive-authentication--risk-matrix)
27. [Security Response Engine](#27-security-response-engine)
28. [Authentication Assurance Levels (AAL0–AAL3)](#28-authentication-assurance-levels-aal0aal3)
29. [Passkeys & FIDO2 Alignment](#29-passkeys--fido2-alignment)
30. [Local-First Storage Architecture](#30-local-first-storage-architecture)
31. [Three Main Local Storage Categories](#31-three-main-local-storage-categories)
32. [Recommended Local Database Schema (SQLite)](#32-recommended-local-database-schema-sqlite)
33. [MFA & Secret Storage (OS Keyring / DPAPI)](#33-mfa--secret-storage-os-keyring--dpapi)
34. [ML Model File Management & Security](#34-ml-model-file-management--security)
35. [Data Lifecycle & Privacy-by-Design](#35-data-lifecycle--privacy-by-design)
36. [End-to-End Authentication Data Flow](#36-end-to-end-authentication-data-flow)
37. [Encryption & Key Management Architecture](#37-encryption--key-management-architecture)
38. [Threat Model for Local Storage](#38-threat-model-for-local-storage)
39. [Why Local-First Superiority Over Cloud-Only](#39-why-local-first-superiority-over-cloud-only)
40. [Optional Cloud Services & Hybrid Extension](#40-optional-cloud-services--hybrid-extension)
41. [Commercial Tier Model (Free Local vs Enterprise Cloud)](#41-commercial-tier-model-free-local-vs-enterprise-cloud)
42. [Complete End-to-End Session Workflow (Steps 1–15)](#42-complete-end-to-end-session-workflow-steps-115)
43. [Detailed Attack Scenario Walkthrough](#43-detailed-attack-scenario-walkthrough)
44. [Proposed Technology Stack](#44-proposed-technology-stack)
45. [Development Methodology & Phases](#45-development-methodology--phases)
46. [Quantitative Evaluation Metrics (FAR, FRR, Latency)](#46-quantitative-evaluation-metrics-far-frr-latency)
47. [Functional & Non-Functional Requirements](#47-functional--non-functional-requirements)
48. [Desktop UI Modules & Security Dashboard](#48-desktop-ui-modules--security-dashboard)
49. [Final End-to-End Architecture & Presentation Defense Guide](#49-final-end-to-end-architecture--presentation-defense-guide)

---

# 1. Executive Summary

**BioShield MFA 2025** is an intelligent, desktop-based security application engineered to safeguard user endpoints not only at initial authentication, but **continuously throughout the entire active session**.

Traditional authentication mechanisms follow a static paradigm:
$$\text{User Login} \longrightarrow \text{Authentication Verified} \longrightarrow \text{Full Persistent Access}$$

BioShield MFA replaces this with a continuous Zero-Trust evaluation loop:
$$\text{Login} \longrightarrow \text{Initial MFA} \longrightarrow \text{Passive Monitoring} \longrightarrow \text{Feature Extraction} \longrightarrow \text{ML Anomaly Analysis} \longrightarrow \text{Dynamic Risk Score} \longrightarrow \text{Adaptive Policy Response}$$

By continuously measuring passive behavioral biometrics (keystroke dynamics and mouse interaction patterns) alongside explicit multi-factor credentials and hardware device attestation, the system dynamically calculates a real-time **Trust Score**. When anomalous behavior is detected, the system automatically triggers step-up verification or session lock.

---

# 2. Problem Statement — The Post-Login Security Gap

Standard desktop operating systems verify identity only at session initiation (password, PIN, or initial Windows Hello biometric). Once authenticated, the OS grants unrestricted access until explicit logout or automated screen-timeout lock.

This creates a critical vulnerability window:
$$\text{Authorized User Logs In} \longrightarrow \text{User Steps Away Unattended} \longrightarrow \text{Unauthorized Party Gains Access}$$

During this active session window, the operating system remains oblivious to the change of person operating the peripheral devices. BioShield MFA directly eliminates this post-login security gap.

---

# 3. Proposed Solution — Continuous Adaptive Authentication

The proposed solution introduces **continuous adaptive authentication**. Instead of asking a binary question at login ("Was this user authenticated?"), BioShield continuously asks:

> *"Does the active behavioral pattern still belong to the legitimate authenticated user?"*

The system ingests non-intrusive peripheral signals:
- Key hold/dwell time and flight time between keystrokes.
- Mouse movement velocity, acceleration, direction changes, and click intervals.
- Session contextual signals and device posture.

These inputs are processed locally by an Anomaly Detection Engine to adjust a dynamic Risk/Trust Score continuously.

---

# 4. Primary System Objectives

1. **Secure Multi-Factor Initiation:** Authenticate users initially via Argon2id hashed credentials, TOTP, and platform biometrics.
2. **Passive Continuous Biometric Monitoring:** Continuously sample keyboard and mouse dynamics without keylogging typed content.
3. **Behavioral Profile Baseline:** Build an adaptive user baseline during an initial enrollment phase.
4. **Machine Learning Anomaly Detection:** Classify real-time interaction features against user baselines using lightweight local ML models.
5. **Dynamic Risk Engine:** Combine behavioral anomaly scores, device trust, and context into a unified dynamic risk score.
6. **Adaptive Response Automation:** Trigger proportional responses (Allow, Monitor, Step-Up Verify, Restrict, Lock).
7. **Zero-Trust Session Management:** Enforce continuous re-verification rather than static session trust.
8. **Privacy-First Local Storage:** Retain all sensitive behavioral vectors and encryption secrets locally on the endpoint.

---

# 5. Core 6-Layer Architecture Overview

```text
┌────────────────────────────────────────────────────────┐
│              1. DESKTOP APPLICATION UI                 │
│              React UI • Electron Shell                 │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│               2. AUTHENTICATION LAYER                  │
│       Argon2id Passwords • TOTP MFA • Sessions         │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│           3. ACTIVITY MONITORING LAYER                 │
│     Keystroke Dynamics • Mouse Dynamics • Idle State   │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│       4. BEHAVIORAL INTELLIGENCE LAYER (ML)            │
│   Feature Vectorization • Isolation Forest / OCSVM     │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│              5. RISK & POLICY ENGINE                   │
│    Dynamic Trust Score (100-0) • Policy Decision       │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│            6. SECURITY RESPONSE ENGINE                 │
│      Allow • Step-Up MFA • Restrict • Session Lock     │
└────────────────────────────────────────────────────────┘
```

---

# 6. Changes From the Previous BioShield Report

To clarify system evolution for technical leadership, the key architectural shifts from the legacy BioShield report are highlighted below:

| Architectural Component | Legacy BioShield Platform | Upgraded BioShield MFA 2025 |
| :--- | :--- | :--- |
| **Application Target** | Web-based client (React + Vite browser app) | **Desktop-native application** (Electron + React frontend) |
| **Backend Architecture** | Remote Node.js Express server + REST API Gateway | **Local Python (FastAPI) Security Engine** + Desktop IPC |
| **Primary Database** | Remote PostgreSQL Relational DB via Prisma ORM | **Local-first SQLite** + OS Secure Key Storage (DPAPI/Keyring) |
| **Biometric Scope** | WebRTC Facial (ArcFace) & Audio Voice Passphrase | **Multi-Modal:** Physical Biometrics + **Keystroke & Mouse Dynamics** |
| **Device Attestation** | IP address & basic HTTP User-Agent string | **Hardware TPM Cryptographic Key Proofs** & Device Fingerprinting |
| **Authentication Flow** | Static 2FA at login point | **Continuous Zero-Trust Verification Loop** throughout active session |
| **Storage & Privacy** | Centralized database holding user vectors | **Privacy-by-Design Local-First:** Behavioral vectors stay on endpoint |

---

# 7. Authentication System (Module 1)

Module 1 governs primary account creation, credential verification, and session initiation. Passwords are salted and hashed locally using **Argon2id** (configured with memory cost $t=3$, $m=64\text{MB}$, $p=4$).

$$\text{Password} \longrightarrow \text{Argon2id Hashing Function} \longrightarrow \text{Secure Hash Vector} \longrightarrow \text{Local SQLite Storage}$$

Plaintext passwords are never retained in memory post-verification.

---

# 8. Multi-Factor Authentication (MFA) & TOTP Module

The MFA module implements Time-based One-Time Passwords (TOTP - RFC 6238) using HMAC-SHA1 algorithms with 30-second window rotation.

```text
Username + Password Verification
              ↓
  TOTP Secret Retrieval (from OS Keyring)
              ↓
   User Inputs 6-Digit Authenticator Code
              ↓
       Session Validation
```

TOTP is utilized both during initial login and as a step-up challenge during elevated risk events.

---

# 9. Human Biometrics — Physiological Factor Integration

Explicit physiological biometrics provide strong identity verification at login or during step-up re-authentication:
- **Fingerprint Verification:** Leverages platform biometric APIs (Windows Hello / OS Biometric Framework).
- **Facial Verification:** Camera-based facial verification incorporating liveness heuristics to prevent photograph and video replay attacks.

---

# 10. Biometric Data Storage & OS-Backed Security

BioShield MFA strictly avoids storing raw biometric images or templates directly in application files or SQLite databases. 

```text
Application Biometric Request ──> Platform Biometric API ──> OS Hardware Enclave (TPM/Secure Enclave)
                                                                       │
Application receives signed cryptographic proof <──────────────────────┘
```

All biometric matching is delegated to the operating system's secure enclave where supported.

---

# 11. Extended Biometric Modalities (Iris & Voice Considerations)

- **Iris Recognition:** Conceptually supported as a high-security inherence factor requiring specialized IR hardware.
- **Voice Biometrics:** Suitable for multimodal explicit verification, but constrained by ambient environmental noise and voice synthesis risks; excluded from continuous passive monitoring.

---

# 12. Device Identity & Hardware Trust

Device identity establishes whether authentication attempts originate from a known, trusted physical computer. Rather than relying on easily spoofed hardware properties, identity is established via cryptographic key pairs tied to the hardware.

---

# 13. Trusted Platform Module (TPM) Integration

On compatible hardware, BioShield binds device identity to the **Trusted Platform Module (TPM 2.0)**:
1. An asymmetric device key pair is generated inside the TPM during enrollment.
2. The private key remains non-exportable within the TPM hardware enclave.
3. During authentication, BioShield challenges the TPM to sign an anti-replay nonce using the non-exportable key.

---

# 14. Device Fingerprinting & Contextual Signals

Complementing hardware TPM proofs, BioShield gathers contextual device signals:
- OS build version and patch level.
- CPU/Hardware architecture identifiers.
- System integrity posture (Secure Boot state).

These attributes compose a composite device trust score.

---

# 15. Trusted Device Enrollment & Lifecycle

```text
Primary Login + MFA ──> Device Key Generation ──> Hardware Key Storage ──> Device Register Entry
```

If a session is initiated on an unrecognized device, the Risk Engine automatically elevates initial MFA requirements to Level 3.

---

# 16. Behavioral Monitoring — Keystroke Dynamics

Keystroke dynamics measure *how* a user types rather than *what* is typed:
- **Dwell Time ($T_d$):** Time duration a key remains depressed ($\text{KeyUp} - \text{KeyDown}$).
- **Flight Time ($T_f$):** Inter-key delay between consecutive key releases and presses ($\text{KeyDown}_{n+1} - \text{KeyUp}_n$).
- **Di-graph & Tri-graph Latencies:** Timing intervals across frequent character pairs.
- **Typing Rhythm & Error Rate:** Frequency of Backspace/Delete usage.

---

# 17. Behavioral Monitoring — Mouse Dynamics

Mouse interaction patterns provide continuous passive signals during GUI navigation:
- Movement velocity ($\text{px/ms}$) and acceleration vectors.
- Trajectory curvature and directional changes.
- Click dwell time and double-click interval timing.
- Scroll speed and pause frequencies.

---

# 18. Behavioral Profile Structure

A user's baseline behavioral profile aggregates statistical distributions across keyboard and mouse features:

```text
Behavioral Profile (User Baseline)
├── Keystroke Metrics: [Mean Dwell Time, StdDev Dwell, Mean Flight Time, Rhythm Vector]
├── Mouse Metrics: [Avg Velocity, Peak Acceleration, Trajectory Curvature Index, Click Latency]
└── Session Metrics: [Idle Interval Mean, Active Window Frequency]
```

---

# 19. Enrollment Phase & Baseline Generation

During the initial enrollment phase (e.g., first 500 keystrokes and 200 mouse movements), the application runs in **Learning Mode**:

$$\text{Interaction Events} \longrightarrow \text{Feature Vector Sampling} \longrightarrow \text{Statistical Model Training} \longrightarrow \text{Baseline Profile Established}$$

During enrollment, risk-based session locks are suppressed, and the user is prompted for standard MFA if required.

---

# 20. Feature Extraction Pipeline

Raw hardware events are captured by native low-level OS hooks, converted into sliding window feature vectors in memory, and immediately cleared.

```text
Raw Keyboard/Mouse Events ──> Sliding Window Buffer (60s) ──> Feature Extraction ──> Feature Vector [F1...Fn]
                                                                                           │
Raw Events Discarded From Memory <─────────────────────────────────────────────────────────┘
```

---

# 21. Behavioral Anomaly Detection Engine

The Anomaly Engine evaluates incoming feature vectors against the enrolled user's baseline profile to generate an Anomaly Score $B \in [0.0, 1.0]$:

$$\begin{aligned}
B \le 0.20 &\implies \text{Normal User Behavior} \\
0.20 < B \le 0.60 &\implies \text{Slight Variation / Low Anomaly} \\
0.60 < B \le 0.85 &\implies \text{Suspicious Deviation} \\
B > 0.85 &\implies \text{Critical Anomaly / High Unauthorized Likelihood}
\end{aligned}$$

---

# 22. Machine Learning Algorithms & Models

To maintain low CPU overhead on user hardware, BioShield utilizes non-parametric anomaly detection algorithms via Scikit-learn:
1. **Isolation Forest:** Efficiently isolates anomalous vectors by randomly partitioning feature space.
2. **One-Class SVM (OCSVM):** Constructs a tight non-linear decision boundary around normal user baseline vectors.

Performance is benchmarked locally to select the optimal model per user profile.

---

# 23. Dynamic Risk Engine & Formula

The total dynamic Risk Score ($R$) combines behavioral anomalies, authentication status, session context, and device security state:

$$R = (w_b \times B) + (w_a \times A) + (w_s \times S) + (w_c \times C)$$

Where:
- $B$ = Behavioral Anomaly Score $[0, 100]$
- $A$ = Authentication Age/Status Factor $[0, 100]$
- $S$ = Session Risk Signal $[0, 100]$
- $C$ = Contextual Device Risk $[0, 100]$
- $w_b, w_a, w_s, w_c$ = Configured Weight Coefficients ($\sum w = 1.0$)

---

# 24. Trust Score Representation (100–0 Scale)

For intuitive user visualization on the security dashboard, the Risk Score ($R$) is converted to a dynamic **Trust Score** ($T$):

$$T = 100 - R$$

```text
100 ──────────────────── Fully Trusted Session (Normal Operations)
 80 ──────────────────── Minor Deviation (Background Monitoring)
 60 ──────────────────── Elevated Risk (Warning Threshold)
 40 ──────────────────── High Risk (Step-Up Re-Authentication Triggered)
 20 ──────────────────── Critical Risk (Session Access Restricted)
  0 ──────────────────── Untrusted (Immediate System Lock)
```

---

# 25. Zero-Trust Security Principles

BioShield enforces continuous Zero-Trust operational rules:
- **Never Trust, Always Verify:** Session validity is re-evaluated every 5–10 seconds.
- **Explicit Risk Verification:** Trust degrades automatically over time or with behavioral deviation.
- **Least Privilege Access:** High-risk scores restrict sensitive application functions.

---

# 26. Adaptive Authentication & Risk Matrix

| Risk Level | Trust Score Range | System Action | Required Verification |
| :--- | :--- | :--- | :--- |
| **Low** | $80 - 100$ | Allow Normal Session | Continuous Passive Monitoring |
| **Moderate** | $60 - 79$ | Increase Sampling Rate | Background Monitoring |
| **Elevated** | $40 - 59$ | Step-Up Prompt | Password / PIN Re-Verification |
| **High** | $20 - 39$ | Restrict Sensitive Actions | TOTP / Platform Biometric |
| **Critical** | $0 - 19$ | Session Lock | Full Primary Login + MFA |

---

# 27. Security Response Engine

The Security Response Engine translates policy decisions into immediate OS/Application actions:

```text
Policy Decision ──> ALLOW     ──> Continue Session Loop
                ──> MONITOR   ──> Decrease Sampling Interval (Higher Sensitivity)
                ──> VERIFY    ──> Display Step-Up Re-Auth Modal
                ──> RESTRICT  ──> Lock Vault / Block Sensitive Actions
                ──> LOCK      ──> Trigger OS Screen Lock & Suspend Session Token
```

---

# 28. Authentication Assurance Levels (AAL0–AAL3)

1. **AAL0:** Unauthenticated state.
2. **AAL1:** Primary password verified.
3. **AAL2:** Password + TOTP / Biometric verified.
4. **AAL3:** Password + Biometric + Hardware TPM Device Attestation.
5. **Continuous AAL:** Dynamic session state maintained by ongoing behavioral confidence.

---

# 29. Passkeys & FIDO2 Alignment

BioShield MFA architecture is engineered for future integration with **FIDO2 / WebAuthn** standards, enabling passwordless authentication using public-key cryptography bound to TPM authenticators.

---

# 30. Local-First Storage Architecture

To protect user privacy and eliminate reliance on external cloud servers, BioShield utilizes a **Local-First Storage Architecture**.

```text
ENDPOINT LOCAL STORAGE
├── Structured Data: SQLite Database (`security.db`)
├── Cryptographic Secrets: OS Secure Key Storage (DPAPI / Windows Credential Manager)
└── Behavioral Models: Local Serialized Models (`/models/user_profile.pkl`)
```

---

# 31. Three Main Local Storage Categories

| Storage Layer | Security Mechanism | Stored Content |
| :--- | :--- | :--- |
| **SQLite Database** | Encrypted SQLCipher / Local File Permissions | User records, sessions, risk events, security audit logs |
| **OS Secure Storage** | Windows DPAPI / macOS Keychain / Linux Secret Service | Master encryption keys, TOTP secrets, device private keys |
| **Local Model Storage** | Integrity Hashing & Restricted Directory ACLs | Feature baseline matrices, trained Isolation Forest models |

---

# 32. Recommended Local Database Schema (SQLite)

```sql
-- Users Table
CREATE TABLE users (
    user_id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    mfa_enabled INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Active Sessions Table
CREATE TABLE sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    trust_score INTEGER DEFAULT 100,
    status TEXT NOT NULL, -- ACTIVE, STEP_UP_REQUIRED, LOCKED
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(user_id)
);

-- Risk Events Table
CREATE TABLE risk_events (
    event_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    anomaly_score REAL NOT NULL,
    risk_score INTEGER NOT NULL,
    action_taken TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

# 33. MFA & Secret Storage (OS Keyring / DPAPI)

TOTP shared secrets and database encryption keys are encrypted using **Windows Data Protection API (DPAPI)** on Windows endpoints:

$$\text{Plaintext Secret} \stackrel{\text{Win32 DPAPI CryptProtectData}}{\longrightarrow} \text{Ciphertext Encrypted Key Vector}$$

Only the authenticated Windows user session can decrypt these secrets.

---

# 34. ML Model File Management & Security

Trained machine learning model files (`user_baseline.model`) are stored in the local application data folder. Model file checksums (SHA-256) are registered in the local database to detect tampering prior to model loading.

---

# 35. Data Lifecycle & Privacy-by-Design

BioShield strictly adheres to **Privacy-by-Design** principles:
- **No Keylogging:** Keystroke contents, character strings, and typed text are **never recorded**.
- **Ephemeral Event Capture:** Raw millisecond timestamps are processed in volatile RAM memory and immediately discarded once feature vectors are calculated.
- **Local Data Retention:** Behavioral vectors remain stored exclusively on the endpoint.

---

# 36. End-to-End Authentication Data Flow

```text
Peripheral Interactions (Keyboard/Mouse)
                   │
                   ▼
  OS Low-Level Input Hooks (RAM Only)
                   │
                   ▼
  Feature Extraction (Dwell/Flight/Velocity)
  [Raw Timestamps Discarded]
                   │
                   ▼
  Local ML Model Anomaly Scoring
                   │
                   ▼
  Risk Engine Trust Score Update (100 -> 0)
                   │
                   ▼
  Policy Engine Response (Allow / Step-Up / Lock)
                   │
                   ▼
  Audit Log Entry in Local SQLite DB
```

---

# 37. Encryption & Key Management Architecture

All local persistent data is encrypted at rest using **AES-256-GCM**. The master key is derived via Argon2id from user credentials and combined with an OS DPAPI-backed key secret.

---

# 38. Threat Model for Local Storage

| Threat Vector | Risk Level | Countermeasure / Security Control |
| :--- | :--- | :--- |
| **Physical Theft of Device File** | High | Database encrypted via AES-256; secrets locked in OS DPAPI |
| **Local Model Tampering** | Medium | SHA-256 HMAC integrity verification prior to model execution |
| **Memory Scraping Attacks** | Medium | Secret zeroization in RAM immediately after key derivation |
| **Malicious Keylogging Malware** | High | System measures timing metrics rather than raw key events; OS integrity checks |

---

# 39. Why Local-First Superiority Over Cloud-Only

1. **Zero Internet Dependence:** Continuous security operates fully offline.
2. **Ultra-Low Latency:** Behavioral analysis executes locally in $<15\text{ms}$.
3. **Absolute Data Privacy:** Sensitive biometric profiles never traverse cloud networks.
4. **Reduced Infrastructure Cost:** No costly server clusters needed to process continuous endpoint telemetry.

---

# 40. Optional Cloud Services & Hybrid Extension

For enterprise deployments, an optional cloud sync module can be enabled:

```text
LOCAL ENDPOINT ENGINE (Authoritative Security Core)
             │
             ├── Optional Encrypted Cloud Backup
             ├── Centralized Admin Security Dashboard
             └── Remote Session Revocation & Incident Alerts
```

---

# 41. Commercial Tier Model (Free Local vs Enterprise Cloud)

- **Community / Local Tier (Free):** Full desktop protection, continuous behavioral authentication, SQLite storage, local MFA, complete offline support.
- **Enterprise Tier (Paid):** Centralized SIEM logging integration, organizational policy management, remote endpoint locking, encrypted cloud profile sync.

---

# 42. Complete End-to-End Session Workflow (Steps 1–15)

```text
1. Desktop Application Initiated
2. Primary Credential Check (Username + Password Hash)
3. Factor 2 Verification (TOTP / Biometric)
4. TPM Hardware Device Attestation
5. Active Session Established (Trust Score = 100)
6. Passive Peripheral Monitoring Activated
7. Real-Time Feature Vector Computation
8. ML Anomaly Model Evaluation
9. Anomaly Score Computed ($B$)
10. Dynamic Risk Engine Calculates Risk Score ($R$)
11. Trust Score Updated ($T = 100 - R$)
12. Policy Engine Evaluates Risk Matrix Thresholds
13. Action Execution (Allow / Step-Up / Lock)
14. Audit Event Recorded to SQLite
15. Continuous Feedback Loop Repeats (Every 5 Seconds)
```

---

# 43. Detailed Attack Scenario Walkthrough

### Stage 1: Legitimate Session
User Rishvin authenticates via Password + TOTP on his enrolled laptop.  
$$\text{Trust Score} = 96 \implies \text{Normal Allowed Access}$$

### Stage 2: User Steps Away
Rishvin leaves his laptop unlocked in a coffee shop. An unauthorized third party sits at the keyboard.

### Stage 3: Behavioral Anomaly Detected
The third party begins typing and moving the mouse.
- Typing flight time increases from Rishvin's baseline ($110\text{ms}$) to $245\text{ms}$.
- Mouse velocity and trajectory curvature deviate significantly.
- Anomaly Score spikes: $B = 0.82$.

### Stage 4: Trust Score Degradation & Step-Up
$$\text{Risk Score} \uparrow \implies \text{Trust Score Drops}: 96 \longrightarrow 72 \longrightarrow 48 \longrightarrow 28$$
At $T = 48$, system triggers **Step-Up Verification Modal** (Requesting TOTP / Fingerprint).

### Stage 5: Session Lock Enforcement
The intruder cannot provide the TOTP/Fingerprint. Verification times out.  
$$\text{Trust Score} \longrightarrow 0 \implies \text{Immediate OS Screen Lock Executed}$$

---

# 44. Proposed Technology Stack

| Architecture Component | Chosen Technology | Rationale |
| :--- | :--- | :--- |
| **Desktop Shell** | Electron Framework | Cross-platform desktop native wrapper |
| **Frontend UI** | React 19 + TypeScript | High-performance dynamic component rendering |
| **Local Security Engine** | Python 3.10+ (FastAPI) | Native ML integration (Scikit-learn / NumPy) |
| **Local Database** | SQLite (SQLCipher) | Serverless, lightweight, embedded local database |
| **Password Hashing** | Argon2id | Memory-hard key derivation resistant to GPU cracking |
| **Secrets Protection** | Windows DPAPI / Keyring | Hardware/OS-backed secret encryption |
| **Machine Learning** | Scikit-learn (Isolation Forest) | Interpretable, lightweight local anomaly detection |

---

# 45. Development Methodology & Phases

The project follows an **Iterative Prototype-and-Evaluate Methodology**:

```text
Phase 1: Requirements & Security Architecture Specifications
Phase 2: Local Core Authentication & Argon2id Hashing Module
Phase 3: MFA / TOTP Engine & OS Secret Storage Integration
Phase 4: Low-Level Peripheral Event Collector (Keystroke / Mouse Hooks)
Phase 5: Feature Extraction Pipeline & Data Normalization
Phase 6: Anomaly Engine Development (Isolation Forest Model)
Phase 7: Dynamic Risk & Policy Engine Construction
Phase 8: Security Response Engine (OS Lock Integration)
Phase 9: Desktop React UI Dashboard & Visualizations
Phase 10: Comprehensive Testing, Empirical Evaluation & Tuning
```

---

# 46. Quantitative Evaluation Metrics (FAR, FRR, Latency)

System performance and accuracy are evaluated using standard biometric metrics:

### False Acceptance Rate (FAR)
Percentage of unauthorized session intrusions incorrectly accepted as legitimate:
$$\text{FAR} = \frac{\text{Unauthorized Sessions Accepted}}{\text{Total Unauthorized Intrusion Attempts}} \times 100\%$$

### False Rejection Rate (FRR)
Percentage of legitimate user actions incorrectly flagged as anomalous:
$$\text{FRR} = \frac{\text{Legitimate User Sessions Rejected}}{\text{Total Legitimate Verification Sessions}} \times 100\%$$

Target Benchmark Parameters:
- $\text{FAR} < 1.0\%$
- $\text{FRR} < 3.0\%$
- **Detection Latency:** $< 15 \text{ Seconds}$
- **System Overhead:** $< 3\% \text{ CPU Usage}$, $< 120\text{MB RAM}$

---

# 47. Functional & Non-Functional Requirements

### Functional Requirements
1. Secure user registration with password hashing.
2. Multi-Factor Authentication via TOTP and platform biometrics.
3. Passive collection of keystroke dwell/flight times and mouse metrics.
4. Automatic baseline profile generation during enrollment.
5. Real-time anomaly detection using Isolation Forest models.
6. Continuous dynamic Risk and Trust Score computation.
7. Automated adaptive responses (Step-Up verification, screen locking).
8. Comprehensive local audit logging.

### Non-Functional Requirements
1. **Security:** Credentials protected via Argon2id; secrets DPAPI-encrypted.
2. **Privacy:** Zero keylogging; raw inputs cleared immediately from memory.
3. **Performance:** Low resource overhead ($<3\%\text{ CPU}$).
4. **Reliability:** Fully operational without internet connectivity.

---

# 48. Desktop UI Modules & Security Dashboard

The desktop application UI features three core views:
1. **Authentication Portal:** Login, Registration, TOTP Enrollment, and Step-Up Modal.
2. **Live Security Dashboard:** Real-time Trust Score meter ($100-0$), current risk state, recent peripheral activity metrics, and session timer.
3. **Audit & Event Log Viewer:** Historical security logs detailing risk events, step-up triggers, and authentication events.

---

# 49. Final End-to-End Architecture & Presentation Defense Guide

### Summary Architecture

```text
                                PHYSICAL USER
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │     Desktop UI (React)       │
                       └──────────────┬───────────────┘
                                      │ IPC
                                      ▼
                       ┌──────────────────────────────┐
                       │   Local Security Backend     │
                       │     (Python / FastAPI)       │
                       └──────────────┬───────────────┘
                                      │
           ┌──────────────────────────┼──────────────────────────┐
           ▼                          ▼                          ▼
┌────────────────────┐     ┌────────────────────┐     ┌────────────────────┐
│ Primary Auth & MFA │     │ Activity Monitors  │     │ Anomaly ML Engine  │
│ Argon2id + TOTP    │     │ Keyboard & Mouse   │     │ Isolation Forest   │
└──────────┬─────────┘     └──────────┬─────────┘     └──────────┬─────────┘
           │                          │                          │
           └──────────────────────────┼──────────────────────────┘
                                      ▼
                       ┌──────────────────────────────┐
                       │    Dynamic Risk Engine       │
                       │   Trust Score (100 -> 0)     │
                       └──────────────┬───────────────┘
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │   Security Response Engine   │
                       │  Allow • Step-Up • OS Lock   │
                       └──────────────┬───────────────┘
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │  Local Storage (SQLite/DPAPI)│
                       └──────────────────────────────┘
```

### Presentation Defense Synopsis
When presenting the project to technical reviewers or academic panels, summarize the project core in one statement:

> *"BioShield MFA 2025 is an intelligent desktop security system that extends identity verification beyond initial login. After authenticating users via passwords and MFA, it passively analyzes behavioral characteristics (keystroke and mouse dynamics) against a locally trained machine learning baseline. The system dynamically updates a real-time Trust Score, executing adaptive step-up challenges or OS screen locks whenever anomalous behavior is detected. Built on a privacy-first, local-first architecture with hardware TPM attestation, BioShield delivers continuous Zero-Trust session security without relying on external cloud infrastructure."*

---
