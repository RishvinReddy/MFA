import assert from 'assert';
import { AdaptiveAuthenticationService } from '../src/services/adaptiveAuth.service';
import { NormalizedEvidence, IdentityEvidence } from '../src/types/evidence';
import { ConfigService } from '../src/services/config.service';
import prisma from '../src/prisma';

async function runIntegrationTests() {
    console.log("=========================================");
    console.log("🚀 Running M2.5.4 Adaptive Auth Orchestrator...");
    console.log("=========================================\\n");

    await ConfigService.getFusionConfig();

    const testUserId = 'test-user-id-adaptive';
    const testSessionId = 'test-session-id-adaptive';

    try {
        await prisma.trustEvent.deleteMany({ where: { userId: testUserId } });
        await prisma.auditLog.deleteMany({ where: { userId: testUserId } });
        await prisma.authSession.deleteMany({ where: { userId: testUserId } });
        await prisma.biometricProfile.deleteMany({ where: { userId: testUserId } });
        await prisma.user.deleteMany({ where: { id: testUserId } });
        
        await prisma.user.create({
            data: { 
                id: testUserId, email: 'adaptive@example.com', passwordHash: 'hash',
                biometricProfile: { create: { faceTemplate: 'mock', voiceTemplate: 'mock' } }
            }
        });
        await prisma.authSession.create({
            data: { id: testSessionId, userId: testUserId, ipAddress: '127.0.0.1', device: 'test', status: 'ACTIVE', trustState: 'CHALLENGE' }
        });
    } catch (e) {
        console.warn("Could not create mock DB context.", e);
    }

    let passed = 0;
    let failed = 0;

    async function run(name: string, fn: () => void | Promise<void>) {
        try {
            await fn();
            console.log(`✅ PASS: ${name}`);
            passed++;
        } catch (e) {
            console.error(`❌ FAIL: ${name}`);
            console.error(e);
            failed++;
        }
    }

    // 1. INITIAL_LOGIN -> REQUIRE_MFA
    await run("INITIAL_LOGIN triggers REQUIRE_MFA", async () => {
        const decision = await AdaptiveAuthenticationService.evaluateAuthenticationEvent(
            testUserId, testSessionId, 'INITIAL_LOGIN', [], []
        );
        assert.strictEqual(decision.action, 'REQUIRE_MFA');
        assert.strictEqual(decision.nextSessionState, 'CHALLENGE_REQUIRED');
        
        const session = await prisma.authSession.findUnique({ where: { id: testSessionId }});
        assert.strictEqual(session?.status, 'CHALLENGE_REQUIRED');
    });

    // 2. Strong Face Verification -> FACE_VERIFIED -> Voice -> VOICE_VERIFIED
    await run("Face + Voice Evidence resolves CHALLENGE sequentially", async () => {
        // Clear session status back to CHALLENGE_REQUIRED
        await prisma.authSession.update({ where: { id: testSessionId }, data: { status: 'CHALLENGE_REQUIRED' } });

        const faceEvidence: NormalizedEvidence = {
            category: 'HUMAN',
            isContradictory: false,
            isSpoofed: false,
            source: 'Test', modality: 'FACE', status: 'PASS', confidence: 0.99, quality: 99,
            timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString(),
            modelVersion: '1', metadata: { liveness: true, antiSpoof: true }
        };

        const decision1 = await AdaptiveAuthenticationService.evaluateAuthenticationEvent(
            testUserId, testSessionId, 'CONTINUOUS', [faceEvidence], []
        );
        assert.strictEqual(decision1.action, 'REQUIRE_MFA');
        assert.strictEqual(decision1.nextSessionState, 'FACE_VERIFIED');

        const session1 = await prisma.authSession.findUnique({ where: { id: testSessionId }});
        assert.strictEqual(session1?.status, 'FACE_VERIFIED');

        const voiceEvidence: NormalizedEvidence = {
            category: 'HUMAN',
            isContradictory: false,
            isSpoofed: false,
            source: 'Test', modality: 'VOICE', status: 'PASS', confidence: 0.99, quality: 99,
            timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString(),
            modelVersion: '1', metadata: { liveness: true, antiSpoof: true }
        };

        const decision2 = await AdaptiveAuthenticationService.evaluateAuthenticationEvent(
            testUserId, testSessionId, 'CONTINUOUS', [voiceEvidence], []
        );
        assert.strictEqual(decision2.action, 'REQUIRE_MFA');
        assert.strictEqual(decision2.nextSessionState, 'VOICE_VERIFIED');

        const session2 = await prisma.authSession.findUnique({ where: { id: testSessionId }});
        assert.strictEqual(session2?.status, 'VOICE_VERIFIED');
    });

    // 3. High Risk during Active Session -> REQUIRE_MFA
    await run("High Risk anomaly triggers STEP_UP", async () => {
        // Make the session ACTIVE first
        await prisma.authSession.update({ where: { id: testSessionId }, data: { status: 'ACTIVE' } });

        const riskEvents = [{ type: 'SECURITY_EVENT' as const, severity: 70, timestamp: new Date(), description: 'Anomalous Location' }];
        const decision = await AdaptiveAuthenticationService.evaluateAuthenticationEvent(
            testUserId, testSessionId, 'CONTINUOUS', [], riskEvents
        );
        assert.strictEqual(decision.action, 'REQUIRE_MFA');
        assert.strictEqual(decision.nextSessionState, 'STEP_UP_REQUIRED');
        
        const session = await prisma.authSession.findUnique({ where: { id: testSessionId }});
        assert.strictEqual(session?.status, 'STEP_UP_REQUIRED');
    });

    console.log(`
=========================================`);
    console.log(`🏁 Integration Run Complete: ${passed} Passed, ${failed} Failed`);
    console.log(`=========================================`);
    if (failed > 0) {
        throw new Error(`Adaptive Auth tests failed with ${failed} errors`);
    }

    const { aiEventCoordinator } = require('../src/services/ai');
    await aiEventCoordinator.allTasksSettled();
}

if (typeof describe !== 'undefined') {
    describe('tests/adaptive-auth.test.ts Legacy Suite', () => {
        it('executes without crashing', async () => {
            await runIntegrationTests();
        }, 30000);
    });
} else {
    runIntegrationTests().catch(err => {
        console.error('Failed', err);
        throw err;
    });
}
