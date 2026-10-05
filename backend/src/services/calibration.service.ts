import { NormalizedEvidence } from '../types/evidence';

/**
 * Normalizes raw model scores into comparable confidence probabilities.
 */
export class EvidenceCalibrator {
    
    /**
     * Calibrates raw identity evidence.
     * In a production environment, this would use statistical distributions 
     * specific to each ML model's FAR/FRR curves.
     * For this prototype, we use simple linear/polynomial adjustments if needed.
     */
    static calibrate(evidence: NormalizedEvidence): number {
        if (evidence.status !== 'PASS' && evidence.status !== 'FAIL') {
            return 0; // Excluded or invalid evidence shouldn't provide confidence
        }

        switch (evidence.modality) {
            case 'FACE':
                // E.g., InsightFace buffalo_l cosine similarity might need stretching
                // A match score of 0.85 might actually represent 99% confidence
                return this.calibrateFace(evidence.confidence);
            case 'VOICE':
                // E.g., MFCC cosine similarity
                return this.calibrateVoice(evidence.confidence);
            case 'BEHAVIOR_KEYBOARD':
            case 'BEHAVIOR_MOUSE':
            case 'DEVICE':
            case 'PASSWORD':
            default:
                return evidence.confidence;
        }
    }

    private static calibrateFace(rawConfidence: number): number {
        // InsightFace buffalo_l empirical threshold is 0.50
        // We stretch 0.50 to 0.75 (Medium assurance) and 1.0 to 1.0
        if (rawConfidence < 0.50) {
            return rawConfidence * 1.5; // Scale [0, 0.50) -> [0, 0.75)
        }
        return Math.min(1.0, 0.75 + ((rawConfidence - 0.50) / 0.50) * 0.25);
    }

    private static calibrateVoice(rawConfidence: number): number {
        // SpeechBrain ECAPA-TDNN empirical threshold is 0.40
        // We stretch 0.40 to 0.75 (Medium assurance) and 0.80 to 1.0
        if (rawConfidence < 0.40) {
            return rawConfidence * 1.875; // Scale [0, 0.40) -> [0, 0.75)
        }
        return Math.min(1.0, 0.75 + ((rawConfidence - 0.40) / 0.40) * 0.25);
    }
}
