import { AdaptiveAuthenticationService } from './services/adaptiveAuth.service';
import prisma from './prisma';
import { aiEventCoordinator } from './services/ai';
import { TrustEngineService } from './services/trust.service';
import { FusionEngineService } from './services/fusion.service';
import * as assert from 'assert';
import { NormalizedEvidence } from './types/evidence';

async function runRaceAudit() {
    console.log("===================================================================");
    console.log("  PHASE 3J.5 RACE CONDITION AUDIT (TOCTOU)");
    console.log("===================================================================");

    let mockSessionState = 'ACTIVE';
    let mockTrustState = 'TRUSTED';
    let fetchCount = 0;
    
    // Simulate DB delay to force race condition overlap
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    (prisma.authSession as any).findUnique = async (args: any) => {
        if (args.where.id === 'test-session') {
            const currentFetch = ++fetchCount;
            console.log(`[Thread ${currentFetch}] Fetched session from DB: state=${mockSessionState}`);
            // Force a 100ms artificial delay after fetching so both requests fetch the SAME original state
            await delay(100);
            return {
                id: 'test-session',
                userId: 'test-user',
                status: mockSessionState,
                trustState: mockTrustState,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                user: { id: 'test-user', email: 'a@a.com', role: 'USER' }
            };
        }
        return null;
    };
    
    (prisma.authSession as any).update = async (args: any) => {
        if (args.where.id === 'test-session') {
            console.log(`[DB Write] Updating session in DB: status=${args.data.status}`);
            mockSessionState = args.data.status || mockSessionState;
            mockTrustState = args.data.trustState || mockTrustState;
        }
        return {};
    };

    (prisma.user as any).findUnique = async () => ({
        id: 'test-user', biometricProfile: { faceTemplate: 'yes', voiceTemplate: 'yes' }
    });
    
    (aiEventCoordinator as any).analyzeEvent = () => {};
    // Mock Trust Engine so it doesn't decay trust artificially, keeping it TRUSTED
    (TrustEngineService as any).evaluate = async () => ({ state: 'TRUSTED' });
    (TrustEngineService as any).logTrustEvent = async () => {};
    
    (FusionEngineService as any).evaluate = async () => {
        return {
            decision: 'MATCH',
            identityConfidence: 0.9,
            humanConfidence: 0.9,
            deviceAssurance: 1.0,
            assuranceLevel: 'HIGH',
            evidenceUsed: ['FACE'],
            evidenceRejected: []
        }
    };

    console.log("\n--- TEST: Concurrent High Risk vs Valid Biometrics ---");
    console.log("Scenario: A High Risk event arrives at the same time as a valid biometric heartbeat.");

    // Threat Request: Injects Risk 85 to force LOCKED
    const requestA = AdaptiveAuthenticationService.evaluateAuthenticationEvent(
        'test-user', 'test-session', 'CONTINUOUS', [], [{ type: 'SESSION_ANOMALY', severity: 85, timestamp: new Date(), description: 'High Risk' }]
    );
    
    // Valid Request: Injects valid biometrics and no new risk
    const requestB = AdaptiveAuthenticationService.evaluateAuthenticationEvent(
        'test-user', 'test-session', 'CONTINUOUS', [{
            modality: 'FACE',
            timestamp: new Date().toISOString(),
            confidence: 0.9
        } as unknown as NormalizedEvidence], []
    );

    await Promise.all([requestA, requestB]);

    console.log(`\n[RESULT] Final DB Session State: ${mockSessionState}`);
    
    try {
        assert.strictEqual(mockSessionState, 'LOCKED', "Race condition allowed a subsequent write to overwrite LOCKED!");
        console.log("\n[INFO] All strict assertions passed.");
    } catch (e: any) {
        console.error("\n[VULNERABILITY DETECTED] " + e.message);
        process.exit(1);
    }
}

runRaceAudit();
