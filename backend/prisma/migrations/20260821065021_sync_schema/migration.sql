/*
  Warnings:

  - You are about to drop the column `riskScore` on the `AuthSession` table. All the data in the column will be lost.
  - You are about to drop the column `isDisabled` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "WebAuthnCredential" ADD COLUMN "transports" TEXT;

-- CreateTable
CREATE TABLE "EnrollmentToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'INITIAL_ENROLLMENT',
    CONSTRAINT "EnrollmentToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EnrollmentState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "passwordEnrolled" BOOLEAN NOT NULL DEFAULT false,
    "faceEnrolled" BOOLEAN NOT NULL DEFAULT false,
    "voiceEnrolled" BOOLEAN NOT NULL DEFAULT false,
    "recoveryConfigured" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EnrollmentState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrustEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "previousState" TEXT NOT NULL,
    "newState" TEXT NOT NULL,
    "reason" TEXT,
    "confidenceScore" REAL,
    "riskLevel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrustEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SecurityConfiguration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" INTEGER NOT NULL DEFAULT 1,
    "passwordPolicy" JSONB,
    "maxFailedAttempts" INTEGER NOT NULL DEFAULT 5,
    "lockoutDurationMins" INTEGER NOT NULL DEFAULT 15,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FusionConfiguration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" INTEGER NOT NULL DEFAULT 1,
    "faceWeight" REAL NOT NULL DEFAULT 0.4,
    "voiceWeight" REAL NOT NULL DEFAULT 0.3,
    "behaviorWeight" REAL NOT NULL DEFAULT 0.2,
    "deviceWeight" REAL NOT NULL DEFAULT 0.1,
    "minimumFaceConfidence" REAL NOT NULL DEFAULT 0.7,
    "minimumVoiceConfidence" REAL NOT NULL DEFAULT 0.7,
    "signalExpirySeconds" INTEGER NOT NULL DEFAULT 300,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AuthSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "riskLevel" TEXT,
    "identityConfidence" REAL,
    "trustState" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "mfaUsed" TEXT,
    "mfaRequired" BOOLEAN NOT NULL DEFAULT false,
    "isSuccessful" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" DATETIME,
    "refresh_token_hash" TEXT,
    "previous_refresh_token_hash" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "biometricScore" REAL,
    "biometricType" TEXT,
    CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AuthSession" ("biometricScore", "biometricType", "createdAt", "device", "expires_at", "id", "ipAddress", "isActive", "isSuccessful", "mfaRequired", "mfaUsed", "previous_refresh_token_hash", "refresh_token_hash", "updatedAt", "userAgent", "userId") SELECT "biometricScore", "biometricType", "createdAt", "device", "expires_at", "id", "ipAddress", "isActive", "isSuccessful", "mfaRequired", "mfaUsed", "previous_refresh_token_hash", "refresh_token_hash", "updatedAt", "userAgent", "userId" FROM "AuthSession";
DROP TABLE "AuthSession";
ALTER TABLE "new_AuthSession" RENAME TO "AuthSession";
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");
CREATE INDEX "AuthSession_refresh_token_hash_idx" ON "AuthSession"("refresh_token_hash");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "fullName" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ENROLLMENT_REQUIRED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "mfaSecretEnc" TEXT,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "currentChallenge" TEXT,
    "biometricAttempts" INTEGER NOT NULL DEFAULT 0,
    "biometricLockedUntil" DATETIME
);
INSERT INTO "new_User" ("biometricAttempts", "biometricLockedUntil", "createdAt", "email", "failedAttempts", "id", "lockedUntil", "mfaEnabled", "mfaSecretEnc", "passwordHash", "role", "updatedAt") SELECT "biometricAttempts", "biometricLockedUntil", "createdAt", "email", "failedAttempts", "id", "lockedUntil", "mfaEnabled", "mfaSecretEnc", "passwordHash", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentToken_tokenHash_key" ON "EnrollmentToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentState_userId_key" ON "EnrollmentState"("userId");
