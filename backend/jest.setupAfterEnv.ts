import { aiEventCoordinator } from './src/services/ai/aiEventCoordinator.service';
import prisma from './src/prisma';
import { cacheService } from './src/services/cache.service';

// Globally mock the AI Provider to prevent unrelated tests from triggering 15-second real LLM inferences
(aiEventCoordinator as any).provider = {
    analyze: jest.fn().mockResolvedValue({
        assessment: 'NORMAL',
        confidence: 0.9,
        riskFactors: [],
        supportingEvidence: [],
        contradictingEvidence: [],
        recommendedAction: 'OBSERVE',
        explanation: 'Mocked global AI analysis',
        correlatedEvents: [],
        requiresHumanReview: false
    })
};

afterAll(async () => {
    // Ensure real timers are used during teardown, otherwise background tasks
    // stuck on fake timeouts (like MockProvider) will hang forever.
    try {
        if (typeof jest !== 'undefined' && (setTimeout as any)._isMockFunction || (global as any).setTimeout?.hasOwnProperty('_isMockFunction') || jest.isMockFunction(setTimeout)) {
            jest.runAllTimers();
        }
    } catch(e) {}
    jest.useRealTimers();

    // Gracefully wait for any fire-and-forget background tasks to finish
    // with a 3 second fallback so the hook doesn't crash Jest.
    let timeoutId: NodeJS.Timeout;
    await Promise.race([
        aiEventCoordinator.waitForInFlight(),
        new Promise(resolve => {
            timeoutId = setTimeout(resolve, 3000);
        })
    ]);
    clearTimeout(timeoutId!);
    
    // Globally close external connections to prevent open handles during teardown
    // Close cache first as it's synchronous and fast
    if (cacheService) {
        try {
            await cacheService.close();
        } catch (e) {
            console.error('Cache close failed:', e);
        }
    }
    
    try {
        await prisma.$disconnect();
    } catch (e) {
        console.error('Prisma disconnect failed:', e);
    }
});

afterEach(async () => {
    // 1. If fake timers are enabled, flush them so background tasks can complete immediately
    try {
        if (jest.isMockFunction(setTimeout)) {
            jest.runAllTimers();
        }
    } catch(e) {}

    // 2. Await the actual microtasks (Prisma writes, etc)
    await aiEventCoordinator.waitForInFlight();

    // 3. Reset coordinator caches and cooldowns to prevent test leakage
    if (typeof aiEventCoordinator.resetStateForTesting === 'function') {
        aiEventCoordinator.resetStateForTesting();
    }
});
