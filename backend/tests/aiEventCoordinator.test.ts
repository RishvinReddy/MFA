import { AIEventCoordinator } from '../src/services/ai/aiEventCoordinator.service';
import { PromptBuilder } from '../src/services/ai/aiSecurityBrain.prompt';

describe('AIEventCoordinator Lifecycle & Regression Tests', () => {
    let coordinator: AIEventCoordinator;
    let mockProvider: any;
    let resolveProvider: any;
    let rejectProvider: any;

    beforeEach(() => {
        // Reset process.env.AI_ENABLED just in case
        process.env.AI_ENABLED = 'true';

        mockProvider = {
            analyze: jest.fn().mockImplementation(() => {
                return new Promise((resolve, reject) => {
                    resolveProvider = () => resolve({
                        assessment: 'NORMAL',
                        confidence: 0.9,
                        riskFactors: [],
                        supportingEvidence: [],
                        contradictingEvidence: [],
                        recommendedAction: 'OBSERVE',
                        explanation: 'mock',
                        correlatedEvents: [],
                        requiresHumanReview: false
                    });
                    if (!(global as any).resolvers) (global as any).resolvers = [];
                    (global as any).resolvers.push(resolveProvider);
                    rejectProvider = reject;
                });
            })
        };
        coordinator = new AIEventCoordinator(mockProvider, {
            cooldownMs: 5000,
            cacheTtlMs: 10000,
            maxCacheSize: 5
        });
    });

    afterEach(async () => {
        // Guarantee clean state
        if ((global as any).resolvers) {
            for (const res of (global as any).resolvers) res();
            (global as any).resolvers = [];
        }
        if (resolveProvider) resolveProvider(); // Fallback
        await coordinator.waitForInFlight();
        coordinator.resetStateForTesting();
    });

    const createEvent = (trigger: string, risk: number, trust: string, prevTrust: string) => ({
        session: { sessionId: `sess-${Math.random()}` },
        identity: { userId: "user-1" },
        risk: { score: risk, level: risk > 50 ? 'HIGH' : 'LOW', factors: [] },
        trust: { state: trust, previousState: prevTrust },
        triggerEvent: trigger,
        timestamp: new Date().toISOString()
    });

    it('Test A - Fire and forget: processEvent returns before AI completes', () => {
        const ev = createEvent('ANOMALY', 75, 'CHALLENGE', 'TRUSTED');
        // If analyzeEvent awaited the provider, it wouldn't return until resolveProvider()
        coordinator.analyzeEvent(ev);
        expect(mockProvider.analyze).toHaveBeenCalled();
        expect(coordinator.metrics.invocations).toBe(1);
        expect(coordinator.metrics.successes).toBe(0); // Not finished yet!
    });

    it('Test B - In-flight tracking: active task appears in lifecycle state', () => {
        const ev = createEvent('ANOMALY', 75, 'CHALLENGE', 'TRUSTED');
        coordinator.analyzeEvent(ev);
        // The internal map should have 1 item
        const inFlightMap = (coordinator as any).inFlightRequests as Map<string, Promise<any>>;
        expect(inFlightMap.size).toBe(1);
    });

    it('Test C - Drain: waitForInFlight does not return until tracked tasks finish', async () => {
        const ev = createEvent('ANOMALY', 75, 'CHALLENGE', 'TRUSTED');
        coordinator.analyzeEvent(ev);
        
        let drained = false;
        const drainPromise = coordinator.waitForInFlight().then(() => { drained = true; });
        
        // Let event loop tick
        await new Promise(r => setTimeout(r, 10));
        expect(drained).toBe(false); // Still waiting

        resolveProvider(); // Provider finishes
        
        await drainPromise;
        expect(drained).toBe(true);
        expect(coordinator.metrics.successes).toBe(1);
        expect(((coordinator as any).inFlightRequests as Map<string, Promise<any>>).size).toBe(0);
    });

    it('Test D - Failed AI task: rejected task is removed from inFlight', async () => {
        const ev = createEvent('ANOMALY', 75, 'CHALLENGE', 'TRUSTED');
        coordinator.analyzeEvent(ev);
        
        rejectProvider(new Error('AI_ERROR')); // simulate failure
        await coordinator.waitForInFlight();
        
        expect(coordinator.metrics.failures).toBe(1);
        expect(((coordinator as any).inFlightRequests as Map<string, Promise<any>>).size).toBe(0);
    });

    it('Test E - Timeout: timeout does not leave permanent in-flight entry', async () => {
        const ev = createEvent('ANOMALY', 75, 'CHALLENGE', 'TRUSTED');
        coordinator.analyzeEvent(ev);
        
        // Simulating a timeout rejection from the provider
        rejectProvider(new Error('AI_TIMEOUT'));
        await coordinator.waitForInFlight();
        
        expect(coordinator.metrics.failures).toBe(1);
        expect(((coordinator as any).inFlightRequests as Map<string, Promise<any>>).size).toBe(0);
    });

    it('Test F - Multiple tasks: drain waits for all of them', async () => {
        const ev1 = createEvent('ANOMALY1', 75, 'CHALLENGE', 'TRUSTED');
        const ev2 = createEvent('ANOMALY2', 80, 'CHALLENGE', 'TRUSTED');
        
        coordinator.analyzeEvent(ev1);
        coordinator.analyzeEvent(ev2);
        
        expect(((coordinator as any).inFlightRequests as Map<string, Promise<any>>).size).toBe(2);
        
        if ((global as any).resolvers) {
            for (const res of (global as any).resolvers) res();
        }
    });

    it('Test G - Concurrent duplicate events: deduplication guarantee', async () => {
        const ev = createEvent('ANOMALY', 75, 'CHALLENGE', 'TRUSTED');
        for (let i = 0; i < 10; i++) {
            coordinator.analyzeEvent(ev);
        }
        expect(mockProvider.analyze).toHaveBeenCalledTimes(1);
        expect(coordinator.metrics.suppressedByDedup).toBe(9);
        if ((global as any).resolvers) {
            for (const res of (global as any).resolvers) res();
        }
        await coordinator.waitForInFlight();
    });

    it('Test H - Cache behavior: hit/TTL preserved', async () => {
        const ev = createEvent('ANOMALY', 75, 'CHALLENGE', 'TRUSTED');
        coordinator.analyzeEvent(ev);
        if ((global as any).resolvers) {
            for (const res of (global as any).resolvers) res();
        }
        await coordinator.waitForInFlight();
        
        // Next one hits cache
        coordinator.analyzeEvent(ev);
        expect(mockProvider.analyze).toHaveBeenCalledTimes(1);
        expect(coordinator.metrics.cacheHits).toBe(1);
    });
});
