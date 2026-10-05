import { AdaptiveAuthenticationService } from './services/adaptiveAuth.service';
import prisma from './prisma';
import { aiEventCoordinator } from './services/ai';
import { FusionEngineService } from './services/fusion.service';
import * as assert from 'assert';
import { NormalizedEvidence } from './types/evidence';
import { TrustEngineService } from './services/trust.service';

async function runRealDBRaceAudit() {
    console.log("===================================================================");
    console.log("  PHASE 3J.5R.1 REAL DB CONCURRENCY REPRODUCTION (CHALLENGE -> ACTIVE)");
    console.log("===================================================================");

    (aiEventCoordinator as any).analyzeEvent = () => {};
    (TrustEngineService as any).logTrustEvent = async () => {};
    
    (FusionEngineService as any).evaluate = async () => {
        // Delay ensures Request A finishes its quick synchronous evaluation
        // and starts writing to DB before Request B reaches DB write.
        await new Promise(r => setTimeout(r, 50));
        return {
            decision: 'MATCH',
            identityConfidence: 0.9,
            humanConfidence: 0.9,
            deviceAssurance: 1.0,
            assuranceLevel: 'HIGH',
            evidenceUsed: ['FACE', 'VOICE'],
            evidenceRejected: []
        };
    };

    const iterations = 50;
    let vulnerabilitiesFound = 0;

    for (let i = 0; i < iterations; i++) {
        const user = await prisma.user.create({
            data: {
                email: `race_test_${Date.now()}_${i}@test.com`,
                passwordHash: 'hash',
                role: 'USER',
                mfaSecretEnc: 'secret',
                biometricProfile: {
                    create: {
                        faceTemplate: 'yes',
                        voiceTemplate: 'yes'
                    }
                }
            }
        });

        const session = await prisma.authSession.create({
            data: {
                userId: user.id,
                status: 'CHALLENGE_REQUIRED',
                trustState: 'CHALLENGE',
                isActive: true,
                ipAddress: '127.0.0.1',
                userAgent: 'test',
                device: 'test_dev'
            }
        });

        const requestA = AdaptiveAuthenticationService.evaluateAuthenticationEvent(
            user.id, session.id, 'CONTINUOUS', [], [{ type: 'SESSION_ANOMALY', severity: 85, timestamp: new Date(), description: 'High Risk' }]
        );
        
        const requestB = AdaptiveAuthenticationService.evaluateAuthenticationEvent(
            user.id, session.id, 'CONTINUOUS', [{
                modality: 'FACE',
                timestamp: new Date().toISOString(),
                confidence: 0.9
            } as unknown as NormalizedEvidence, {
                modality: 'VOICE',
                timestamp: new Date().toISOString(),
                confidence: 0.9
            } as unknown as NormalizedEvidence], []
        );

        await Promise.all([requestA, requestB]);

        const finalSession = await prisma.authSession.findUnique({ where: { id: session.id } });
        
        // If Request A (LOCKED) was completely overwritten by Request B (VOICE_VERIFIED or ACTIVE)
        if (finalSession?.status !== 'LOCKED') {
            vulnerabilitiesFound++;
            console.log(`[Iter ${i+1}] VULNERABILITY DETECTED! Final State: ${finalSession?.status}`);
        } else {
            console.log(`[Iter ${i+1}] Safe. Final State: ${finalSession?.status}`);
        }
        
        await prisma.authSession.delete({ where: { id: session.id } });
        await prisma.biometricProfile.deleteMany({ where: { userId: user.id } });
        await prisma.user.delete({ where: { id: user.id } });
    }

    console.log(`\n===================================================================`);
    console.log(`  RESULTS: ${vulnerabilitiesFound} lost updates detected across ${iterations} iterations.`);
    console.log(`===================================================================`);
    
    if (vulnerabilitiesFound > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runRealDBRaceAudit().catch(err => {
    console.error(err);
    process.exit(2);
});
