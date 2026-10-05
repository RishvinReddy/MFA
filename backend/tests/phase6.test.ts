import assert from 'assert';
import request from 'supertest';
import app from '../src/index';
import prisma from '../src/prisma';
import { generateToken } from '../src/authUtils';

async function runPhase6Tests() {
    console.log("=========================================");
    console.log("🛡️ Running Phase 6 Security Operations Center Verification Tests...");
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

    // Setup Admin and User
    const adminEmail = `admin-${Date.now()}@example.com`;
    const userEmail = `user-${Date.now()}@example.com`;
    
    const adminUser = await prisma.user.create({
        data: {
            email: adminEmail,
            passwordHash: "$argon2id$v=19$m=65536,t=3,p=1$dummy$dummy",
            fullName: "Admin SOC",
            role: "ADMIN",
            status: "ACTIVE"
        }
    });

    await prisma.biometricProfile.create({
        data: {
            userId: adminUser.id,
            faceTemplate: "mock_face_embedding_data",
            voiceTemplate: "mock_voice_embedding_data"
        }
    });

    const standardUser = await prisma.user.create({
        data: {
            email: userEmail,
            passwordHash: "$argon2id$v=19$m=65536,t=3,p=1$dummy$dummy",
            fullName: "Standard User",
            role: "USER",
            status: "ACTIVE"
        }
    });

    const createSession = async (userId: string, role: string) => {
        const session = await prisma.authSession.create({
            data: {
                userId,
                ipAddress: "127.0.0.1",
                device: "test-device",
                status: "ACTIVE",
                isActive: true,
                isSuccessful: true,
                trustState: "TRUSTED"
            }
        });
        const token = generateToken({ id: userId, email: role === "ADMIN" ? adminEmail : userEmail, role, sessionId: session.id } as any);
        return { session, token };
    };

    // Test 1: Authorization
    await run("1. SOC endpoints restricted to ADMIN role", async () => {
        const { token, session } = await createSession(standardUser.id, "USER");
        const res = await request(app).get('/api/admin/overview')
            .set('Authorization', `Bearer ${token}`)
            .set('x-session-id', session.id);
        
        assert.ok(res.status === 403 || res.status === 401);
    });

    await run("2. SOC endpoints accessible to ADMIN role", async () => {
        const { token, session } = await createSession(adminUser.id, "ADMIN");
        const res = await request(app).get('/api/admin/overview')
            .set('Authorization', `Bearer ${token}`)
            .set('x-session-id', session.id);
        
        assert.strictEqual(res.status, 200);
        assert.ok(res.body.hasOwnProperty('totalUsers'));
    });

    // Test 3: Unauthenticated
    await run("3. SOC endpoints block unauthenticated requests", async () => {
        const res = await request(app).get('/api/admin/overview');
        assert.ok(res.status === 401 || res.status === 403);
    });

    // Test 4: Terminated session
    await run("4. Terminated admin session cannot access SOC", async () => {
        const { token, session } = await createSession(adminUser.id, "ADMIN");
        await prisma.authSession.update({ where: { id: session.id }, data: { status: 'TERMINATED', isActive: false } });

        const res = await request(app).get('/api/admin/overview')
            .set('Authorization', `Bearer ${token}`)
            .set('x-session-id', session.id);
        
        assert.ok(res.status === 401 || res.status === 403);
    });

    // Test 5: Locked session cannot perform privileged operations
    await run("5. Locked admin session cannot perform privileged operations", async () => {
        const { token, session } = await createSession(adminUser.id, "ADMIN");
        // Simulate stale heartbeat to trigger LOCK
        await prisma.authSession.update({ where: { id: session.id }, data: { updatedAt: new Date(Date.now() - 150000) } });

        const res = await request(app).post(`/api/admin/user/${standardUser.id}/force-logout`)
            .set('Authorization', `Bearer ${token}`)
            .set('x-session-id', session.id);
        
        assert.strictEqual(res.status, 403);
        assert.strictEqual(res.body.action, 'LOCK');
    });

    // Test 6: Risk enforcement - REQUIRE_MFA triggers step-up
    await run("6. Administrative operation with OBSERVE (stale heartbeat) triggers STEP_UP_REQUIRED", async () => {
        const { token, session } = await createSession(adminUser.id, "ADMIN");
        // Update session to trigger STEP_UP_REQUIRED (updatedAt < 75s ago)
        await prisma.authSession.update({ where: { id: session.id }, data: { updatedAt: new Date(Date.now() - 80000) } });

        const res = await request(app).post(`/api/admin/user/${standardUser.id}/force-logout`)
            .set('Authorization', `Bearer ${token}`)
            .set('x-session-id', session.id);
        
        assert.strictEqual(res.status, 403);
        assert.strictEqual(res.body.action, 'STEP_UP_REQUIRED');
    });

    // Test 7: Real backend telemetry
    await run("7. Active sessions return real backend data", async () => {
        const { token, session } = await createSession(adminUser.id, "ADMIN");
        const res = await request(app).get('/api/admin/sessions')
            .set('Authorization', `Bearer ${token}`)
            .set('x-session-id', session.id);
        
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.ok(Array.isArray(res.body.data));
        const found = res.body.data.find((s: any) => s.id === session.id);
        assert.ok(found, "Admin session should be in the list");
        assert.strictEqual(found.trustState, "TRUSTED");
    });

    // Test 8: Disable user
    await run("8. Administrator can disable a user", async () => {
        const { token, session } = await createSession(adminUser.id, "ADMIN");
        const res = await request(app).patch(`/api/admin/user/${standardUser.id}/disable`)
            .set('Authorization', `Bearer ${token}`)
            .set('x-session-id', session.id)
            .send({ isActive: false });
        
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);

        const updatedUser = await prisma.user.findUnique({ where: { id: standardUser.id } });
        assert.strictEqual(updatedUser?.status, 'DISABLED');
    });

    // Clean up
    await prisma.trustEvent.deleteMany({ where: { userId: { in: [adminUser.id, standardUser.id] } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: [adminUser.id, standardUser.id] } } });
    await prisma.authSession.deleteMany({ where: { userId: { in: [adminUser.id, standardUser.id] } } });
    await prisma.biometricProfile.deleteMany({ where: { userId: { in: [adminUser.id, standardUser.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [adminUser.id, standardUser.id] } } });

    console.log(`\n=========================================`);
    console.log(`🏁 Phase 6 Integration complete: ${passed} Passed, ${failed} Failed`);
    console.log(`=========================================`);
    if (failed > 0) {
        throw new Error(`Tests failed with ${failed} errors`);
    }
}

if (typeof describe !== 'undefined') {
    describe('tests/phase6.test.ts Legacy Suite', () => {
        it('executes without crashing', async () => {
            await runPhase6Tests();
        }, 30000);
    });
} else {
    runPhase6Tests().catch(err => {
        console.error('Failed', err);
        throw err;
    });
}
