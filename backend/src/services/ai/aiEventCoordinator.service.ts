import { AISecurityEvidence, AIProviderResponse, AIProvider } from './aiSecurityBrain.types';
import { PromptBuilder } from './aiSecurityBrain.prompt';
import { logEvent } from '../audit.service';
import { logger } from '../../utils/logger';

export interface AIEventCoordinatorConfig {
    maxCacheSize: number;
    cacheTtlMs: number;
    cooldownMs: number;
}

const DEFAULT_CONFIG: AIEventCoordinatorConfig = {
    maxCacheSize: 1000,
    cacheTtlMs: 15 * 60 * 1000, // 15 minutes
    cooldownMs: 60 * 1000 // 1 minute
};

interface CacheEntry {
    response: AIProviderResponse;
    timestamp: number;
}

export class AIEventCoordinator {
    private provider: AIProvider;
    private config: AIEventCoordinatorConfig;
    
    // In-flight deductions to prevent race conditions on concurrent identical events
    private inFlightRequests: Map<string, Promise<AIProviderResponse | null>> = new Map();
    
    // Cooldown map: tracks when a specific fingerprint was last *dispatched* for analysis
    private lastDispatchTime: Map<string, number> = new Map();
    
    // Result cache: stores successful validated responses
    private resultCache: Map<string, CacheEntry> = new Map();

    // Metrics for benchmarking
    public metrics = {
        totalEvents: 0,
        eligibleEvents: 0,
        suppressedByClassification: 0,
        suppressedByDedup: 0,
        suppressedByCooldown: 0,
        cacheHits: 0,
        cacheMisses: 0,
        invocations: 0,
        successes: 0,
        failures: 0
    };

