import { TrustState } from './trust.service';
import { IdentityModality } from '../types/evidence';

export interface PolicyContext {
    trustState: TrustState;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    completedFactors: IdentityModality[];
    failedFactors: IdentityModality[];
    availableFactors: IdentityModality[];
    authenticationStage: 'INITIAL_LOGIN' | 'CONTINUOUS' | 'STEP_UP';
    sessionState?: string;
    fusionDecision?: 'MATCH' | 'LOW_CONFIDENCE' | 'CONFLICT' | 'SPOOF_DETECTED' | 'INSUFFICIENT_EVIDENCE';
}

export type PolicyAction = 'ALLOW' | 'REQUIRE_MFA' | 'RESTRICT' | 'LOCK' | 'OBSERVE';

export interface PolicyDecision {
    action: PolicyAction;
    requiredFactors: IdentityModality[];
    reason: string;
    nextSessionState: 'ACTIVE' | 'CHALLENGE_REQUIRED' | 'STEP_UP_REQUIRED' | 'RESTRICTED' | 'LOCKED' | 'TERMINATED' | 'FACE_VERIFIED' | 'VOICE_VERIFIED';
}

import { logger } from '../utils/logger';

export class PolicyEngineService {

    /**
     * Determines the next authentication action based on the Trust State and Context.
     */
    static evaluate(context: PolicyContext): PolicyDecision {
        const decision = this._evaluate(context);
        
        logger.info('--- POLICY TELEMETRY ---', {
            fusionDecision: context.fusionDecision,
            trustState: context.trustState,
            policyDecision: decision.action,
            nextSessionState: decision.nextSessionState
        });

        return decision;
    }

