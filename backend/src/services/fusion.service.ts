import { NormalizedEvidence, EvidenceStatus, IdentityModality, FusionDecision } from '../types/evidence';
import { ConfigService } from './config.service';
import { EvidenceCalibrator } from './calibration.service';
import { logger } from '../utils/logger';

export interface FusionResult {
    decision: FusionDecision;
    identityConfidence: number; // 0.0 to 1.0 (Overall identity score, possibly human + device weighted)
    humanConfidence: number; // Aggregated score of human evidence
    deviceAssurance: number; // Aggregated score of device evidence
    assuranceLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    evidenceUsed: IdentityModality[];
    evidenceRejected: { modality: IdentityModality; reason: string }[];
    warnings: string[];
    configurationVersion: number;
    calculatedAt: string;
}

export class FusionEngineService {
    /**
     * Evaluates all provided evidence and computes separate Human/Device assurance scores.
     * Enforces strict boundaries for Contradiction and Spoofing.
     */
    static async evaluate(evidences: NormalizedEvidence[]): Promise<FusionResult> {
        const config = await ConfigService.getFusionConfig();
        const now = Date.now();

        const evidenceUsed: IdentityModality[] = [];
        const evidenceRejected: { modality: IdentityModality; reason: string }[] = [];
        const warnings: string[] = [];

        let humanNumerator = 0;
        let humanDenominator = 0;
        let deviceNumerator = 0;
        let deviceDenominator = 0;

        let spoofDetected = false;
        let contradictionDetected = false;
        let insufficientLiveness = false;
        let hasHumanEvidence = false;
        let hasActiveHumanEvidence = false; // Fresh and usable

        for (const evidence of evidences) {
            const modality = evidence.modality;
            const isHuman = evidence.category === 'HUMAN';
            const weight = this.getWeightForModality(modality, config);

            if (isHuman) hasHumanEvidence = true;

            if (evidence.isSpoofed) {
                spoofDetected = true;
                evidenceRejected.push({ modality, reason: 'Spoofing (Presentation Attack) detected' });
                warnings.push(`SPOOFING_DETECTED: ${modality}`);
                continue; // We still process other evidence but the flag is set
            }

            if (evidence.isContradictory || evidence.status === 'FAIL') {
                contradictionDetected = true;
                evidenceRejected.push({ modality, reason: 'Contradictory evidence (Mismatch or FAIL)' });
                warnings.push(`CONTRADICTION: ${modality} explicitly mismatched`);
                
                // Add the explicit negative signal to human confidence
                if (isHuman) {
                    hasActiveHumanEvidence = true;
                    // A contradiction is basically a 0 confidence score with high weight
                    humanDenominator += weight;
                    // numerator += 0
                }
                continue;
            }

            if (weight === 0) {
                evidenceRejected.push({ modality, reason: 'Weight is zero in current configuration' });
                continue;
            }

            // 1. Hard Rules (Factor-level rejection)
            if (evidence.status === 'ERROR' || evidence.status === 'UNAVAILABLE' || evidence.status === 'INSUFFICIENT_DATA') {
                evidenceRejected.push({ modality, reason: `Status is ${evidence.status}` });
                warnings.push(`${modality} check encountered operational issue: ${evidence.metadata?.reason || evidence.status}`);
                continue;
            }

            // 2. Minimum Quality Checks
            const minQuality = this.getMinQualityForModality(modality, config);
            if (evidence.quality < minQuality) {
                evidenceRejected.push({ modality, reason: `Quality (${evidence.quality}) below threshold (${minQuality})` });
                warnings.push(`${modality} sample was too poor quality to use`);
                continue;
            }

            // 3. Liveness Checks (Scores and Flags)
            const liveness = evidence.liveness !== undefined ? evidence.liveness : evidence.metadata?.livenessScore;
            
            if (evidence.isSpoofed || evidence.metadata?.antiSpoof === false || (liveness !== undefined && liveness < 0.30)) {
                spoofDetected = true;
                evidenceRejected.push({ modality, reason: 'Liveness very low or Spoofing explicitly detected' });
                warnings.push(`SPOOFING_DETECTED: ${modality} failed liveness check (score: ${liveness})!`);
                continue;
            }
            
            if (liveness !== undefined && liveness < 0.70) {
                insufficientLiveness = true;
                evidenceRejected.push({ modality, reason: `Liveness score (${liveness}) below acceptable threshold (0.70)` });
                warnings.push(`INSUFFICIENT_LIVENESS: ${modality} liveness score too low to trust.`);
                // We don't mark as spoofed, but we cannot use this as human evidence
                continue;
            }

            // 4. Freshness Decay
            const expiresAtMs = new Date(evidence.expiresAt).getTime();
            const timestampMs = new Date(evidence.timestamp).getTime();

            if (timestampMs > now) {
                evidenceRejected.push({ modality, reason: 'Evidence timestamp is in the future (INVALID)' });
                warnings.push(`INVALID_TIMESTAMP: ${modality} timestamp ${evidence.timestamp} is in the future.`);
                continue;
            }

            if (now > expiresAtMs) {
                evidenceRejected.push({ modality, reason: 'Evidence expired (STALE)' });
                continue;
            }

            const lifespan = expiresAtMs - timestampMs;
            const age = now - timestampMs;
            let freshness = 1.0 - (age / lifespan);
            if (freshness < 0) freshness = 0;
            if (freshness > 1) freshness = 1.0;

            // 5. Calibration
            const calibratedConfidence = EvidenceCalibrator.calibrate(evidence);
            const normalizedQuality = evidence.quality / 100.0;
            const contribution = weight * normalizedQuality * freshness;

            if (isHuman) {
                hasActiveHumanEvidence = true;
                humanNumerator += contribution * calibratedConfidence;
                humanDenominator += contribution;
            } else {
                deviceNumerator += contribution * calibratedConfidence;
                deviceDenominator += contribution;
            }

            evidenceUsed.push(modality);
        }

        let humanConfidence = 0;
        if (humanDenominator > 0) humanConfidence = humanNumerator / humanDenominator;

        let deviceAssurance = 0;
        if (deviceDenominator > 0) deviceAssurance = deviceNumerator / deviceDenominator;

        // Calculate legacy identityConfidence (mostly relies on Human for actual identity)
        let identityConfidence = humanConfidence;
        if (!hasActiveHumanEvidence && deviceDenominator > 0) {
            // If we have ONLY device evidence, identityConfidence might carry some device weight 
            // for the sake of the legacy system, but we'll limit it to 0.5 (medium) maximum to prevent it from acting as strong human proof.
            identityConfidence = Math.min(deviceAssurance * 0.5, 0.5);
        }

        // Determine Decision
        let decision: FusionDecision = 'INSUFFICIENT_EVIDENCE';
        
        if (spoofDetected) {
            decision = 'SPOOF_DETECTED';
            identityConfidence = 0.0;
        } else if (contradictionDetected) {
            decision = 'CONFLICT';
            identityConfidence = 0.0;
        } else if (insufficientLiveness) {
            decision = 'LOW_CONFIDENCE';
            identityConfidence = 0.0;
        } else if (!hasActiveHumanEvidence) {
            decision = 'INSUFFICIENT_EVIDENCE';
            identityConfidence = 0.0;
        } else if (humanDenominator < 0.20) {
            // Gap 1 Remediation: Require a minimum effective evidence mass (eligibility + contribution)
            // A stale frame decays in weight. If it decays so much that the total denominator 
            // drops below 0.20 (less than a borderline fresh face frame), we reject it.
            decision = 'INSUFFICIENT_EVIDENCE';
            identityConfidence = 0.0;
        } else if (humanConfidence < config.confidenceThresholds.medium) {
            decision = 'LOW_CONFIDENCE';
        } else {
            decision = 'MATCH';
        }

        // Determine Assurance Level based on configured thresholds
        let assuranceLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
        if (identityConfidence >= config.confidenceThresholds.high) {
            assuranceLevel = 'HIGH';
        } else if (identityConfidence >= config.confidenceThresholds.medium) {
            assuranceLevel = 'MEDIUM';
        }

        // TELEMETRY LOGGING (Derived values only)
        const faceEvidence = evidences.find(e => e.modality === 'FACE');
        const voiceEvidence = evidences.find(e => e.modality === 'VOICE');
        
        logger.info('--- FUSION TELEMETRY ---', {
            faceSimilarity: faceEvidence ? faceEvidence.confidence : null,
            faceThreshold: config.confidenceThresholds.medium,
            voiceConfidence: voiceEvidence ? voiceEvidence.confidence : null,
            fusionDecision: decision,
            humanConfidence,
            deviceAssurance
        });

        return {
            decision,
            identityConfidence,
            humanConfidence,
            deviceAssurance,
            assuranceLevel,
            evidenceUsed,
            evidenceRejected,
            warnings,
            configurationVersion: config.configurationVersion,
            calculatedAt: new Date().toISOString()
        };
    }

    private static getWeightForModality(modality: IdentityModality, config: any): number {
        switch (modality) {
            case 'FACE': return config.weights?.face || 0.6;
            case 'VOICE': return config.weights?.voice || 0.4;
            case 'BEHAVIOR_KEYBOARD': return config.weights?.keyboardBehavior || 0.0;
            case 'BEHAVIOR_MOUSE': return config.weights?.mouseBehavior || 0.0;
            case 'DEVICE': return 1.0; // Device assurance is calculated independently, weight 1.0 relative to its own category
            case 'DEVICE_IDENTITY': return 1.0;
            case 'TRUSTED_POSTURE': return 0.5;
            case 'WEBAUTHN': return 1.0;
            case 'PASSWORD': return 1.0;
            default: return 0;
        }
    }

    private static getMinQualityForModality(modality: IdentityModality, config: any): number {
        switch (modality) {
            case 'FACE': return config.minimumQuality?.face || 60;
            case 'VOICE': return config.minimumQuality?.voice || 60;
            default: return 0;
        }
    }
}
