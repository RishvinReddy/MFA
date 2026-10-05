# BioShield.ID — Test Credentials (3 Users)

The local SQLite database (`bioshield.db`) is pre-seeded with **3 test user accounts** representing distinct authorization levels and continuous authentication test cases.

---

## 1. System Administrator
- **Email:** `admin@bioshield.com`
- **Password:** `Password-Admin123!`
- **Role:** `ADMIN`
- **Purpose:** Access the Admin Command Center (`/admin`), view active sessions across all users, monitor threat levels, and execute session lockouts.

---

## 2. Standard Workstation User
- **Email:** `user@bioshield.com`
- **Password:** `Password-User123!`
- **Role:** `USER`
- **Purpose:** Test standard user login, progressive face verification step-up, continuous behavioral monitoring, and the dynamic trust meter ($87/100$).

---

## 3. Security Compliance Analyst
- **Email:** `analyst@bioshield.com`
- **Password:** `Password-Analyst123!`
- **Role:** `USER`
- **Purpose:** Test real-time security activity audit logging, typing/mouse anomaly telemetry, and compliance monitoring views.

---

## Testing Quick Reference

| # | Role | Email | Password | Primary Feature |
| :- | :--- | :--- | :--- | :--- |
| **1** | `ADMIN` | `admin@bioshield.com` | `Password-Admin123!` | Admin Command Center & Session Control |
| **2** | `USER` | `user@bioshield.com` | `Password-User123!` | Continuous Authentication & Trust Score |
| **3** | `USER` | `analyst@bioshield.com` | `Password-Analyst123!` | Security Activity & Telemetry Logs |

---

## How to Re-Seed Database

To reset or re-populate these 3 test users in SQLite, run:

```bash
cd backend
npx ts-node prisma/seed.ts
```
