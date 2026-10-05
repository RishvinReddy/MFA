import { EvidenceCalibrator } from '../../src/services/calibration.service';
import { NormalizedEvidence } from '../../src/types/evidence';

describe('Calibration Service - Voice', () => {
    it('should calibrate voice confidence correctly based on empirical ECAPA-TDNN distribution', () => {
        const createVoiceEvidence = (confidence: number): NormalizedEvidence => ({
            source: 'test',
            category: 'HUMAN',
            modality: 'VOICE',
            status: 'PASS',
            confidence,
            quality: 100,
            timestamp: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 10000).toISOString(),
            isContradictory: false,
            isSpoofed: false,
            modelVersion: '1.0'
        });

        const testValues = [
            { raw: 0.39, expected: 0.73125 },
            { raw: 0.40, expected: 0.75 },
            { raw: 0.41, expected: 0.75625 },
            { raw: 0.60, expected: 0.875 },
            { raw: 0.80, expected: 1.0 }
        ];

        for (const test of testValues) {
            const evidence = createVoiceEvidence(test.raw);
            const calibrated = EvidenceCalibrator.calibrate(evidence);
            expect(calibrated).toBeCloseTo(test.expected, 4);
        }
    });
});
