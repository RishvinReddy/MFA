
export enum AuthStage {
  LOGIN = 'LOGIN',
  FACE_SCAN = 'FACE_SCAN',
  PALM_SCAN = 'PALM_SCAN',
  FINGERPRINT_SCAN = 'FINGERPRINT_SCAN',
  VOICE_VERIFY = 'VOICE_VERIFY',
  MFA_VERIFY = 'MFA_VERIFY',
  COGNITIVE = 'COGNITIVE',
  XAI_REVIEW = 'XAI_REVIEW',
  DASHBOARD = 'DASHBOARD',
  USER_SETTINGS = 'USER_SETTINGS',
  ADMIN = 'ADMIN',
  RESTRICTED = 'RESTRICTED'
}

export interface LogEntry {
  id: string;
  timestamp: string;
  user: string;
  event: string;
  riskScore: number;
  location: string;
  status: 'SUCCESS' | 'FAILED' | 'FLAGGED';
}

export interface RiskAnalysisResult {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  summary: string;
  recommendations: string[];
}

export enum BiometricStatus {
  IDLE = 'IDLE',
  SCANNING = 'SCANNING',
  VERIFYING = 'VERIFYING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED'
}

export interface BehavioralMetrics {
  typingVariance: number;
  mousePathEfficiency: number;
  interactionTime: number;
  keystrokes?: { key: string; dwell: number; flight: number }[];
  mouseEvents?: { x: number; y: number; time: number }[];
}

export interface ThreatEvent {
  id: string;
  type: 'SYNTHETIC_VOICE' | 'GAN_FACE' | 'REPLAY_ATTACK' | 'INJECTION' | 'ADVERSARIAL_NOISE' | 'DURESS_SIGNAL';
  source: string;
  severity: 'HIGH' | 'CRITICAL';
  timestamp: string;
}

export interface PrivacySetting {
  id: string;
  label: string;
  enabled: boolean;
  description: string;
  category: 'ESSENTIAL' | 'OPTIONAL' | 'ANALYTICS';
}

export interface BiometricAsset {
  id: string;
  type: 'FACE' | 'VOICE' | 'PALM' | 'BEHAVIORAL' | 'FINGERPRINT';
  status: 'ENROLLED' | 'REVOKED';
  enrolledDate: string;
  lastUsed: string;
  dataHash: string;
}

export interface DataAccessLog {
  id: string;
  timestamp: string;
  actor: string;
  action: 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT';
  resource: string;
  purpose: string;
}

export interface SwarmDevice {
  id: string;
  name: string;
  type: 'WATCH' | 'PHONE' | 'TABLET' | 'LAPTOP' | 'IOT';
  status: 'TRUSTED' | 'VERIFYING' | 'COMPROMISED' | 'OFFLINE';
  battery: number;
  signalStrength: number;
}

export interface PolicyEvent {
  id: string;
  timestamp: string;
  trigger: string;
  action: string;
  status: 'APPLIED' | 'PENDING';
}

export interface IdentityCard {
  id: string;
  issuer: string;
  type: 'GOV_ID' | 'CORPORATE' | 'HEALTH' | 'BANKING' | 'HONEYPOT';
  status: 'VERIFIED' | 'EXPIRED' | 'REVOKED' | 'DECEPTIVE';
  expiryDate: string;
  trustLevel: 'L1' | 'L2' | 'L3';
}

export interface PrivacyTransaction {
  id: string;
  action: string;
  cost: number;
  timestamp: string;
}

export interface TrustContact {
  id: string;
  name: string;
  relation: string;
  status: 'ACTIVE' | 'PENDING' | 'LOCKED';
  lastVerified: string;
}

export interface WearableTelemetry {
  heartRate: number;
  skinTemp: number;
  isWearing: boolean;
  accelerometer: { x: number, y: number, z: number };
  rssi: number; // Signal strength
}

export interface SecurityTimelineEvent {
  id: string;
  timestamp: string;
  type: 'LIVENESS_CHECK' | 'CHALLENGE' | 'ANOMALY' | 'LOGIN' | 'DEVICE_PAIRING' | 'SECURITY_LOCK' | 'SILENT_ALARM';
  status: 'PASSED' | 'FAILED' | 'WARNING' | 'CRITICAL';
  description: string;
  riskScore: number;
  aiExplanation?: string;
}

