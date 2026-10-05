import { FusionResult } from './fusion.service';
import { RiskResult } from './risk.service';
import { logger } from '../utils/logger';
import prisma from '../prisma';

export type TrustState = 'TRUSTED' | 'OBSERVE' | 'CHALLENGE' | 'RESTRICTED' | 'LOCKED';

export interface TrustEvaluationContext {
    fusion: FusionResult;
    risk: RiskResult;
    previousState: TrustState;
    userId: string;
    sessionId: string;
}

export interface TrustEngineResult {
    state: TrustState;
    reason: string;
}

export class TrustEngineService {

    /**
     * Evaluates trust based on identity confidence and risk, using hysteresis to prevent state-bouncing.
     */
    static async evaluate(context: TrustEvaluationContext): Promise<TrustEngineResult> {
        const { fusion, risk, previousState } = context;
        const confidence = fusion.identityConfidence;
        const riskScore = risk.score;

        let newState = previousState;
        let reason = '';

        // 1. Critical Hard Rules (Risk dominates)
        if (riskScore >= 80) { // CRITICAL RISK
            newState = 'LOCKED';
            reason = 'Critical risk threshold exceeded.';
        } else if (riskScore >= 60) { // HIGH RISK
            newState = 'RESTRICTED';
            reason = 'High risk detected. Restricting access.';
        } else if (fusion.decision === 'SPOOF_DETECTED') {
            newState = (previousState === 'LOCKED') ? 'LOCKED' : 'RESTRICTED';
            reason = 'Spoof detected by Fusion Engine. Restricting access.';
        } else if (fusion.decision === 'CONFLICT') {
            newState = (previousState === 'LOCKED' || previousState === 'RESTRICTED') ? previousState : 'CHALLENGE';
            reason = 'Contradictory human evidence detected by Fusion Engine. Stepping up.';
        } else {
            // 2. Identity Confidence with Hysteresis
            // Define thresholds
            const CHALLENGE_ENTER = 0.70;
            const CHALLENGE_EXIT = 0.80; // Must get higher to exit challenge

            const OBSERVE_ENTER = 0.85;
            const OBSERVE_EXIT = 0.90; // Must get higher to exit observe and reach TRUSTED

            switch (previousState) {
                case 'TRUSTED':
                    if (confidence < OBSERVE_ENTER || riskScore >= 30) {
                        newState = 'OBSERVE';
                        reason = 'Confidence dropped below observe threshold, or moderate risk detected.';
                    }
                    if (confidence < CHALLENGE_ENTER || riskScore >= 50) {
                        newState = 'CHALLENGE';
                        reason = 'Confidence dropped significantly, or high risk detected.';
                    }
                    break;

                case 'OBSERVE':
                    if (confidence >= OBSERVE_EXIT && riskScore < 30) {
                        newState = 'TRUSTED';
                        reason = 'Confidence restored above trusted exit threshold.';
                    } else if (confidence < CHALLENGE_ENTER || riskScore >= 50) {
                        newState = 'CHALLENGE';
                        reason = 'Confidence dropped below challenge threshold.';
                    }
                    break;

                case 'CHALLENGE':
                    // To exit challenge to a better state, we need strong confidence
                    if (confidence >= CHALLENGE_EXIT && riskScore < 50) {
                        // Re-evaluate if we can go all the way to TRUSTED or just OBSERVE
                        if (confidence >= OBSERVE_EXIT && riskScore < 30) {
                            newState = 'TRUSTED';
                            reason = 'Step-up successful, confidence restored to trusted.';
                        } else {
                            newState = 'OBSERVE';
                            reason = 'Step-up acceptable, but still monitoring.';
                        }
                    }
                    break;

                case 'RESTRICTED':
                case 'LOCKED':
                    // Usually requires out-of-band admin action to exit these states, 
                    // but for prototype, we might allow exit if risk completely drops
                    if (riskScore < 20 && confidence >= CHALLENGE_EXIT) {
                        newState = 'CHALLENGE';
                        reason = 'Risk abated, attempting re-authentication.';
                    }
                    break;
            }
        }

        // Generate Audit Event if state changed
        if (newState !== previousState) {
            await this.logTrustEvent(context, newState, reason);
        }

        return {
            state: newState,
            reason: reason || 'Maintained previous state.'
        };
    }

    private static async logTrustEvent(context: TrustEvaluationContext, newState: TrustState, reason: string) {
        try {
            // Write to TrustEvent
            await prisma.trustEvent.create({
                data: {
                    userId: context.userId,
                    previousState: context.previousState,
                    newState,
                    reason,
                    confidenceScore: context.fusion.identityConfidence,
                    riskLevel: context.risk.level
                }
            });

            // Write to AuditLog
            await prisma.auditLog.create({
                data: {
                    userId: context.userId,
                    action: 'TRUST_STATE_CHANGE',
                    ipAddress: 'internal',
                    metadata: {
                        previousState: context.previousState,
                        newState,
                        reason,
                        identityConfidence: context.fusion.identityConfidence,
                        riskScore: context.risk.score,
                        fusionVersion: context.fusion.configurationVersion
                    }
                }
            });
        } catch (error) {
            logger.error('Failed to log trust event:', error);
        }
    }
}
