import { BiometricService } from '../services/biometric.service';
import { NormalizedEvidence } from '../types/evidence';

describe('Phase 8C: Evidence Normalization (NormalizedEvidence)', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should correctly construct Human Face Evidence on successful extraction', async () => {
        const executeSpy = jest.spyOn(BiometricService as any, 'executeWithBackoff').mockResolvedValue({
            quality_metrics: { confidence: 0.98 },
            quality: { score: 95 },
            model: { version: '2.0.0' },
            embedding: [0.1, 0.2]
        });

        const evidence: NormalizedEvidence = await BiometricService.extractFace('dummy.jpg', true);

        expect(evidence.category).toBe('HUMAN');
        expect(evidence.modality).toBe('FACE');
        expect(evidence.status).toBe('PASS');
        expect(evidence.isContradictory).toBe(false);
        expect(evidence.isSpoofed).toBe(false);
        expect(evidence.confidence).toBe(0.98);
        expect(evidence.quality).toBe(95);
        expect(evidence.timestamp).toBeDefined();
        expect(evidence.expiresAt).toBeDefined();
    });

    it('should correctly mark SPOOF_DETECTED failures as isSpoofed = true and FAIL', async () => {
        const executeSpy = jest.spyOn(BiometricService as any, 'executeWithBackoff').mockRejectedValue({
            response: {
                status: 422,
                data: { error: { code: 'SPOOF_DETECTED', message: 'Presentation attack' } }
            }
        });

        const evidence: NormalizedEvidence = await BiometricService.extractFace('spoof.jpg');

        expect(evidence.category).toBe('HUMAN');
        expect(evidence.modality).toBe('FACE');
        expect(evidence.status).toBe('FAIL');
        expect(evidence.isSpoofed).toBe(true);
        expect(evidence.isContradictory).toBe(false); // Spoof implies we didn't verify identity
        expect(evidence.metadata?.liveness).toBe(false);
    });

    it('should correctly mark NO_FACE_DETECTED as INSUFFICIENT_DATA, not a mismatch', async () => {
        const executeSpy = jest.spyOn(BiometricService as any, 'executeWithBackoff').mockRejectedValue({
            response: {
                status: 400,
                data: { error: { code: 'NO_FACE_DETECTED' } }
            }
        });

        const evidence: NormalizedEvidence = await BiometricService.extractFace('noface.jpg');

        expect(evidence.category).toBe('HUMAN');
        expect(evidence.status).toBe('INSUFFICIENT_DATA');
        expect(evidence.isSpoofed).toBe(false);
        expect(evidence.isContradictory).toBe(false);
    });

    it('should correctly mark voice extraction spoof detection as isSpoofed = true', async () => {
        const executeSpy = jest.spyOn(BiometricService as any, 'executeWithBackoff').mockRejectedValue({
            response: {
                status: 422,
                data: { error: { code: 'SPOOF_DETECTED', message: 'Spoof detected' } }
            }
        });

        const evidence: NormalizedEvidence = await BiometricService.extractVoice('voice.wav');

        expect(evidence.category).toBe('HUMAN');
        expect(evidence.modality).toBe('VOICE');
        expect(evidence.status).toBe('FAIL');
        expect(evidence.isContradictory).toBe(false); 
        expect(evidence.isSpoofed).toBe(true);
        expect(evidence.confidence).toBe(0);
    });
});
