import { AdaptiveAuthenticationService } from './services/adaptiveAuth.service';
import prisma from './prisma';
import { aiEventCoordinator } from './services/ai';
import { FusionEngineService } from './services/fusion.service';
import * as assert from 'assert';
import { NormalizedEvidence } from './types/evidence';
import { TrustEngineService } from './services/trust.service';
import { requireActiveSession, requirePrivilegedAction } from './middleware';

const originalUpdateMany = prisma.authSession.updateMany.bind(prisma.authSession);
let globalOccAttempts = 0;
let globalOccSuccesses = 0;
(prisma.authSession as any).updateMany = async (args: any) => {
    globalOccAttempts++;
    const res = await originalUpdateMany(args);
    if (res.count === 1) globalOccSuccesses++;
    return res;
};

// Mock External Dependencies
(aiEventCoordinator as any).analyzeEvent = () => {};
(TrustEngineService as any).logTrustEvent = async () => {};

let mockFusionDelay = 50;
(FusionEngineService as any).evaluate = async (evidence: any) => {
    await new Promise(r => setTimeout(r, mockFusionDelay));
    
    // Auto-detect which evidence was passed to build the response
    const used = evidence.map((e: any) => e.modality);
    
    return {
        decision: 'MATCH',
        identityConfidence: 0.9,
        humanConfidence: 0.9,
        deviceAssurance: 1.0,
        assuranceLevel: 'HIGH',
        evidenceUsed: used,
        evidenceRejected: []
    };
};

async function createTestSession(status: string, trustState: string) {
    const user = await prisma.user.create({
        data: {
            email: `race_test_${Date.now()}_${Math.random()}@test.com`,
            passwordHash: 'hash',
            role: 'USER',
            mfaSecretEnc: 'secret',
            biometricProfile: { create: { faceTemplate: 'yes', voiceTemplate: 'yes' } }
        }
    });

    const session = await prisma.authSession.create({
        data: {
            userId: user.id,
            status: status,
            trustState: trustState,
            isActive: true,
            ipAddress: '127.0.0.1',
            userAgent: 'test',
            device: 'test_dev'
        }
    });
    return { user, session };
}

async function cleanupTestSession(user: any, session: any) {
    await prisma.authSession.delete({ where: { id: session.id } });
    await prisma.biometricProfile.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
}

async function runRaceTest(
    testName: string, 
    iterations: number, 
    initialStatus: string, 
    initialTrust: string, 
    reqA_risk: number, 
    reqB_evidence: any[], 
    expectedFinalStatuses: string[],
    delayA: number = 0,
    delayB: number = 0
) {
    console.log(`\n============================================================`);
    console.log(` ${testName}`);
    console.log(`============================================================`);
    let fails = 0;

    let startOccAttempts = globalOccAttempts;
    let startOccSuccesses = globalOccSuccesses;

    for (let i = 0; i < iterations; i++) {
        const { user, session } = await createTestSession(initialStatus, initialTrust);

        mockFusionDelay = 50; // Standard delay

        const runA = async () => {
            if (delayA > 0) await new Promise(r => setTimeout(r, delayA));
            if (reqA_risk > 0) {
                await AdaptiveAuthenticationService.evaluateAuthenticationEvent(
                    user.id, session.id, 'CONTINUOUS', [], [{ type: 'SESSION_ANOMALY', severity: reqA_risk, timestamp: new Date(), description: 'Risk Event' }]
                );
            }
        };

        const runB = async () => {
            if (delayB > 0) await new Promise(r => setTimeout(r, delayB));
            if (reqB_evidence.length > 0) {
                await AdaptiveAuthenticationService.evaluateAuthenticationEvent(
                    user.id, session.id, 'CONTINUOUS', reqB_evidence, []
                );
            }
        };

        await Promise.all([runA(), runB()]);

        const finalSession = await prisma.authSession.findUnique({ where: { id: session.id } });
        
        // Assert monotonic state and tuple correctness
        if (!expectedFinalStatuses.includes(finalSession?.status as string)) {
            fails++;
            console.error(`[Iter ${i+1}] FAIL: Expected one of ${expectedFinalStatuses.join('|')}, got ${finalSession?.status}`);
        }

        // Test 11 - Tuple consistency check
        if (finalSession?.status === 'LOCKED' && finalSession?.trustState !== 'LOCKED') {
            fails++;
            console.error(`[Iter ${i+1}] FAIL: Tuple consistency broken. LOCKED status but Trust is ${finalSession?.trustState}`);
        }
        
        await cleanupTestSession(user, session);
    }
    
    let collisions = (globalOccAttempts - startOccAttempts) - (globalOccSuccesses - startOccSuccesses);
    console.log(`Completed ${iterations} iterations. Fails: ${fails}. OCC Collisions detected: ${collisions}`);
    if (fails > 0) throw new Error(`${testName} FAILED`);
}

