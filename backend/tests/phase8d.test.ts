import { FusionEngineService, FusionResult } from '../src/services/fusion.service';
import { NormalizedEvidence } from '../src/types/evidence';
import { ConfigService } from '../src/services/config.service';

describe('Phase 8D: Adversarial Fusion Tests', () => {

    beforeAll(async () => {
        // Ensure config is loaded or mock it if needed
        await ConfigService.getFusionConfig();
    });

    const createEvidence = (overrides: Partial<NormalizedEvidence>): NormalizedEvidence => {
        return {
            source: 'Test',
            category: 'HUMAN',
            modality: 'FACE',
            status: 'PASS',
            confidence: 0.99,
            quality: 99,
            timestamp: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60000).toISOString(),
            isContradictory: false,
            isSpoofed: false,
            modelVersion: '1',
            ...overrides
        };
    };

    it('1. All-human strong evidence -> MATCH', async () => {
        const face = createEvidence({ category: 'HUMAN', modality: 'FACE', confidence: 0.95 });
        const voice = createEvidence({ category: 'HUMAN', modality: 'VOICE', confidence: 0.92 });
        
        const result = await FusionEngineService.evaluate([face, voice]);
        expect(result.decision).toBe('MATCH');
        expect(result.humanConfidence).toBeGreaterThan(0.9);
    });

    it('2. Human + device strong evidence -> MATCH', async () => {
        const face = createEvidence({ category: 'HUMAN', modality: 'FACE', confidence: 0.95 });
        const device = createEvidence({ category: 'DEVICE', modality: 'DEVICE_IDENTITY', confidence: 1.0 });
        
        const result = await FusionEngineService.evaluate([face, device]);
        expect(result.decision).toBe('MATCH');
        expect(result.humanConfidence).toBeGreaterThan(0.9);
        expect(result.deviceAssurance).toBeGreaterThan(0.9);
    });

    it('3. Human mismatch + strong device -> CONFLICT (Primary Security Test)', async () => {
        // Face mismatch + trusted device must produce CONFLICT and must never produce ALLOW
        const face = createEvidence({ category: 'HUMAN', modality: 'FACE', isContradictory: true, confidence: 0.1 });
        const device = createEvidence({ category: 'DEVICE', modality: 'DEVICE_IDENTITY', confidence: 1.0 });
        
        const result = await FusionEngineService.evaluate([face, device]);
        
        expect(result.decision).toBe('CONFLICT');
        expect(result.humanConfidence).toBeLessThan(0.1); // Weight is added but numerator is 0 for contradiction
        expect(result.deviceAssurance).toBe(1.0);
        expect(result.identityConfidence).toBe(0.0); // Hard boundary enforced
        
        // Assert invariants explicitly
        expect(result.humanConfidence).not.toEqual(result.deviceAssurance);
        expect(result.deviceAssurance).toBe(1.0);
    });

    it('4. Multiple human contradictions -> CONFLICT', async () => {
        const face = createEvidence({ category: 'HUMAN', modality: 'FACE', isContradictory: true, confidence: 0.1 });
        const voice = createEvidence({ category: 'HUMAN', modality: 'VOICE', isContradictory: true, confidence: 0.05 });
        
        const result = await FusionEngineService.evaluate([face, voice]);
        expect(result.decision).toBe('CONFLICT');
        expect(result.identityConfidence).toBe(0.0);
    });

    it('5. Spoof + trusted device -> SPOOF_DETECTED', async () => {
        const face = createEvidence({ category: 'HUMAN', modality: 'FACE', isSpoofed: true, status: 'FAIL' });
        const device = createEvidence({ category: 'DEVICE', modality: 'DEVICE_IDENTITY', confidence: 1.0 });
        
        const result = await FusionEngineService.evaluate([face, device]);
        expect(result.decision).toBe('SPOOF_DETECTED');
        expect(result.identityConfidence).toBe(0.0);
    });

    it('6. Missing human + trusted device -> INSUFFICIENT_EVIDENCE', async () => {
        // Only device evidence is presented
        const device = createEvidence({ category: 'DEVICE', modality: 'DEVICE_IDENTITY', confidence: 1.0 });
        
        const result = await FusionEngineService.evaluate([device]);
        expect(result.decision).toBe('INSUFFICIENT_EVIDENCE');
        
        // Ensure device evidence alone doesn't grant high identity confidence
        expect(result.identityConfidence).toBeLessThanOrEqual(0.5); 
    });

    it('7. Stale human + trusted device -> INSUFFICIENT_EVIDENCE', async () => {
        // Human evidence is expired
        const face = createEvidence({ 
            category: 'HUMAN', 
            modality: 'FACE', 
            confidence: 0.95,
            timestamp: new Date(Date.now() - 100000).toISOString(),
            expiresAt: new Date(Date.now() - 50000).toISOString() // Expired in the past
        });
        const device = createEvidence({ category: 'DEVICE', modality: 'DEVICE_IDENTITY', confidence: 1.0 });
        
        const result = await FusionEngineService.evaluate([face, device]);
        expect(result.decision).toBe('INSUFFICIENT_EVIDENCE');
        
        // Face is rejected
        expect(result.evidenceRejected.find(e => e.modality === 'FACE')).toBeDefined();
    });

    it('8. Weak human + strong device -> LOW_CONFIDENCE', async () => {
        const face = createEvidence({ category: 'HUMAN', modality: 'FACE', confidence: 0.3 }); // Weak, but not contradictory
        const device = createEvidence({ category: 'DEVICE', modality: 'DEVICE_IDENTITY', confidence: 1.0 });
        
        const result = await FusionEngineService.evaluate([face, device]);
        expect(result.decision).toBe('LOW_CONFIDENCE');
        expect(result.identityConfidence).toBeLessThan(0.75); // Should remain low
    });

    it('9. Device-only evidence -> INSUFFICIENT_EVIDENCE', async () => {
        const device = createEvidence({ category: 'DEVICE', modality: 'TRUSTED_POSTURE', confidence: 1.0 });
        
        const result = await FusionEngineService.evaluate([device]);
        expect(result.decision).toBe('INSUFFICIENT_EVIDENCE');
        expect(result.humanConfidence).toBe(0);
        expect(result.deviceAssurance).toBe(1.0);
    });

    it('10. No evidence -> INSUFFICIENT_EVIDENCE', async () => {
        const result = await FusionEngineService.evaluate([]);
        expect(result.decision).toBe('INSUFFICIENT_EVIDENCE');
        expect(result.humanConfidence).toBe(0);
        expect(result.deviceAssurance).toBe(0);
    });

    it('11. Contradictory face + Contradictory voice -> CONFLICT', async () => {
        const face = createEvidence({ category: 'HUMAN', modality: 'FACE', isContradictory: true, confidence: 0.1 });
        const voice = createEvidence({ category: 'HUMAN', modality: 'VOICE', isContradictory: true, confidence: 0.05 });
        
        const result = await FusionEngineService.evaluate([face, voice]);
        expect(result.decision).toBe('CONFLICT');
        expect(result.identityConfidence).toBe(0.0);
    });

});
