import { FusionEngineService } from './fusion.service';
import { RiskEngineService, RiskEvent } from './risk.service';
import { TrustEngineService, TrustState } from './trust.service';
import { PolicyEngineService, PolicyContext, PolicyDecision } from './policy.service';
import { NormalizedEvidence, IdentityModality } from '../types/evidence';
import { AISecurityEvidence, aiEventCoordinator } from './ai';
import prisma from '../prisma';

export class AdaptiveAuthenticationService {
    
    /**
     * The master orchestrator loop.
     * Called whenever a new piece of evidence is presented or when an initial login occurs.
     */
    static async evaluateAuthenticationEvent(
        userId: string,
        sessionId: string,
        stage: 'INITIAL_LOGIN' | 'CONTINUOUS' | 'STEP_UP',
        newEvidence: NormalizedEvidence[],
        riskEvents: RiskEvent[]
    ): Promise<PolicyDecision> {
        
        // 1. Fetch Session & Existing State
        const session = await prisma.authSession.findUnique({
            where: { id: sessionId }
        });
        
        if (!session) {
            throw new Error('Session not found');
        }

        const previousTrustState: TrustState = (session.trustState as TrustState) || 'CHALLENGE';

        // 2. Fetch User Profile to see available factors
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { biometricProfile: true }
        });

        const availableFactors: IdentityModality[] = [];
        if (user?.biometricProfile?.faceTemplate) availableFactors.push('FACE');
        if (user?.biometricProfile?.voiceTemplate) availableFactors.push('VOICE');

        // 3. Evaluate Fusion (Identity Confidence) if not INITIAL_LOGIN
        let fusionResult: any = null;
        if (stage !== 'INITIAL_LOGIN') {
            fusionResult = await FusionEngineService.evaluate(newEvidence);
            if (stage === 'CONTINUOUS' && newEvidence.length === 0 && session.status === 'ACTIVE') {
                fusionResult.identityConfidence = 1.0;
                fusionResult.assuranceLevel = 'HIGH';
                fusionResult.decision = 'MATCH';
            }

            if (fusionResult.decision === 'SPOOF_DETECTED') {
                riskEvents.push({
                    type: 'SECURITY_EVENT',
                    severity: 70,
                    timestamp: new Date(),
                    description: 'Spoofing detected by Fusion Engine'
                });
            } else if (fusionResult.decision === 'CONFLICT') {
                riskEvents.push({
                    type: 'SECURITY_EVENT',
                    severity: 40,
                    timestamp: new Date(),
                    description: 'Biometric contradiction detected'
                });
            }
        }

        // 4. Evaluate Risk
        const riskResult = RiskEngineService.evaluate(riskEvents);

        let policyDecision: PolicyDecision;
        let trustResult: any;

        // If INITIAL_LOGIN, we don't have enough evidence to fuse yet (unless behavioral)
        if (stage === 'INITIAL_LOGIN') {
            const context: PolicyContext = {
                trustState: 'CHALLENGE', // Doesn't matter yet
                riskLevel: riskResult.level,
                completedFactors: ['PASSWORD'],
                failedFactors: [],
                availableFactors,
                authenticationStage: stage,
                sessionState: session.status
            };
            policyDecision = PolicyEngineService.evaluate(context);
        } else {
            // 5. Evaluate Trust
            trustResult = await TrustEngineService.evaluate({
                fusion: fusionResult,
                risk: riskResult,
                previousState: previousTrustState,
                userId,
                sessionId
            });

            // Calculate completed and failed factors
            const completed = [...fusionResult.evidenceUsed];
            if (session.status === 'FACE_VERIFIED') {
                if (!completed.includes('FACE')) completed.push('FACE');
            } else if (session.status === 'VOICE_VERIFIED') {
                if (!completed.includes('FACE')) completed.push('FACE');
                if (!completed.includes('VOICE')) completed.push('VOICE');
            }
            const failed = fusionResult.evidenceRejected.map((e: any) => e.modality);

            // 6. Evaluate Policy
            const context: PolicyContext = {
                trustState: trustResult.state,
                riskLevel: riskResult.level,
                completedFactors: completed,
                failedFactors: failed,
                availableFactors,
                authenticationStage: stage,
                sessionState: session.status,
                fusionDecision: fusionResult.decision
            };
            
            policyDecision = PolicyEngineService.evaluate(context);
        }

        // 7. Update Session State with OCC (Optimistic Concurrency Control) and Monotonic Enforcement
        let finalPolicyDecision = policyDecision;
        let updateSuccess = false;
        let retries = 3;
        let currentSessionSnapshot = session;

        while (!updateSuccess && retries > 0) {
            let targetStatus = finalPolicyDecision.nextSessionState;
            let targetTrust = trustResult?.state;

            // ENFORCE MONOTONIC SECURITY BOUNDARIES
            if (currentSessionSnapshot.status === 'LOCKED') {
                targetStatus = 'LOCKED';
                targetTrust = 'LOCKED';
                finalPolicyDecision.action = 'LOCK';
                finalPolicyDecision.nextSessionState = 'LOCKED';
            } else if (currentSessionSnapshot.status === 'RESTRICTED' && targetStatus === 'ACTIVE') {
                // Background heartbeats cannot recover a RESTRICTED session to ACTIVE
                targetStatus = 'RESTRICTED';
                targetTrust = 'RESTRICTED';
                finalPolicyDecision.action = 'REQUIRE_MFA';
                finalPolicyDecision.nextSessionState = 'RESTRICTED';
            }

            // If no state change is needed after enforcing monotonicity, we are done
            if (currentSessionSnapshot.status === targetStatus && currentSessionSnapshot.trustState === targetTrust) {
                updateSuccess = true;
                break;
            }

            // Attempt OCC Update
            const updateResult = await prisma.authSession.updateMany({
                where: { 
                    id: sessionId,
                    updatedAt: currentSessionSnapshot.updatedAt 
                },
                data: { 
                    status: targetStatus,
                    trustState: targetTrust
                }
            });

            if (updateResult.count === 1) {
                updateSuccess = true;
            } else {
                // OCC Conflict (Lost Update Prevented!)
                const latestSession = await prisma.authSession.findUnique({ where: { id: sessionId } });
                if (!latestSession) throw new Error('Session deleted during OCC retry');
                currentSessionSnapshot = latestSession;
                retries--;
            }
        }

        if (!updateSuccess) {
            console.error(`[AdaptiveAuthService] Max OCC retries exceeded for session ${sessionId}. Forcing SAFE fallback.`);
            finalPolicyDecision = { action: 'RESTRICT', nextSessionState: 'RESTRICTED', requiredFactors: [], reason: 'OCC Retry Exhausted' };
        }

        // 8. Trigger AI Security Brain (Asynchronous Parallel Observer)
        // Categorize the event for the payload. The Coordinator will handle gating, dedup, and caching.
        let triggerEvent = 'HEARTBEAT';
        const currentState = trustResult?.state || previousTrustState;
        if (previousTrustState !== currentState) {
            triggerEvent = `TRUST_STATE_TRANSITION`;
        } else if (riskResult.score >= 50) {
            triggerEvent = `HIGH_RISK_SCORE`;
        } else if (fusionResult?.decision === 'SPOOF_DETECTED' || fusionResult?.decision === 'CONFLICT') {
            triggerEvent = `BIOMETRIC_ANOMALY`;
        }

        const evidence: AISecurityEvidence = {
            session: {
                sessionId,
                ageSeconds: session.createdAt ? Math.floor((Date.now() - session.createdAt.getTime()) / 1000) : 0
            },
            identity: { userId },
            risk: {
                score: riskResult.score,
                level: riskResult.level,
                factors: riskResult.factors.map(f => f.description)
            },
            trust: {
                state: currentState,
                previousState: previousTrustState
            },
            biometrics: fusionResult ? {
                modalitiesUsed: fusionResult.evidenceUsed,
                fusionDecision: fusionResult.decision
            } : undefined,
            triggerEvent,
            timestamp: new Date().toISOString()
        };
        
        // Fire and forget (do not await). Coordinator handles deduplication, caching, and dispatch
        try {
            aiEventCoordinator.analyzeEvent(evidence);
        } catch (error) {
            // Guarantee isolated failure
            console.error('[AdaptiveAuthService] AI Coordinator sync error:', error);
        }

        return finalPolicyDecision;
    }
}