    private static _evaluate(context: PolicyContext): PolicyDecision {
        const { trustState, riskLevel, completedFactors, failedFactors, availableFactors, authenticationStage, sessionState } = context;

        // 1. Critical Hard Rules
        if (trustState === 'LOCKED' || riskLevel === 'CRITICAL') {
            return {
                action: 'LOCK',
                requiredFactors: [],
                reason: 'Critical risk or Locked trust state.',
                nextSessionState: 'LOCKED'
            };
        }

        // Hard Boundary: Spoofing is a strict failure. No step up allowed.
        if (context.fusionDecision === 'SPOOF_DETECTED') {
            return {
                action: 'RESTRICT',
                requiredFactors: [],
                reason: 'Spoof detected by Fusion Engine. Immediate restriction.',
                nextSessionState: 'RESTRICTED'
            };
        }

        // Hard Boundary: Conflicting identity forces a challenge immediately.
        if (context.fusionDecision === 'CONFLICT') {
            return {
                action: 'REQUIRE_MFA',
                requiredFactors: this.getNextFactors(completedFactors, failedFactors, availableFactors),
                reason: 'Identity contradiction detected. Challenge required.',
                nextSessionState: 'CHALLENGE_REQUIRED'
            };
        }

        if (context.fusionDecision === 'INSUFFICIENT_EVIDENCE') {
            return {
                action: 'REQUIRE_MFA',
                requiredFactors: this.getNextFactors(completedFactors, failedFactors, availableFactors),
                reason: 'Insufficient biometric evidence. Challenge required.',
                nextSessionState: 'CHALLENGE_REQUIRED'
            };
        }

        if (context.fusionDecision === 'LOW_CONFIDENCE') {
            return {
                action: 'REQUIRE_MFA',
                requiredFactors: this.getNextFactors(completedFactors, failedFactors, availableFactors),
                reason: 'Low confidence in identity. Step-up challenge required.',
                nextSessionState: 'CHALLENGE_REQUIRED'
            };
        }

        if (trustState === 'RESTRICTED' || riskLevel === 'HIGH') {
            // Check if they can step up
            if (this.canStepUp(completedFactors, failedFactors, availableFactors)) {
                return {
                    action: 'REQUIRE_MFA',
                    requiredFactors: this.getNextFactors(completedFactors, failedFactors, availableFactors),
                    reason: 'High risk detected. Mandatory Step-Up.',
                    nextSessionState: 'STEP_UP_REQUIRED'
                };
            } else {
                return {
                    action: 'RESTRICT',
                    requiredFactors: [],
                    reason: 'High risk and no available step-up factors.',
                    nextSessionState: 'RESTRICTED'
                };
            }
        }

        // 2. Initial Login / Challenge Phase Logic
        if (sessionState === 'CHALLENGE_REQUIRED' || sessionState === 'FACE_VERIFIED' || sessionState === 'VOICE_VERIFIED') {
            const hasFace = completedFactors.includes('FACE');
            const hasVoice = completedFactors.includes('VOICE');

            if (!hasFace && availableFactors.includes('FACE')) {
                return {
                    action: 'REQUIRE_MFA',
                    requiredFactors: ['FACE'],
                    reason: 'Face verification required.',
                    nextSessionState: 'CHALLENGE_REQUIRED'
                };
            }
            if (!hasVoice && availableFactors.includes('VOICE')) {
                return {
                    action: 'REQUIRE_MFA',
                    requiredFactors: ['VOICE'],
                    reason: 'Voice verification required.',
                    nextSessionState: 'FACE_VERIFIED'
                };
            }
            // If both passed, we require TOTP MFA
            return {
                action: 'REQUIRE_MFA',
                requiredFactors: [],
                reason: 'MFA TOTP verification required.',
                nextSessionState: 'VOICE_VERIFIED'
            };
        }

        // 3. Trust-Based Actions (Continuous / Step-Up)
        switch (trustState) {
            case 'TRUSTED':
                return {
                    action: 'ALLOW',
                    requiredFactors: [],
                    reason: 'Identity is strongly trusted.',
                    nextSessionState: 'ACTIVE'
                };
            
            case 'OBSERVE':
                return {
                    action: 'OBSERVE',
                    requiredFactors: [],
                    reason: 'Monitoring identity. Confidence is acceptable but not high.',
                    nextSessionState: 'ACTIVE'
                };

            case 'CHALLENGE':
                if (this.canStepUp(completedFactors, failedFactors, availableFactors)) {
                    return {
                        action: 'REQUIRE_MFA',
                        requiredFactors: this.getNextFactors(completedFactors, failedFactors, availableFactors),
                        reason: 'Identity confidence requires challenge.',
                        nextSessionState: 'CHALLENGE_REQUIRED'
                    };
                } else {
                    return {
                        action: 'RESTRICT',
                        requiredFactors: [],
                        reason: 'Failed challenge and no more factors available.',
                        nextSessionState: 'RESTRICTED'
                    };
                }
                
            default:
                return {
                    action: 'LOCK',
                    requiredFactors: [],
                    reason: 'Unknown trust state.',
                    nextSessionState: 'LOCKED'
                };
        }
    }

    private static canStepUp(completed: IdentityModality[], failed: IdentityModality[], available: IdentityModality[]): boolean {
        // Returns true if there is at least one available factor that hasn't been failed yet.
        const usedOrFailed = new Set([...completed, ...failed]);
        for (const factor of available) {
            if (!usedOrFailed.has(factor)) {
                return true;
            }
        }
        // If they failed a factor, maybe we let them retry once? 
        // For strict prototype, we say no available factors left.
        return false;
    }

    private static getNextFactors(completed: IdentityModality[], failed: IdentityModality[], available: IdentityModality[]): IdentityModality[] {
        const usedOrFailed = new Set([...completed, ...failed]);
        
        // Priority: FACE, then VOICE
        if (available.includes('FACE') && !usedOrFailed.has('FACE')) return ['FACE'];
        if (available.includes('VOICE') && !usedOrFailed.has('VOICE')) return ['VOICE'];
        
        // Return whatever is left
        return available.filter(f => !usedOrFailed.has(f));
    }
}