async function runAllTests() {
    console.log("PHASE 3J.5R.4 — FULL SESSION LIFECYCLE CONCURRENCY REGRESSION AUDIT");

    const faceEv = [{ modality: 'FACE', timestamp: new Date().toISOString(), confidence: 0.9 } as unknown as NormalizedEvidence];
    const voiceEv = [{ modality: 'VOICE', timestamp: new Date().toISOString(), confidence: 0.9 } as unknown as NormalizedEvidence];
    const faceVoiceEv = [...faceEv, ...voiceEv];

    // TEST 1 — LOCKED VS ACTIVE RECOVERY RACE
    await runRaceTest('TEST 1 — LOCKED VS ACTIVE RECOVERY RACE', 100, 'CHALLENGE_REQUIRED', 'CHALLENGE', 85, faceVoiceEv, ['LOCKED']);

    // TEST 2 — LOCKED VS FACE-ONLY RACE
    await runRaceTest('TEST 2 — LOCKED VS FACE-ONLY RACE', 100, 'CHALLENGE_REQUIRED', 'CHALLENGE', 85, faceEv, ['LOCKED']);

    // TEST 3 — LOCKED VS VOICE-ONLY RACE
    await runRaceTest('TEST 3 — LOCKED VS VOICE-ONLY RACE', 100, 'CHALLENGE_REQUIRED', 'CHALLENGE', 85, voiceEv, ['LOCKED']);

    // TEST 4 — RESTRICTED VS ACTIVE RECOVERY RACE
    // PolicyEngine may evaluate RESTRICTED + available factors -> STEP_UP_REQUIRED
    await runRaceTest('TEST 4 — RESTRICTED VS ACTIVE RECOVERY RACE', 100, 'RESTRICTED', 'RESTRICTED', 60, faceVoiceEv, ['RESTRICTED', 'STEP_UP_REQUIRED']);

    // TEST 5 — ACTIVE VS LOCKED RACE
    await runRaceTest('TEST 5 — ACTIVE VS LOCKED RACE', 100, 'ACTIVE', 'TRUSTED', 85, faceEv, ['LOCKED']);

    // TEST 6 — RESTRICTED VS LOCKED RACE
    await runRaceTest('TEST 6 — RESTRICTED VS LOCKED RACE', 100, 'RESTRICTED', 'RESTRICTED', 85, faceEv, ['LOCKED']);

    // TEST 7 — CHALLENGE LEGITIMATE RECOVERY
    await runRaceTest('TEST 7 — CHALLENGE LEGITIMATE RECOVERY', 50, 'CHALLENGE_REQUIRED', 'CHALLENGE', 0, faceVoiceEv, ['VOICE_VERIFIED', 'ACTIVE']);

    // TEST 8 — REVERSE ORDER RACE (Threat starts slightly after Biometric)
    await runRaceTest('TEST 8 — REVERSE ORDER RACE (Threat delayed)', 50, 'CHALLENGE_REQUIRED', 'CHALLENGE', 85, faceVoiceEv, ['LOCKED'], 20, 0);

    // TEST 12 — ROUTE-LEVEL ENFORCEMENT REGRESSION
    console.log(`\n============================================================`);
    console.log(` TEST 12 — ROUTE-LEVEL ENFORCEMENT REGRESSION`);
    console.log(`============================================================`);
    
    const { user: lockedUser, session: lockedSession } = await createTestSession('LOCKED', 'LOCKED');
    const { user: restrictedUser, session: restrictedSession } = await createTestSession('RESTRICTED', 'RESTRICTED');

    const createMockReqRes = (sessionData: any): any => {
        return {
            req: { user: sessionData, headers: { authorization: 'Bearer test', 'x-session-id': sessionData.id } },
            res: {
                status: (code: number) => ({ json: (data: any) => { throw new Error(`HTTP ${code}: ${JSON.stringify(data)}`); } })
            }
        };
    };

    try {
        const { req, res } = createMockReqRes(lockedSession);
        let allowed = false;
        try {
            await requireActiveSession(req, res, (err?: any) => {
                if (err) throw err;
                allowed = true;
            });
        } catch (e: any) {
            // Middleware correctly threw an error via next(err)
        }
        assert.ok(!allowed, "LOCKED session bypassed requireActiveSession");
    } catch (e) {
        console.error("TEST 12 FAIL: Locked session standard enforcement failed", e);
        process.exit(1);
    }

    try {
        const { req, res } = createMockReqRes(restrictedSession);
        let allowed = false;
        try {
            await requirePrivilegedAction(req, res, (err?: any) => {
                if (err) throw err;
                allowed = true;
            });
        } catch (e: any) {
            // Middleware correctly threw an error via next(err) or res.status() threw
        }
        assert.ok(!allowed, "RESTRICTED session bypassed requirePrivilegedAction");
    } catch (e) {
        console.error("TEST 12 FAIL: Restricted session privileged enforcement failed", e);
        process.exit(1);
    }

    console.log("Middleware route-level enforcement PASSED.");

    await cleanupTestSession(lockedUser, lockedSession);
    await cleanupTestSession(restrictedUser, restrictedSession);

    console.log(`\n============================================================`);
    console.log(`  ALL 3J.5R.4 REGRESSION TESTS PASSED.`);
    console.log(`  Total OCC Conflicts Mitigated: ${globalOccAttempts - globalOccSuccesses}`);
    console.log(`============================================================`);
    process.exit(0);
}

runAllTests().catch(e => {
    console.error(e);
    process.exit(1);
});
