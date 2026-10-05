import assert from 'assert';
import request from 'supertest';
import app from '../src/index';
import prisma from '../src/prisma';
import { generateToken } from '../src/authUtils';
import { BiometricService } from '../src/services/biometric.service';
import { CryptoService } from '../src/services/crypto.service';
import fs from 'fs';
import path from 'path';

async function runContinuousAuthTests() {
    console.log("=========================================");
    console.log("🛡️ Running Continuous Authentication Integration Tests...");
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

    const email = `continuous-test-${Date.now()}@example.com`;
    const user = await prisma.user.create({
        data: {
            email,
            passwordHash: "$argon2id$v=19$m=65536,t=3,p=1$dummy$dummy",
            fullName: "Continuous Test User",
            role: "USER",
            status: "ACTIVE"
        }
    });

    const enrolledEmbedding = Array(512).fill(0.1);
    const faceTemplate = CryptoService.encryptTemplate(JSON.stringify(enrolledEmbedding));

    // Create biometric profile so step-up factors are available
    await prisma.biometricProfile.create({
        data: {
            userId: user.id,
            faceTemplate,
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

    // Test 1: Valid active session heartbeat succeeds
    await run("1. Valid active session heartbeat returns ACTIVE status", async () => {
        const session = await createSession();
        const token = generateToken({ id: user.id, email: user.email, role: user.role, sessionId: session.id } as any);

        const res = await request(app)
            .post('/api/auth/continuous-verify')
            .set('Authorization', `Bearer ${token}`)
            .set('x-session-id', session.id)
            .send({
                timestamp: new Date().toISOString(),
                presence: { faceDetected: true }
            });

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.sessionStatus, 'ACTIVE');
    });

    // Test 2: Unauthenticated request rejected (401/403)
    await run("2. Unauthenticated heartbeat request is rejected", async () => {
        const res = await request(app)
            .post('/api/auth/continuous-verify')
            .send({});

        assert.ok(res.status === 401 || res.status === 403);
    });

    // Test 3: Stale heartbeat (elapsed > 75s) triggers STEP_UP_REQUIRED
    await run("3. Stale heartbeat (80s delay) triggers STEP_UP_REQUIRED", async () => {
        const session = await createSession();
        const token = generateToken({ id: user.id, email: user.email, role: user.role, sessionId: session.id } as any);

        // Set updatedAt back by 80 seconds
        await prisma.authSession.update({
            where: { id: session.id },
            data: { updatedAt: new Date(Date.now() - 80 * 1000) }
        });

        const res = await request(app)
            .post('/api/auth/continuous-verify')
            .set('Authorization', `Bearer ${token}`)
            .set('x-session-id', session.id)
            .send({
                timestamp: new Date().toISOString(),
                presence: { faceDetected: true }
            });

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.sessionStatus, 'STEP_UP_REQUIRED');
        assert.strictEqual(res.body.action, 'REQUIRE_MFA');
    });

    // Test 4: Abandoned heartbeat (elapsed > 150s) triggers LOCKED
    await run("4. Abandoned heartbeat (160s delay) triggers LOCKED status", async () => {
        const session = await createSession();
        const token = generateToken({ id: user.id, email: user.email, role: user.role, sessionId: session.id } as any);

        // Set updatedAt back by 160 seconds
        await prisma.authSession.update({
            where: { id: session.id },
            data: { updatedAt: new Date(Date.now() - 160 * 1000) }
        });

        const res = await request(app)
            .post('/api/auth/continuous-verify')
            .set('Authorization', `Bearer ${token}`)
            .set('x-session-id', session.id)
            .send({
                timestamp: new Date().toISOString(),
                presence: { faceDetected: true }
            });

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.sessionStatus, 'LOCKED');
        assert.strictEqual(res.body.action, 'LOCK');
    });

    // Create dummy face file for multer upload
    const dummyFilePath = path.join(__dirname, 'temp_face_continuous.jpg');
    fs.writeFileSync(dummyFilePath, 'dummy jpeg data');

    // Test 5: Active session heartbeat with User A's face frame returns ACTIVE status
    await run("5. Active session heartbeat with User A's face frame returns ACTIVE status", async () => {
        const session = await createSession();
        const token = generateToken({ id: user.id, email: user.email, role: user.role, sessionId: session.id } as any);

        const originalExtractFace = BiometricService.extractFace;
        BiometricService.extractFace = async () => ({
            source: 'BiometricService',
            category: 'HUMAN',
            modality: 'FACE',
            status: 'PASS',
            confidence: 0.99,
            quality: 90,
            timestamp: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 300000).toISOString(),
            isContradictory: false,
            isSpoofed: false,
            modelVersion: '1.2.0',
            metadata: {
                liveness: true,
                antiSpoof: true,
                challengePassed: true,
                rawEmbedding: Array(512).fill(0.1) // User A matches
            }
        });

        try {
            const res = await request(app)
                .post('/api/auth/continuous-verify')
                .set('Authorization', `Bearer ${token}`)
                .set('x-session-id', session.id)
                .attach('face', dummyFilePath);

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.sessionStatus, 'ACTIVE');
        } finally {
            BiometricService.extractFace = originalExtractFace;
        }
    });

    // Test 6: Active session heartbeat with incorrect face frame returns CONFLICT / CHALLENGE_REQUIRED
    await run("6. Active session heartbeat with incorrect face frame returns CONFLICT / CHALLENGE_REQUIRED", async () => {
        const session = await createSession();
        const token = generateToken({ id: user.id, email: user.email, role: user.role, sessionId: session.id } as any);

        const originalExtractFace = BiometricService.extractFace;
        BiometricService.extractFace = async () => ({
            source: 'BiometricService',
            category: 'HUMAN',
            modality: 'FACE',
            status: 'PASS',
            confidence: 0.99,
            quality: 90,
            timestamp: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 300000).toISOString(),
            isContradictory: false,
            isSpoofed: false,
            modelVersion: '1.2.0',
            metadata: {
                liveness: true,
                antiSpoof: true,
                challengePassed: true,
                rawEmbedding: Array(512).fill(0.1).map((_, i) => i % 2 === 0 ? 0.1 : -0.1) // Mismatch
            }
        });

        try {
            const res = await request(app)
                .post('/api/auth/continuous-verify')
                .set('Authorization', `Bearer ${token}`)
                .set('x-session-id', session.id)
                .attach('face', dummyFilePath);

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.sessionStatus, 'CHALLENGE_REQUIRED');
            assert.strictEqual(res.body.action, 'REQUIRE_MFA');
        } finally {
            BiometricService.extractFace = originalExtractFace;
        }
    });

    // Test 7: Active session heartbeat with missing face (insufficient data) returns CHALLENGE_REQUIRED
    await run("7. Active session heartbeat with missing face (insufficient data) returns CHALLENGE_REQUIRED", async () => {
        const session = await createSession();
        const token = generateToken({ id: user.id, email: user.email, role: user.role, sessionId: session.id } as any);

        const originalExtractFace = BiometricService.extractFace;
        BiometricService.extractFace = async () => ({
            source: 'BiometricService',
            category: 'HUMAN',
            modality: 'FACE',
            status: 'INSUFFICIENT_DATA',
            confidence: 0,
            quality: 0,
            timestamp: new Date().toISOString(),
            expiresAt: new Date().toISOString(),
            isContradictory: false,
            isSpoofed: false,
            modelVersion: '1.2.0',
            metadata: {}
        });

        try {
            const res = await request(app)
                .post('/api/auth/continuous-verify')
                .set('Authorization', `Bearer ${token}`)
                .set('x-session-id', session.id)
                .attach('face', dummyFilePath);

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.sessionStatus, 'CHALLENGE_REQUIRED');
            assert.strictEqual(res.body.action, 'REQUIRE_MFA');
        } finally {
            BiometricService.extractFace = originalExtractFace;
        }
    });

    // Test 8: Active session heartbeat with spoofed face returns RESTRICT / RESTRICTED
    await run("8. Active session heartbeat with spoofed face returns RESTRICT / RESTRICTED", async () => {
        const session = await createSession();
        const token = generateToken({ id: user.id, email: user.email, role: user.role, sessionId: session.id } as any);

        const originalExtractFace = BiometricService.extractFace;
        BiometricService.extractFace = async () => ({
            source: 'BiometricService',
            category: 'HUMAN',
            modality: 'FACE',
            status: 'FAIL',
            confidence: 0,
            quality: 0,
            timestamp: new Date().toISOString(),
            expiresAt: new Date().toISOString(),
            isContradictory: false,
            isSpoofed: true,
            modelVersion: '1.2.0',
            metadata: { liveness: false, antiSpoof: false }
        });

        try {
            const res = await request(app)
                .post('/api/auth/continuous-verify')
                .set('Authorization', `Bearer ${token}`)
                .set('x-session-id', session.id)
                .attach('face', dummyFilePath);

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.sessionStatus, 'RESTRICTED');
            assert.strictEqual(res.body.action, 'RESTRICT');
        } finally {
            BiometricService.extractFace = originalExtractFace;
        }
    });

    // Clean up
    if (fs.existsSync(dummyFilePath)) {
        fs.unlinkSync(dummyFilePath);
    }

    await prisma.trustEvent.deleteMany({ where: { userId: user.id } });
    await prisma.auditLog.deleteMany({ where: { userId: user.id } });
    await prisma.authSession.deleteMany({ where: { userId: user.id } });
    await prisma.biometricProfile.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });

    console.log(`\n=========================================`);
    console.log(`🏁 Continuous Authentication Integration complete: ${passed} Passed, ${failed} Failed`);
    console.log(`=========================================`);
    if (failed > 0) {
        throw new Error(`Tests failed with ${failed} errors`);
    }
}

if (typeof describe !== 'undefined') {
    describe('tests/continuous-auth.test.ts Legacy Suite', () => {
        it('executes without crashing', async () => {
            await runContinuousAuthTests();
        }, 30000);
    });
} else {
    runContinuousAuthTests().catch(err => {
        console.error('Failed', err);
        throw err;
    });
}
