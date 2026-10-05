import { AIEventCoordinator } from '../src/services/ai/aiEventCoordinator.service';
import { AIProvider, AIProviderResponse, AIAnalysisRequest } from '../src/services/ai/aiSecurityBrain.types';

// A mock provider that simulates Ollama latency (e.g. 15s timeout or 10s success)
class MockBenchmarkProvider implements AIProvider {
    public invocationCount = 0;
    public simulateTimeout = false;
    public simulateMalformed = false;
    
    async analyze(request: AIAnalysisRequest): Promise<AIProviderResponse> {
        this.invocationCount++;
        
        // Simulate inference latency
        await new Promise(r => setTimeout(r, 100)); // Keep it fast for benchmark running time

        if (this.simulateTimeout) {
            throw new Error("AI_TIMEOUT");
        }
        
        if (this.simulateMalformed) {
            throw new Error("AI_SCHEMA_VALIDATION_FAILED");
        }
        
        return {
            assessment: 'NORMAL',
            confidence: 0.9,
            riskFactors: [],
            supportingEvidence: [],
            contradictingEvidence: [],
            recommendedAction: 'OBSERVE',
            explanation: 'mock',
            correlatedEvents: [],
            requiresHumanReview: false
        };
    }
}

async function runBenchmark() {
    console.log("Starting Phase 3E Coordinator Benchmark...\n");
    
    const provider = new MockBenchmarkProvider();
    const coordinator = new AIEventCoordinator(provider, {
        cooldownMs: 5000,
        cacheTtlMs: 10000,
        maxCacheSize: 5
    });

    const createEvidence = (trigger: string, risk: number, trust: string, prevTrust: string, sessionId: string = "session-1") => ({
        session: { sessionId },
        identity: { userId: "user1" },
        risk: { score: risk, level: risk > 50 ? 'HIGH' : 'LOW', factors: ["anomaly"] },
        trust: { state: trust, previousState: prevTrust },
        triggerEvent: trigger,
        timestamp: new Date().toISOString()
    });

    // SCENARIO A: 100 normal heartbeats
    console.log("Scenario A: 100 normal heartbeats");
    for (let i=0; i<100; i++) {
        coordinator.analyzeEvent(createEvidence('HEARTBEAT', 10, 'TRUSTED', 'TRUSTED'));
    }
    await coordinator.waitForInFlight();
    console.log(`Invocations: ${provider.invocationCount} (Expected: 0)`);
    provider.invocationCount = 0;

    // SCENARIO B: Repeated identical anomaly (tests dedup and cache)
    console.log("\nScenario B: Repeated identical anomaly");
    for (let i=0; i<10; i++) {
        coordinator.analyzeEvent(createEvidence('BIOMETRIC_ANOMALY', 75, 'CHALLENGE', 'TRUSTED'));
    }
    await coordinator.waitForInFlight();
    // Subsequent calls with same fingerprint should hit cache
    for (let i=0; i<5; i++) {
        coordinator.analyzeEvent(createEvidence('BIOMETRIC_ANOMALY', 75, 'CHALLENGE', 'TRUSTED'));
    }
    await coordinator.waitForInFlight();
    console.log(`Invocations: ${provider.invocationCount} (Expected: 1)`);
    provider.invocationCount = 0;

    // SCENARIO C: Repeated high-risk event (cooldown / cache test)
    console.log("\nScenario C: Repeated high-risk event");
    coordinator.analyzeEvent(createEvidence('HIGH_RISK_SCORE', 90, 'RESTRICTED', 'CHALLENGE'));
    await coordinator.waitForInFlight();
    console.log(`Invocations: ${provider.invocationCount} (Expected: 1)`);
    provider.invocationCount = 0;

    // SCENARIO D: Trust transitions
    console.log("\nScenario D: Trust transitions");
    coordinator.analyzeEvent(createEvidence('HEARTBEAT', 40, 'OBSERVE', 'TRUSTED'));
    coordinator.analyzeEvent(createEvidence('ANOMALY', 60, 'CHALLENGE', 'OBSERVE'));
    coordinator.analyzeEvent(createEvidence('ANOMALY', 80, 'RESTRICTED', 'CHALLENGE'));
    await coordinator.waitForInFlight();
    console.log(`Invocations: ${provider.invocationCount} (Expected: 3)`);
    provider.invocationCount = 0;

    // SCENARIO E: Different sessions
    console.log("\nScenario E: Different sessions identical evidence");
    coordinator.analyzeEvent(createEvidence('BIOMETRIC_ANOMALY', 85, 'CHALLENGE', 'TRUSTED', 'session-100'));
    coordinator.analyzeEvent(createEvidence('BIOMETRIC_ANOMALY', 85, 'CHALLENGE', 'TRUSTED', 'session-101'));
    await coordinator.waitForInFlight();
    console.log(`Invocations: ${provider.invocationCount} (Expected: 2)`);
    provider.invocationCount = 0;

    // SCENARIO F: Concurrent duplicate events
    console.log("\nScenario F: Concurrent duplicate events");
    const ev = createEvidence('CONCURRENT_TEST', 99, 'LOCKED', 'RESTRICTED', 'session-200');
    for (let i=0; i<50; i++) {
        coordinator.analyzeEvent(ev); // fire synchronously
    }
    await coordinator.waitForInFlight();
    console.log(`Invocations: ${provider.invocationCount} (Expected: 1)`);
    provider.invocationCount = 0;

    // SCENARIO G: AI timeout (Failure isolation)
    console.log("\nScenario G: AI timeout");
    provider.simulateTimeout = true;
    coordinator.analyzeEvent(createEvidence('TIMEOUT_TEST', 99, 'LOCKED', 'RESTRICTED', 'session-300'));
    await coordinator.waitForInFlight();
    // Cache should not have populated
    coordinator.analyzeEvent(createEvidence('TIMEOUT_TEST', 99, 'LOCKED', 'RESTRICTED', 'session-300')); // will hit cooldown
    await coordinator.waitForInFlight();
    provider.simulateTimeout = false;
    console.log(`Invocations: ${provider.invocationCount} (Expected: 1, second suppressed by cooldown)`);
    provider.invocationCount = 0;

    // SCENARIO H: Malformed AI output
    console.log("\nScenario H: Malformed output");
    provider.simulateMalformed = true;
    coordinator.analyzeEvent(createEvidence('MALFORMED_TEST', 99, 'LOCKED', 'RESTRICTED', 'session-400'));
    await coordinator.waitForInFlight();
    provider.simulateMalformed = false;
    console.log(`Invocations: ${provider.invocationCount} (Expected: 1)`);
    provider.invocationCount = 0;

    // Metrics
    console.log("\n=== FINAL METRICS ===");
    console.log(JSON.stringify(coordinator.metrics, null, 2));
}

runBenchmark().catch(console.error);