export interface ForensicSample {
  id: string;
  type: 'AUDIO' | 'VIDEO' | 'BEHAVIOR';
  timestamp: string;
  duration: number;
  flaggedReason: string;
  meta: {
    frequencyCutoff?: number;
    jitter?: number;
    shimmer?: number;
    compressionArtifacts?: number;
  }
}

// ─── Authentication policy environment ───────────────────────────────────────
// Set to 'PRODUCTION' to disable development bypasses.
export type AppEnvironment = 'DEVELOPMENT' | 'PRODUCTION';
export const APP_ENVIRONMENT: AppEnvironment = 'DEVELOPMENT';

// ─── Canonical factor status ──────────────────────────────────────────────────
// PENDING    — not yet evaluated
// VERIFYING  — in progress
// VERIFIED   — real biometric match confirmed (alias: PASSED for VerificationResult compat)
// FAILED     — biometric check ran and failed
// UNAVAILABLE— hardware/service not reachable; policy decides whether to continue
// BYPASSED   — explicitly skipped (DEVELOPMENT only, must never appear in PRODUCTION builds)
export type FactorStatus =
    | 'PENDING'
    | 'VERIFYING'
    | 'VERIFIED'
    | 'FAILED'
    | 'UNAVAILABLE'
    | 'BYPASSED';

export type VerificationResult =
    | { status: "PENDING" }
    | { status: "PASSED"; evidenceId: string; timestamp?: number }
    | { status: "FAILED"; reason: string }
    | { status: "UNAVAILABLE"; reason: string }
    | { status: "BYPASSED"; reason: string };

export interface AuthenticationFlow {
    flowId: string;
    status: "IN_PROGRESS" | "COMPLETED" | "FAILED" | "EXPIRED";
    currentStage: "FACE" | "VOICE" | "DECISION";
    face: VerificationResult;
    voice: VerificationResult;
    startedAt: number;
    expiresAt: number;
}

// ─── Local Profile Registry ───────────────────────────────────────────────────
// NOTE: This interface intentionally contains NO biometric data.
// Biometric references live in the protected biometric store, keyed by profileId.
// In production, replace localProfileService's localStorage calls with a native
// BioShield profile store API.

export interface LocalProfile {
    id: string;
    email?: string;
    userId?: string;
    firstName: string;
    lastName: string;
    displayName: string;   // firstName + " " + lastName
    initials: string;      // e.g. "RR"
    role: 'USER' | 'ADMIN';
    isPrimary: boolean;
    createdAt: number;
    updatedAt: number;
    enrollment: {
        face: boolean;
        voice: boolean;
        fingerprint: boolean;
        cognitive: boolean;
        pin: boolean;
    };
    // TODO(production): remove _devPin — replace with native secure credential call
    _devPin?: string;
}

export interface LocalProfileRegistry {
    schemaVersion: number;
    profiles: LocalProfile[];
    activeProfileId: string | null;
}

export type LoginView =
    | 'WELCOME_SETUP'
    | 'PROFILE_SELECT'
    | 'UNLOCK'
    | 'PIN_UNLOCK'
    | 'ADD_USER_AUTH'
    | 'SECURE_ACTION_AUTH'
    | 'ENROLL';

export type EnrollmentMode =
    | 'FIRST_PROFILE'
    | 'ADDITIONAL_PROFILE'
    | 'RESUME';

export interface AddProfileAuthorization {
    purpose: 'ADD_LOCAL_PROFILE';
    authorizedProfileId: string;
    issuedAt: number;
    expiresAt: number;   // 5-minute TTL
}

export type SecureAction =
    | "NONE"
    | "UNLOCK"
    | "MANAGE_PROFILES"
    | "ADD_LOCAL_USER"
    | "EDIT_PROFILE"
    | "REENROLL_FACE"
    | "REENROLL_VOICE"
    | "CHANGE_PIN"
    | "DELETE_PROFILE";

export type PendingSecureAction = SecureAction;

export interface SecureActionContext {
    action: SecureAction;
    authorizingProfileId: string;
    createdAt: number;
    expiresAt: number;
    returnTo?: string;
}

export type AuthenticationPurpose =
    | "UNLOCK"
    | "LOGIN"
    | "MANAGE_PROFILES"
    | "ADD_PROFILE"
    | "ADD_LOCAL_USER"
    | "MODIFY_BIOMETRICS"
    | "REENROLL_BIOMETRICS"
    | "DELETE_PROFILE";

export interface AuthenticationContext {
    flowId: string;
    profileId: string;
    purpose: AuthenticationPurpose;
    startedAt: number;
    expiresAt: number;
}


