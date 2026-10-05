import assert from 'assert';
import request from 'supertest';
import app from '../src/index';
import prisma from '../src/prisma';
import { generateToken } from '../src/authUtils';

async function runPhase5Tests() {
    console.log("=========================================");
    console.log("🛡️ Running Phase 5 Workstation Security Verification Tests...");
    console.log("=========================================\n");

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

    const email = `phase5-test-${Date.now()}@example.com`;
    const user = await prisma.user.create({
        data: {
            email,
            passwordHash: "$argon2id$v=19$m=65536,t=3,p=1$dummy$dummy",
            fullName: "Phase 5 Test User",
            role: "ADMIN",
            status: "ACTIVE"
        }
    });

    // Create biometric profile so step-up factors are available
    await prisma.biometricProfile.create({
        data: {
            userId: user.id,
            faceTemplate: "mock_face_embedding_data",
            voiceTemplate: "mock_voice_embedding_data"
        }
    });

    const createSession = async () => {
        return await prisma.authSession.create({
            data: {
                userId: user.id,
                ipAddress: "127.0.0.1",
                device: "test-device",
                status: "ACTIVE",
                isActive: true,
                isSuccessful: true,
                trustState: "TRUSTED"
            }
        });
    };

    // Test 1: Vault without JWT token
    await run("1. Vault access without JWT fails with 401/403", async () => {
        const res = await request(app).post('/api/vault/decrypt').send({ documentId: "test-doc" });
        assert.ok(res.status === 401 || res.status === 403);
    });

    // Test 2: Vault with invalid/terminated session
    await run("2. Vault access with terminated session fails", async () => {
        const session = await prisma.authSession.create({
            data: { userId: user.id, status: 'TERMINATED', isActive: false, ipAddress: "127.0.0.1", device: "test", isSuccessful: true, trustState: 'TRUSTED' }
        });
        const token = generateToken({ id: user.id, email: user.email, role: user.role, sessionId: session.id } as any);
        const res = await request(app).post('/api/vault/decrypt')
            .set('Authorization', `Bearer ${token}`)
            .set('x-session-id', session.id)
            .send({ documentId: "test-doc" });
        assert.ok(res.status === 401 || res.status === 403);
    });

    // Test 3: Vault with ACTIVE + ALLOW
    await run("3. Vault access with ACTIVE + ALLOW succeeds", async () => {
        const session = await createSession();
        const token = generateToken({ id: user.id, email: user.email, role: user.role, sessionId: session.id } as any);
        
        // Mock AdaptiveAuthenticationService to return ALLOW
        // Since we can't easily mock in an E2E without Jest, we rely on the actual implementation
        // A fresh session with "TRUSTED" state should return ALLOW.
        const res = await request(app).post('/api/vault/decrypt')
            .set('Authorization', `Bearer ${token}`)
            .set('x-session-id', session.id)
            .send({ documentId: "test-doc" });
            
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
    });

    // Test 4: Vault with STEP_UP_REQUIRED
    await run("4. Vault access when TrustState is OBSERVE (stale session) triggers STEP_UP_REQUIRED", async () => {
        const session = await createSession();
        const token = generateToken({ id: user.id, email: user.email, role: user.role, sessionId: session.id } as any);
        
        // Update session to trigger STEP_UP_REQUIRED (updatedAt < 75s ago)
        await prisma.authSession.update({
            where: { id: session.id },
            data: { updatedAt: new Date(Date.now() - 80 * 1000) }
        });

        const res = await request(app).post('/api/vault/decrypt')
            .set('Authorization', `Bearer ${token}`)
            .set('x-session-id', session.id)
            .send({ documentId: "test-doc" });

        assert.strictEqual(res.status, 403);
        assert.strictEqual(res.body.action, 'STEP_UP_REQUIRED');
    });

    // Test 5: Vault with RESTRICT
    await run("5. Vault access when Risk is HIGH and no factors available triggers RESTRICT", async () => {
        const session = await createSession();
        const token = generateToken({ id: user.id, email: user.email, role: user.role, sessionId: session.id } as any);
        
        // Temporarily delete biometric profile so no factors are available
        await prisma.biometricProfile.delete({ where: { userId: user.id } });

        // Update session to HIGH risk
        await prisma.authSession.update({
            where: { id: session.id },
            data: { riskLevel: 'HIGH', trustState: 'RESTRICTED' }
        });

        const res = await request(app).post('/api/vault/decrypt')
            .set('Authorization', `Bearer ${token}`)
            .set('x-session-id', session.id)
            .send({ documentId: "test-doc" });

        assert.strictEqual(res.status, 403);
        assert.strictEqual(res.body.action, 'RESTRICT');
        
        // Restore biometric profile for next test
        await prisma.biometricProfile.create({
            data: {
                userId: user.id,
                faceTemplate: "mock_face_embedding_data",
                voiceTemplate: "mock_voice_embedding_data"
            }
        });
    });

    // Test 6: Vault with LOCK
    await run("6. Vault access when Abandoned triggers LOCK", async () => {
        const session = await createSession();
        const token = generateToken({ id: user.id, email: user.email, role: user.role, sessionId: session.id } as any);
        
        // Update session to locked state (updatedAt < 150s)
        await prisma.authSession.update({
            where: { id: session.id },
            data: { updatedAt: new Date(Date.now() - 160 * 1000) }
        });

        const res = await request(app).post('/api/vault/decrypt')
            .set('Authorization', `Bearer ${token}`)
            .set('x-session-id', session.id)
            .send({ documentId: "test-doc" });

        assert.strictEqual(res.status, 403);
        assert.strictEqual(res.body.action, 'LOCK');
    });

    // Clean up
    await prisma.trustEvent.deleteMany({ where: { userId: user.id } });
    await prisma.auditLog.deleteMany({ where: { userId: user.id } });
    await prisma.authSession.deleteMany({ where: { userId: user.id } });
    await prisma.biometricProfile.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });

    console.log(`\n=========================================`);
    console.log(`🏁 Phase 5 Integration complete: ${passed} Passed, ${failed} Failed`);
    console.log(`=========================================`);
    if (failed > 0) {
        throw new Error(`Tests failed with ${failed} errors`);
    }
}

if (typeof describe !== 'undefined') {
    describe('tests/phase5.test.ts Legacy Suite', () => {
        it('executes without crashing', async () => {
            await runPhase5Tests();
        }, 30000);
    });
} else {
    runPhase5Tests().catch(err => {
        console.error('Failed', err);
        throw err;
    });
}
