import { FusionEngineService } from '../src/services/fusion.service';
import { PolicyEngineService } from '../src/services/policy.service';
import { ConfigService } from '../src/services/config.service';
import { NormalizedEvidence } from '../src/types/evidence';
import { PolicyContext } from '../src/services/policy.service';

describe('Phase 8F: Adversarial Fusion Testing', () => {

    beforeAll(() => {
        // Mock ConfigService to return a standard config without needing the DB
        jest.spyOn(ConfigService, 'getFusionConfig').mockResolvedValue({
            version: 1,
            weights: {
                face: 0.6,
                voice: 0.4,
                keyboardBehavior: 0.0,
                mouseBehavior: 0.0
            },
            minimumQuality: {
                face: 60,
                voice: 60
            },
            evidenceTTL: {
                face: 300,
                voice: 300,
                behavior: 300
            },
            confidenceThresholds: {
                low: 0.4,
                medium: 0.7,
                high: 0.9
            },
            configurationVersion: 1,
            updatedAt: new Date()
        } as any);
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    const createEvidence = (
        modality: 'FACE' | 'VOICE' | 'DEVICE',
        category: 'HUMAN' | 'DEVICE',
        options: {
            confidence?: number;
            quality?: number;
            isContradictory?: boolean;
            isSpoofed?: boolean;
            ageMs?: number;
            status?: 'PASS' | 'FAIL' | 'ERROR' | 'UNAVAILABLE';
        } = {}
    ): NormalizedEvidence => {
        const now = Date.now();
        const ageMs = options.ageMs || 0;
        const timestamp = new Date(now - ageMs).toISOString();
        const expiresAt = new Date(now - ageMs + 300000).toISOString();

        return {
            source: 'MockService',
            category,
            modality: modality as any,
            isContradictory: options.isContradictory || false,
            isSpoofed: options.isSpoofed || false,
            status: options.status || 'PASS',
            confidence: options.confidence ?? 0.9,
            quality: options.quality ?? 90,
            timestamp,
            expiresAt,
            modelVersion: '1.0',
            metadata: {
                liveness: !options.isSpoofed,
                antiSpoof: !options.isSpoofed
            }
        };
    };

    const evaluatePolicy = (fusionResult: any): any => {
        const context: PolicyContext = {
            trustState: 'TRUSTED',
            riskLevel: 'LOW',
            completedFactors: fusionResult.evidenceUsed,
            failedFactors: [],
            availableFactors: ['FACE', 'VOICE'],
            authenticationStage: 'CONTINUOUS',
            sessionState: 'ACTIVE',
            fusionDecision: fusionResult.decision
        };
        return PolicyEngineService.evaluate(context);
    };

    it('1. Face + Voice + Device all strong -> MATCH -> ACTIVE/ALLOW', async () => {
        const evidences = [
            createEvidence('FACE', 'HUMAN', { confidence: 0.95 }),
            createEvidence('VOICE', 'HUMAN', { confidence: 0.90 }),
            createEvidence('DEVICE', 'DEVICE', { confidence: 0.99 })
        ];

        const result = await FusionEngineService.evaluate(evidences);
        expect(result.decision).toBe('MATCH');
        
        const policy = evaluatePolicy(result);
        expect(policy.action).toBe('ALLOW'); // or normal
    });

    it('2. Face strong + Voice weak -> LOW_CONFIDENCE -> CHALLENGE', async () => {
        const evidences = [
            createEvidence('FACE', 'HUMAN', { confidence: 0.95 }),
            createEvidence('VOICE', 'HUMAN', { confidence: 0.10, status: 'PASS' })
        ];

        const result = await FusionEngineService.evaluate(evidences);
        expect(result.decision).toBe('LOW_CONFIDENCE');
        
        const policy = evaluatePolicy(result);
        expect(['CHALLENGE', 'OBSERVE', 'REQUIRE_MFA']).toContain(policy.action);
    });

    it('3. Face mismatch + trusted device -> CONFLICT -> CHALLENGE', async () => {
        const evidences = [
            createEvidence('FACE', 'HUMAN', { confidence: 0.05, status: 'FAIL', isContradictory: true }),
            createEvidence('DEVICE', 'DEVICE', { confidence: 0.99 })
        ];

        const result = await FusionEngineService.evaluate(evidences);
        expect(result.decision).toBe('CONFLICT');
        
        const policy = evaluatePolicy(result);
        expect(policy.action).toBe('REQUIRE_MFA');
        expect(policy.nextSessionState).toBe('CHALLENGE_REQUIRED');
    });

    it('4. Voice mismatch + trusted device -> CONFLICT -> CHALLENGE', async () => {
        const evidences = [
            createEvidence('VOICE', 'HUMAN', { confidence: 0.02, status: 'FAIL', isContradictory: true }),
            createEvidence('DEVICE', 'DEVICE', { confidence: 0.99 })
        ];

        const result = await FusionEngineService.evaluate(evidences);
        expect(result.decision).toBe('CONFLICT');
        
        const policy = evaluatePolicy(result);
        expect(policy.action).toBe('REQUIRE_MFA');
        expect(policy.nextSessionState).toBe('CHALLENGE_REQUIRED');
    });

    it('5. Face spoof + trusted device -> SPOOF_DETECTED -> RESTRICT', async () => {
        const evidences = [
            createEvidence('FACE', 'HUMAN', { isSpoofed: true, status: 'FAIL' }),
            createEvidence('DEVICE', 'DEVICE', { confidence: 0.99 })
        ];

        const result = await FusionEngineService.evaluate(evidences);
        expect(result.decision).toBe('SPOOF_DETECTED');
        
        const policy = evaluatePolicy(result);
        expect(policy.action).toBe('RESTRICT');
        expect(policy.nextSessionState).toBe('RESTRICTED');
    });

    it('6. Face + Voice spoof -> SPOOF_DETECTED -> RESTRICT', async () => {
        const evidences = [
            createEvidence('FACE', 'HUMAN', { isSpoofed: true, status: 'FAIL' }),
            createEvidence('VOICE', 'HUMAN', { isSpoofed: true, status: 'FAIL' })
        ];

        const result = await FusionEngineService.evaluate(evidences);
        expect(result.decision).toBe('SPOOF_DETECTED');
        
        const policy = evaluatePolicy(result);
        expect(policy.action).toBe('RESTRICT');
    });

    it('7. Human evidence unavailable + trusted device -> INSUFFICIENT_EVIDENCE -> CHALLENGE', async () => {
        const evidences = [
            createEvidence('FACE', 'HUMAN', { status: 'UNAVAILABLE' }),
            createEvidence('DEVICE', 'DEVICE', { confidence: 0.99 })
        ];

        const result = await FusionEngineService.evaluate(evidences);
        expect(result.decision).toBe('INSUFFICIENT_EVIDENCE');
        
        const policy = evaluatePolicy(result);
        expect(policy.action).toBe('REQUIRE_MFA');
    });

    it('8. Device-only evidence -> INSUFFICIENT_EVIDENCE -> CHALLENGE', async () => {
        const evidences = [
            createEvidence('DEVICE', 'DEVICE', { confidence: 0.99 })
        ];

        const result = await FusionEngineService.evaluate(evidences);
        expect(result.decision).toBe('INSUFFICIENT_EVIDENCE');
        
        const policy = evaluatePolicy(result);
        expect(policy.action).toBe('REQUIRE_MFA');
    });

    it('9. Stale human + strong device -> INSUFFICIENT_EVIDENCE -> CHALLENGE', async () => {
        const evidences = [
            // Age > 300000 ms means it is stale (expired)
            createEvidence('FACE', 'HUMAN', { confidence: 0.95, ageMs: 400000 }),
            createEvidence('DEVICE', 'DEVICE', { confidence: 0.99 })
        ];

        const result = await FusionEngineService.evaluate(evidences);
        expect(result.decision).toBe('INSUFFICIENT_EVIDENCE');
        
        const policy = evaluatePolicy(result);
        expect(policy.action).toBe('REQUIRE_MFA');
    });

    it('10. Multiple human contradictions -> CONFLICT -> CHALLENGE', async () => {
        const evidences = [
            createEvidence('FACE', 'HUMAN', { confidence: 0.1, status: 'FAIL', isContradictory: true }),
            createEvidence('VOICE', 'HUMAN', { confidence: 0.1, status: 'FAIL', isContradictory: true })
        ];

        const result = await FusionEngineService.evaluate(evidences);
        expect(result.decision).toBe('CONFLICT');
        
        const policy = evaluatePolicy(result);
        expect(policy.action).toBe('REQUIRE_MFA');
    });

    it('11. No evidence -> INSUFFICIENT_EVIDENCE -> CHALLENGE', async () => {
        const result = await FusionEngineService.evaluate([]);
        expect(result.decision).toBe('INSUFFICIENT_EVIDENCE');
        
        const policy = evaluatePolicy(result);
        expect(policy.action).toBe('REQUIRE_MFA');
    });

});