    constructor(provider: AIProvider, config: Partial<AIEventCoordinatorConfig> = {}) {
        this.provider = provider;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Entry point for security events. Fire-and-forget.
     */
    public analyzeEvent(evidence: AISecurityEvidence): void {
        if (process.env.AI_ENABLED === 'false') {
            return;
        }

        this.metrics.totalEvents++;

        if (!this.isEventEligible(evidence)) {
            this.metrics.suppressedByClassification++;
            return;
        }

        this.metrics.eligibleEvents++;
        const fingerprint = this.generateFingerprint(evidence);

        // Dedup: synchronous reservation
        if (this.inFlightRequests.has(fingerprint)) {
            this.metrics.suppressedByDedup++;
            return;
        }

        // Cache lookup
        const cached = this.getFromCache(fingerprint);
        if (cached) {
            this.metrics.cacheHits++;
            // We would theoretically emit this cached result to telemetry/audit here
            return;
        }
        this.metrics.cacheMisses++;

        // Cooldown check (only apply cooldown if we don't have a cache hit, to prevent spamming failed requests)
        const lastTime = this.lastDispatchTime.get(fingerprint);
        const now = Date.now();
        if (lastTime && (now - lastTime < this.config.cooldownMs)) {
            this.metrics.suppressedByCooldown++;
            return;
        }

        // Reserve in-flight and dispatch
        this.lastDispatchTime.set(fingerprint, now);
        
        const requestPromise = this.executeAnalysis(evidence, fingerprint);
        this.inFlightRequests.set(fingerprint, requestPromise);
        
        requestPromise.finally(() => {
            this.inFlightRequests.delete(fingerprint);
        });
    }

    /**
     * Test utility: wait for all background analysis tasks to complete.
     */
    public async allTasksSettled(): Promise<void> {
        const promises = Array.from(this.inFlightRequests.values());
        if (promises.length > 0) {
            await Promise.allSettled(promises);
        }
    }

    private async executeAnalysis(evidence: AISecurityEvidence, fingerprint: string): Promise<AIProviderResponse | null> {
        this.metrics.invocations++;
        const startTime = Date.now();
        logger.info(`[AIEventCoordinator] Analysis started for session ${evidence.session.sessionId}. Trigger: ${evidence.triggerEvent}`);

        try {
            const response = await this.provider.analyze({
                systemPrompt: PromptBuilder.getSystemPrompt(),
                evidenceJson: PromptBuilder.serializeEvidence(evidence),
                taskPrompt: PromptBuilder.getTaskPrompt()
            });

            this.metrics.successes++;
            this.addToCache(fingerprint, response);
            
            const latency = Date.now() - startTime;
            logger.info(`[AIEventCoordinator] Analysis completed in ${latency}ms`);
            
            try {
                await logEvent({
                    userId: evidence.identity.userId,
                    action: 'AI_SECURITY_ANALYSIS',
                    metadata: {
                        status: 'SUCCESS',
                        trigger: evidence.triggerEvent,
                        sessionId: evidence.session.sessionId,
                        latencyMs: latency,
                        provider: process.env.AI_PROVIDER || 'mock',
                        analysis: response
                    }
                });
            } catch (auditError) {
                logger.error('[AIEventCoordinator] Failed to write audit log for success:', auditError);
            }

            return response;
        } catch (error: any) {
            this.metrics.failures++;
            const latency = Date.now() - startTime;
            const failureReason = error.message || 'AI_ERROR';
            
            logger.warn(`[AIEventCoordinator] Analysis failed: ${failureReason}`);

            try {
                await logEvent({
                    userId: evidence.identity.userId,
                    action: 'AI_SECURITY_ANALYSIS_FAILED',
                    metadata: {
                        status: 'FAILED',
                        reason: failureReason,
                        trigger: evidence.triggerEvent,
                        sessionId: evidence.session.sessionId,
                        latencyMs: latency,
                        provider: process.env.AI_PROVIDER || 'mock'
                    }
                });
            } catch (auditError) {
                logger.error('[AIEventCoordinator] Failed to write audit log for failure:', auditError);
            }

            // Soft fail: do not cache, do not retry, do not block
            return null;
        }
    }

    private isEventEligible(evidence: AISecurityEvidence): boolean {
        // Normal heartbeats are ignored unless there is an anomaly
        if (evidence.triggerEvent === 'HEARTBEAT' && evidence.risk.score < 20 && evidence.trust.state === 'TRUSTED') {
            return false;
        }
        if (evidence.triggerEvent === 'NORMAL_HEARTBEAT') return false;

        // Trust stabilization is ignored
        if (evidence.trust.state === 'TRUSTED' && evidence.trust.previousState === 'TRUSTED' && evidence.risk.score < 20) {
            return false;
        }

        return true;
    }


    public generateFingerprint(evidence: AISecurityEvidence): string {
        // We include sessionId because different sessions might have different context history,
        // unless we want global caching for exact same evidence. 
        // The prompt says: "Verify whether session isolation is required... Do not assume one session may safely consume another session's cached result."
        // We will include sessionId to be safe, but normalize everything else.
        
        const components = [
            `session:${evidence.session.sessionId}`, // Scope cache to session
            `event:${evidence.triggerEvent}`,
            `trust:${evidence.trust.state}`,
            `trans:${evidence.trust.previousState}->${evidence.trust.state}`,
            `risk:${Math.floor(evidence.risk.score / 10)}0`, // Bucket risk score by 10s
            `factors:${(evidence.risk.factors || []).slice().sort().join(',')}`
        ];

        // Biometrics if present
        if (evidence.biometrics?.fusionDecision) {
            components.push(`fusion:${evidence.biometrics.fusionDecision}`);
        }

        return components.join('|');
    }

    private getFromCache(key: string): AIProviderResponse | null {
        const entry = this.resultCache.get(key);
        if (!entry) return null;
        
        if (Date.now() - entry.timestamp > this.config.cacheTtlMs) {
            this.resultCache.delete(key);
            return null;
        }
        
        // LRU bump
        this.resultCache.delete(key);
        this.resultCache.set(key, entry);
        
        return entry.response;
    }

    private addToCache(key: string, response: AIProviderResponse) {
        if (this.resultCache.size >= this.config.maxCacheSize) {
            // Map keys iterate in insertion order, so the first is the oldest (LRU)
            const oldestKey = this.resultCache.keys().next().value;
            if (oldestKey) {
                this.resultCache.delete(oldestKey);
            }
        }
        this.resultCache.set(key, { response, timestamp: Date.now() });
    }

    // For testing
    public async waitForInFlight(): Promise<void> {
        await Promise.all(Array.from(this.inFlightRequests.values()));
    }

    public resetStateForTesting(): void {
        this.inFlightRequests.clear();
        this.lastDispatchTime.clear();
        this.resultCache.clear();
        this.metrics = {
            totalEvents: 0,
            eligibleEvents: 0,
            suppressedByClassification: 0,
            suppressedByDedup: 0,
            suppressedByCooldown: 0,
            cacheHits: 0,
            cacheMisses: 0,
            invocations: 0,
            successes: 0,
            failures: 0
        };
    }
}

import { MockAIProvider } from './mockProvider';
import { OllamaProvider } from './ollamaProvider';

function getProvider() {
    if (process.env.AI_PROVIDER === 'ollama') return new OllamaProvider();
    return new MockAIProvider();
}

export const aiEventCoordinator = new AIEventCoordinator(getProvider());
