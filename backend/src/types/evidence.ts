export type HumanModality = 'FACE' | 'VOICE' | 'BEHAVIOR_KEYBOARD' | 'BEHAVIOR_MOUSE';
export type DeviceModality = 'WEBAUTHN' | 'DEVICE_IDENTITY' | 'TRUSTED_POSTURE' | 'DEVICE' | 'PASSWORD';

export type IdentityModality = HumanModality | DeviceModality;

export type EvidenceStatus = 'PASS' | 'FAIL' | 'UNAVAILABLE' | 'INSUFFICIENT_DATA' | 'ERROR' | 'STALE';

export type FusionDecision = 'MATCH' | 'LOW_CONFIDENCE' | 'CONFLICT' | 'SPOOF_DETECTED' | 'INSUFFICIENT_EVIDENCE';

export interface NormalizedEvidence {
    source: string;               // e.g., 'BiometricService', 'BehavioralEngine'
    category: 'HUMAN' | 'DEVICE';
    modality: IdentityModality;
    status: EvidenceStatus;
    
    confidence: number;           // Raw model score (0.0 to 1.0)
    quality: number;              // Quality metric (0 to 100)
    
    timestamp: string;            // ISO String
    expiresAt: string;            // ISO String (when this evidence becomes STALE)
    
    isContradictory: boolean;
    isSpoofed: boolean;
    liveness?: number;            // Liveness score (0.0 to 1.0)
    
    modelVersion: string;
    metadata?: Record<string, any>; // Liveness, anti-spoofing flags, reasons, etc.
}

// Temporary alias for backward compatibility during migration
export type IdentityEvidence = NormalizedEvidence;
