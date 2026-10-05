import { MockAdversarialProvider } from './aiSecurityTestHarness';
import { normalFixture } from './fixtures';
import { AISecurityBrainService } from '../../src/services/ai/aiSecurityBrain.service';
import { AIEventCoordinator } from '../../src/services/ai/aiEventCoordinator.service';

jest.mock('../../src/services/audit.service');

describe('Phase 3H.6 & 3H.8: AI Failure Safety', () => {
    let provider: MockAdversarialProvider;
    let coordinator: AIEventCoordinator;

    beforeEach(() => {
        process.env.AI_ENABLED = 'true';
        provider = new MockAdversarialProvider();
        coordinator = new AIEventCoordinator(provider, {
            cooldownMs: 100,
            cacheTtlMs: 100,
            maxCacheSize: 5
        });
    });

    afterEach(async () => {
        await coordinator.waitForInFlight();
        coordinator.resetStateForTesting();
    });

    const verifySafeReturn = (ev: any) => {
        // analyzeEvent should always return immediately and not throw,
        // because it uses fire-and-forget
        expect(() => coordinator.analyzeEvent(ev)).not.toThrow();
    };

    it('3H.8 - AI timeout gracefully caught by coordinator', async () => {
        provider.setNextError(new Error('AI_TIMEOUT'));
        const ev = normalFixture();
        verifySafeReturn(ev);
        
        await coordinator.waitForInFlight();
        expect(coordinator.metrics.failures).toBe(1);
    });

    it('3H.8 - AI network failure caught by coordinator', async () => {
        provider.setNextError(new Error('ECONNREFUSED'));
        const ev = normalFixture();
        verifySafeReturn(ev);
        
        await coordinator.waitForInFlight();
        expect(coordinator.metrics.failures).toBe(1);
    });

    it('3H.8 - AI malformed JSON (simulated schema failure) caught by coordinator', async () => {
        // Return something that definitely fails the schema
        provider.setNextResponse({ completely: 'wrong' });
        const ev = normalFixture();
        verifySafeReturn(ev);
        
        await coordinator.waitForInFlight();
        expect(coordinator.metrics.failures).toBe(1);
    });

    it('3H.9 - Event Storm & Deduplication', async () => {
        const ev = normalFixture();
        let calls = 0;
        
        // Custom provider behavior to count calls
        const originalAnalyze = provider.analyze.bind(provider);
        provider.analyze = async (req: any) => {
            calls++;
            return originalAnalyze(req);
        };

        for (let i = 0; i < 100; i++) {
            coordinator.analyzeEvent(ev);
        }

        // Must suppress duplicates
        expect(coordinator.metrics.suppressedByDedup).toBe(99);
        expect(calls).toBe(1);

        await coordinator.waitForInFlight();
    });
});
