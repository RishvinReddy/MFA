import assert from 'assert';
import { FusionEngineService } from '../src/services/fusion.service';
import { RiskEngineService } from '../src/services/risk.service';
import { TrustEngineService } from '../src/services/trust.service';
import { PolicyEngineService } from '../src/services/policy.service';
import { NormalizedEvidence, IdentityEvidence } from '../src/types/evidence';
import { ConfigService } from '../src/services/config.service';
import prisma from '../src/prisma';

async function runTests() {
    console.log("=========================================");
    console.log("🚀 Running BioShield M2 Test Suite...");
    console.log("=========================================\\n");

    await ConfigService.getFusionConfig();

    // Create a dummy user to satisfy FK constraints in TrustEvent/AuditLog
    const testUserId = 'test-user-id-ms2';
    try {
        await prisma.user.upsert({
            where: { id: testUserId },
            update: {},
            create: { id: testUserId, email: 'test@example.com', passwordHash: 'hash' }
        });
    } catch (e) {
        console.warn("Could not create dummy user, FK errors might appear if DB is totally empty.");
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

    // SCENARIO 1: Password + strong face + low risk → TRUSTED → ALLOW
    await run("1. Password + strong face + low risk → TRUSTED → ALLOW", async () => {
        const faceEvidence: NormalizedEvidence = {
            category: 'HUMAN',
            isContradictory: false,
            isSpoofed: false,
            source: 'Test', modality: 'FACE', status: 'PASS', confidence: 0.95, quality: 90,
            timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString(),
            modelVersion: '1', metadata: { livenessScore: 0.9, antiSpoof: true }
        };
        const fusion = await FusionEngineService.evaluate([faceEvidence]);
        assert.ok(fusion.identityConfidence >= 0.85);
        const risk = RiskEngineService.evaluate([]);
        const trust = await TrustEngineService.evaluate({ fusion, risk, previousState: 'CHALLENGE', userId: testUserId, sessionId: 'test' });
        assert.strictEqual(trust.state, 'TRUSTED');
        const policy = PolicyEngineService.evaluate({ trustState: trust.state, riskLevel: risk.level, completedFactors: ['FACE'], failedFactors: [], availableFactors: ['FACE', 'VOICE'], authenticationStage: 'CONTINUOUS' });
        assert.strictEqual(policy.action, 'ALLOW');
    });

    // SCENARIO 2: Strong face + high contextual risk → REQUIRE_MFA
    await run("2. Strong face + high contextual risk → REQUIRE_MFA", async () => {
        const faceEvidence: NormalizedEvidence = {
            category: 'HUMAN',
            isContradictory: false,
            isSpoofed: false,
            source: 'Test', modality: 'FACE', status: 'PASS', confidence: 0.95, quality: 90,
            timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString(),
            modelVersion: '1', metadata: { livenessScore: 0.9, antiSpoof: true }
        };
        const fusion = await FusionEngineService.evaluate([faceEvidence]);
        const risk = RiskEngineService.evaluate([{ type: 'SECURITY_EVENT', severity: 70, timestamp: new Date(), description: 'Anomalous IP' }]);
        const trust = await TrustEngineService.evaluate({ fusion, risk, previousState: 'TRUSTED', userId: testUserId, sessionId: 'test' });
        assert.strictEqual(trust.state, 'RESTRICTED');
        const policy = PolicyEngineService.evaluate({ trustState: trust.state, riskLevel: risk.level, completedFactors: ['FACE'], failedFactors: [], availableFactors: ['FACE', 'VOICE'], authenticationStage: 'CONTINUOUS' });
        assert.strictEqual(policy.action, 'REQUIRE_MFA');
        assert.ok(policy.requiredFactors.includes('VOICE'));
    });

    // SCENARIO 3: Face unavailable → Fallback policy
    await run("3. Face unavailable → Fallback policy", async () => {
        const faceEvidence: NormalizedEvidence = {
            category: 'HUMAN',
            isContradictory: false,
            isSpoofed: false,
            source: 'Test', modality: 'FACE', status: 'UNAVAILABLE', confidence: 0, quality: 0,
            timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString(),
            modelVersion: '1', metadata: {}
        };
        const fusion = await FusionEngineService.evaluate([faceEvidence]);
        assert.strictEqual(fusion.identityConfidence, 0); // Excluded
        const policy = PolicyEngineService.evaluate({ trustState: 'CHALLENGE', riskLevel: 'LOW', completedFactors: [], failedFactors: [], availableFactors: ['FACE', 'VOICE'], authenticationStage: 'CONTINUOUS' });
        assert.strictEqual(policy.action, 'REQUIRE_MFA');
    });

    // SCENARIO 4: Face liveness fails → Face evidence rejected
    await run("4. Face liveness fails → Face evidence rejected", async () => {
        const faceEvidence: NormalizedEvidence = {
            category: 'HUMAN',
            isContradictory: false,
            isSpoofed: false,
            source: 'Test', modality: 'FACE', status: 'PASS', confidence: 0.95, quality: 90,
            timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString(),
            modelVersion: '1', metadata: { livenessScore: 0.1, antiSpoof: true }
        };
        const fusion = await FusionEngineService.evaluate([faceEvidence]);
        assert.strictEqual(fusion.identityConfidence, 0);
        assert.ok(fusion.evidenceRejected.find(e => e.modality === 'FACE'));
    });

    // SCENARIO 5: Voice heuristic fails → Voice evidence rejected
    await run("5. Voice heuristic fails → Voice evidence rejected", async () => {
        const voiceEvidence: NormalizedEvidence = {
            category: 'HUMAN',
            isContradictory: false,
            isSpoofed: false,
            source: 'Test', modality: 'VOICE', status: 'FAIL', confidence: 0.2, quality: 90,
            timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString(),
            modelVersion: '1', metadata: { livenessScore: 0.9, antiSpoof: false }
        };
        const fusion = await FusionEngineService.evaluate([voiceEvidence]);
        assert.strictEqual(fusion.identityConfidence, 0);
        assert.ok(fusion.evidenceRejected.find(e => e.modality === 'VOICE'));
    });

    // SCENARIO 6: Both biometrics unavailable → Explicit fallback/deny policy
    await run("6. Both biometrics unavailable → Explicit fallback/deny policy", async () => {
        const policy = PolicyEngineService.evaluate({ trustState: 'CHALLENGE', riskLevel: 'LOW', completedFactors: [], failedFactors: ['FACE', 'VOICE'], availableFactors: ['FACE', 'VOICE'], authenticationStage: 'CONTINUOUS' });
        assert.strictEqual(policy.action, 'RESTRICT');
    });

    // SCENARIO 7: Medium identity confidence → CHALLENGE
    await run("7. Medium identity confidence → CHALLENGE", async () => {
        const faceEvidence: NormalizedEvidence = {
            category: 'HUMAN',
            isContradictory: false,
            isSpoofed: false,
            source: 'Test', modality: 'FACE', status: 'PASS', confidence: 0.45, quality: 80, // Calibrates to 0.675 -> Drops OBSERVE to CHALLENGE
            timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString(),
            modelVersion: '1', metadata: { livenessScore: 0.9, antiSpoof: true }
        };
        const fusion = await FusionEngineService.evaluate([faceEvidence]);
        const risk = RiskEngineService.evaluate([]);
        const trust = await TrustEngineService.evaluate({ fusion, risk, previousState: 'OBSERVE', userId: testUserId, sessionId: 'test' });
        assert.strictEqual(trust.state, 'CHALLENGE');
    });

    // SCENARIO 8: Critical system risk → LOCKED
    await run("8. Critical system risk → LOCKED regardless of biometric score", async () => {
        const faceEvidence: NormalizedEvidence = {
            category: 'HUMAN',
            isContradictory: false,
            isSpoofed: false,
            source: 'Test', modality: 'FACE', status: 'PASS', confidence: 0.99, quality: 99,
            timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString(),
            modelVersion: '1', metadata: { livenessScore: 0.9, antiSpoof: true }
        };
        const fusion = await FusionEngineService.evaluate([faceEvidence]);
        const risk = RiskEngineService.evaluate([{ type: 'SECURITY_EVENT', severity: 95, timestamp: new Date(), description: 'DURESS' }]);
        assert.strictEqual(risk.level, 'CRITICAL');
        const trust = await TrustEngineService.evaluate({ fusion, risk, previousState: 'TRUSTED', userId: testUserId, sessionId: 'test' });
        assert.strictEqual(trust.state, 'LOCKED');
    });

    // SCENARIO 9: Expired biometric evidence → Excluded
    await run("9. Expired biometric evidence → Excluded", async () => {
        const faceEvidence: NormalizedEvidence = {
            category: 'HUMAN',
            isContradictory: false,
            isSpoofed: false,
            source: 'Test', modality: 'FACE', status: 'PASS', confidence: 0.99, quality: 99,
            timestamp: new Date(Date.now() - 100000).toISOString(), expiresAt: new Date(Date.now() - 1000).toISOString(),
            modelVersion: '1', metadata: { livenessScore: 0.9, antiSpoof: true }
        };
        const fusion = await FusionEngineService.evaluate([faceEvidence]);
        assert.strictEqual(fusion.identityConfidence, 0);
    });

    // SCENARIO 10: Malformed evidence → ERROR
    await run("10. Malformed evidence → ERROR", async () => {
        const malformed: NormalizedEvidence = {
            category: 'HUMAN',
            isContradictory: false,
            isSpoofed: false,
            source: 'Test', modality: 'FACE', status: 'ERROR', confidence: 0.99, quality: 99,
            timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 6000).toISOString(),
            modelVersion: '1', metadata: {}
        };
        const fusion = await FusionEngineService.evaluate([malformed]);
        assert.strictEqual(fusion.identityConfidence, 0);
    });

    // SCENARIO 11: Successful step-up → Trust recalculated
    await run("11. Successful step-up → Trust recalculated", async () => {
        const face: NormalizedEvidence = {
            category: 'HUMAN',
            isContradictory: false,
            isSpoofed: false, source: 'Test', modality: 'FACE', status: 'PASS', confidence: 0.99, quality: 99, timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 6000).toISOString(), modelVersion: '1', metadata: { livenessScore: 0.9, antiSpoof: true }};
        const voice: NormalizedEvidence = {
            category: 'HUMAN',
            isContradictory: false,
            isSpoofed: false, source: 'Test', modality: 'VOICE', status: 'PASS', confidence: 0.99, quality: 99, timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 6000).toISOString(), modelVersion: '1', metadata: { livenessScore: 0.9, antiSpoof: true }};
        const fusion = await FusionEngineService.evaluate([face, voice]);
        const risk = RiskEngineService.evaluate([]);
        const trust = await TrustEngineService.evaluate({ fusion, risk, previousState: 'CHALLENGE', userId: testUserId, sessionId: 'test' });
        assert.strictEqual(trust.state, 'TRUSTED');
    });

    // SCENARIO 12: Failed step-up → Restrict
    await run("12. Failed step-up → Restrict", async () => {
        const policy = PolicyEngineService.evaluate({ trustState: 'CHALLENGE', riskLevel: 'LOW', completedFactors: ['FACE'], failedFactors: ['VOICE'], availableFactors: ['FACE', 'VOICE'], authenticationStage: 'CONTINUOUS' });
        assert.strictEqual(policy.action, 'RESTRICT');
    });

    // SCENARIO 14: Low-quality high-match face → Must not automatically become strong evidence
    await run("14. Low-quality high-match face → Rejected", async () => {
        const face: NormalizedEvidence = {
            category: 'HUMAN',
            isContradictory: false,
            isSpoofed: false, source: 'Test', modality: 'FACE', status: 'PASS', confidence: 0.99, quality: 20, timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 6000).toISOString(), modelVersion: '1', metadata: { livenessScore: 0.9, antiSpoof: true }};
        const fusion = await FusionEngineService.evaluate([face]);
        assert.strictEqual(fusion.identityConfidence, 0);
    });

    // SCENARIO 16: Voice unavailable after face failure → Explicit fallback
    await run("16. Voice unavailable after face failure", async () => {
        const policy = PolicyEngineService.evaluate({ trustState: 'CHALLENGE', riskLevel: 'LOW', completedFactors: [], failedFactors: ['FACE'], availableFactors: ['FACE'], authenticationStage: 'CONTINUOUS' });
        assert.strictEqual(policy.action, 'RESTRICT');
    });

    // SCENARIO 24: Fusion configuration version included
    await run("24. Fusion configuration version included", async () => {
        const face: NormalizedEvidence = {
            category: 'HUMAN',
            isContradictory: false,
            isSpoofed: false, source: 'Test', modality: 'FACE', status: 'PASS', confidence: 0.99, quality: 99, timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 6000).toISOString(), modelVersion: '1', metadata: { livenessScore: 0.9, antiSpoof: true }};
        const fusion = await FusionEngineService.evaluate([face]);
        assert.ok(fusion.configurationVersion > 0);
    });

    // SCENARIO 26: Risk drops after sufficient time
    await run("26. Risk drops after sufficient time", async () => {
        const risk = RiskEngineService.evaluate([{ type: 'AUTH_FAILURE', severity: 100, timestamp: new Date(Date.now() - 10 * 60 * 60 * 1000), description: 'Old fail' }]);
        assert.strictEqual(risk.score, 0);
    });

    console.log(`
=========================================`);
    console.log(`🏁 Test Run Complete: ${passed} Passed, ${failed} Failed`);
    console.log(`=========================================`);
    if (failed > 0) {
        throw new Error(`Tests failed with ${failed} errors`);
    }
}

if (typeof describe !== 'undefined') {
    describe('tests/milestone2.test.ts Legacy Suite', () => {
        it('executes without crashing', async () => {
            await runTests();
        }, 30000);
    });
} else {
    runTests().catch(err => {
        console.error('Failed', err);
        throw err;
    });
}
