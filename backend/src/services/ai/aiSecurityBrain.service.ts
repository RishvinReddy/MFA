import { AISecurityEvidence, AIProvider, AIAnalysisRequest } from './aiSecurityBrain.types';
import { MockAIProvider } from './mockProvider';
import { OllamaProvider } from './ollamaProvider';
import { PromptBuilder } from './aiSecurityBrain.prompt';
import { logEvent } from '../audit.service';
import { logger } from '../../utils/logger';
import { TrustState } from '../trust.service';

export class AISecurityBrainService {
    private static provider: AIProvider | null = null;
    
    // Simple deduplication cache to prevent storms: sessionId -> lastTriggerTime
    private static lastAnalysisMap = new Map<string, number>();
    private static readonly DEDUPLICATION_WINDOW_MS = 10000; // 10 seconds
    private static lastCleanupTime = Date.now();

    private static cleanupStaleEntries() {
        const now = Date.now();
        if (now - this.lastCleanupTime > 60000) { // Every 1 minute
            for (const [key, timestamp] of this.lastAnalysisMap.entries()) {
                if (now - timestamp > this.DEDUPLICATION_WINDOW_MS) {
                    this.lastAnalysisMap.delete(key);
                }
            }
            this.lastCleanupTime = now;
        }
    }

    private static getProvider(): AIProvider {
        if (!this.provider) {
            const providerType = process.env.AI_PROVIDER || 'mock';
            if (providerType === 'ollama') {
                this.provider = new OllamaProvider();
            } else {
                this.provider = new MockAIProvider();
            }
        }
        return this.provider;
    }

    /**
     * Trigger evaluation mechanism to determine if AI should run.
     * Evaluates rules against current state.
     */
    static shouldTrigger(
        sessionId: string,
        previousState: TrustState,
        newState: TrustState,
        riskScore: number,
        fusionDecision?: string
    ): string | null {
        this.cleanupStaleEntries();

        // Prevent storms
        const now = Date.now();
        const lastTrigger = this.lastAnalysisMap.get(sessionId);
        if (lastTrigger && (now - lastTrigger < this.DEDUPLICATION_WINDOW_MS)) {
            return null; // Suppressed by deduplication
        }

        let triggerReason: string | null = null;
        if (previousState !== newState) {
            triggerReason = `TRUST_STATE_TRANSITION: ${previousState} -> ${newState}`;
        } else if (riskScore >= 50) {
            triggerReason = `HIGH_RISK_SCORE: ${riskScore}`;
        } else if (fusionDecision === 'SPOOF_DETECTED' || fusionDecision === 'CONFLICT') {
            triggerReason = `BIOMETRIC_ANOMALY: ${fusionDecision}`;
        }

        if (triggerReason) {
            // Reserve synchronously to prevent race conditions
            this.lastAnalysisMap.set(sessionId, now);
        }

        return triggerReason;
    }

    /**
     * Executes AI analysis asynchronously.
     * Guaranteed to NOT block the caller.
     */
    static async triggerAsyncAnalysis(evidence: AISecurityEvidence): Promise<void> {
        // Run in background (fire and forget)
        this.runAnalysis(evidence).catch(error => {
            logger.error('[AISecurityBrain] Unhandled background error:', error);
        });
    }

    private static async runAnalysis(evidence: AISecurityEvidence): Promise<void> {
        const isEnabled = process.env.AI_ENABLED !== 'false';
        if (!isEnabled) return;

        const request: AIAnalysisRequest = {
            systemPrompt: PromptBuilder.getSystemPrompt(),
            evidenceJson: PromptBuilder.serializeEvidence(evidence),
            taskPrompt: PromptBuilder.getTaskPrompt()
        };

        const startTime = Date.now();
        logger.info(`[AISecurityBrain] Analysis started for session ${evidence.session.sessionId}. Trigger: ${evidence.triggerEvent}`);

        try {
            const provider = this.getProvider();
            const result = await provider.analyze(request);
            
            const latency = Date.now() - startTime;
            logger.info(`[AISecurityBrain] Analysis completed in ${latency}ms`);

            // Audit Integration
            await logEvent({
                userId: evidence.identity.userId,
                action: 'AI_SECURITY_ANALYSIS',
                metadata: {
                    status: 'SUCCESS',
                    trigger: evidence.triggerEvent,
                    sessionId: evidence.session.sessionId,
                    latencyMs: latency,
                    provider: process.env.AI_PROVIDER || 'mock',
                    analysis: result
                }
            });

        } catch (error: any) {
            const latency = Date.now() - startTime;
            const failureReason = error.message || 'AI_ERROR';
            
            logger.warn(`[AISecurityBrain] Analysis failed: ${failureReason}`);

            // Audit Integration for Failure
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
        }
    }
}
