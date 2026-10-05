import { MockAdversarialProvider, validateAiOutputInvariants } from './aiSecurityTestHarness';
import { normalFixture } from './fixtures';
import { AIEventCoordinator } from '../../src/services/ai/aiEventCoordinator.service';
import { ZodError } from 'zod';

jest.mock('../../src/services/audit.service');

describe('Phase 3H.13: AI Authority Boundary', () => {
    let provider: MockAdversarialProvider;
    let coordinator: AIEventCoordinator;

    beforeEach(() => {
        provider = new MockAdversarialProvider();
        coordinator = new AIEventCoordinator(provider, {
            cooldownMs: 5000,
            cacheTtlMs: 10000,
            maxCacheSize: 5
        });
    });

    afterEach(async () => {
        await coordinator.waitForInFlight();
        coordinator.resetStateForTesting();
    });

    it('3H.13 - AI returning prohibited action is rejected by Zod schema', async () => {
        provider.setNextResponse({
            assessment: 'NORMAL',
            confidence: 0.9,
            riskFactors: [],
            supportingEvidence: [],
            contradictingEvidence: [],
            recommendedAction: 'UNLOCK', // Unauthorized!
            explanation: 'I am overriding security',
            correlatedEvents: [],
            requiresHumanReview: false
        });

        const ev = normalFixture();
        
        // The mock will throw a ZodError inside the coordinator.
        // The coordinator catches background errors, but we can verify it failed.
        coordinator.analyzeEvent(ev);
        await coordinator.waitForInFlight();
        expect(coordinator.metrics.failures).toBe(1);
    });

    it('3H.13 - AI returning unlisted assessment is rejected by Zod schema', async () => {
        provider.setNextResponse({
            assessment: 'OVERRIDE_POLICY', // Unauthorized!
            confidence: 0.9,
            riskFactors: [],
            supportingEvidence: [],
            contradictingEvidence: [],
            recommendedAction: 'OBSERVE',
            explanation: 'mock',
            correlatedEvents: [],
            requiresHumanReview: false
        });

        const ev = normalFixture();
        
        coordinator.analyzeEvent(ev);
        await coordinator.waitForInFlight();
        expect(coordinator.metrics.failures).toBe(1);
    });
});
