import assert from 'assert';
import request from 'supertest';
import app from '../src/index';
import prisma from '../src/prisma';
import { CryptoService } from '../src/services/crypto.service';
import { BiometricService } from '../src/services/biometric.service';
import sinon from 'sinon';
import speakeasy from 'speakeasy';

async function runPhase1Tests() {
    console.log("=========================================");
    console.log("🛡️ Running Phase 1 E2E Integration Tests...");
    console.log("=========================================\n");

    const email = `phase1-test-${Date.now()}@example.com`;
    const password = 'SecurePassword123!';
    const fullName = 'Test Phase 1 User';

    let userId = '';
    let sessionId = '';
    let totpSecret = '';
    let accessToken = '';

    // Mock biometric engine to always return success
    sinon.stub(BiometricService, 'extractFace').callsFake(async (filePath: string) => {
        return {
            source: 'BiometricService',
            category: 'HUMAN', isContradictory: false, isSpoofed: false, modality: 'FACE',
            status: 'PASS',
            confidence: 0.99,
            quality: 90,
            timestamp: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 5 * 60000).toISOString(),
            modelVersion: '1.2.0',
            metadata: { liveness: true, antiSpoof: true, challengePassed: true, rawEmbedding: Array(512).fill(0.1) }
        };
    });

    sinon.stub(BiometricService, 'extractVoice').callsFake(async (filePath: string, isEnrollment?: boolean) => {
        return {
            source: 'BiometricService',
            category: 'HUMAN', isContradictory: false, isSpoofed: false, modality: 'VOICE',
            status: 'PASS',
            confidence: 0.95,
            quality: 90,
            timestamp: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 5 * 60000).toISOString(),
            modelVersion: '1.2.0',
            metadata: { liveness: true, antiSpoof: true, challengePassed: true, rawText: "test phrase", normalizedText: "test phrase" }
        };
    });

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

    // Step 0: Registration
    await run("0. User Registration & Enrollment State Check", async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ email, password, fullName });

        assert.strictEqual(res.status, 201);
        assert.ok(res.body.userId);
        assert.ok(res.body.enrollmentToken);
        userId = res.body.userId;

        // Retrieve TOTP secret from DB
        const totpRecord = await prisma.totpSecret.findUnique({ where: { userId } });
        assert.ok(totpRecord);
        totpSecret = totpRecord.secret;

        // Assert EnrollmentState has passwordEnrolled = true
        const enrollmentState = await prisma.enrollmentState.findUnique({ where: { userId } });
        assert.ok(enrollmentState);
        assert.strictEqual(enrollmentState.passwordEnrolled, true);

        // Bootstrap biometric profiles so login is permitted
        await prisma.biometricProfile.create({
            data: {
                userId,
                faceTemplate: CryptoService.encryptTemplate(JSON.stringify(Array(512).fill(0.1))),
                voiceTemplate: 'mock-voice-template'
            }
        });

        // Set user status to ACTIVE to simulate completed enrollment
        await prisma.user.update({
            where: { id: userId },
            data: { status: 'ACTIVE' }
        });
    });

    // Test 1: Password
    await run("1. Credentials Login creates CHALLENGE_REQUIRED session", async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email, password });

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.requiresMfa, true);
        assert.ok(res.body.sessionId);
        sessionId = res.body.sessionId;

        const session = await prisma.authSession.findUnique({ where: { id: sessionId } });
        assert.ok(session);
        assert.strictEqual(session.status, 'CHALLENGE_REQUIRED');
        assert.strictEqual(session.isSuccessful, false);
        assert.strictEqual(session.isActive, true);
    });

    // Test 2: Face
    await run("2. Face Biometric verification transitions to FACE_VERIFIED, issues no JWT", async () => {
        const res = await request(app)
            .post('/api/biometric/verify')
            .set('x-session-id', sessionId)
            .attach('face', Buffer.from('dummy-face'), 'face.jpg');

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.factor, 'FACE');
        assert.strictEqual(res.body.status, 'FACE_VERIFIED');
        assert.strictEqual(res.body.next, 'VOICE');
        assert.strictEqual(res.body.token, undefined);

        const session = await prisma.authSession.findUnique({ where: { id: sessionId } });
        assert.strictEqual(session?.status, 'FACE_VERIFIED');
    });

    // Test 3: Voice
    await run("3. Voice Biometric verification transitions to VOICE_VERIFIED, issues no JWT", async () => {
        const res = await request(app)
            .post('/api/biometric/verify')
            .set('x-session-id', sessionId)
            .attach('voice', Buffer.from('dummy-voice'), 'voice.wav');

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.factor, 'VOICE');
        assert.strictEqual(res.body.status, 'VOICE_VERIFIED');
        assert.strictEqual(res.body.next, 'MFA');
        assert.strictEqual(res.body.token, undefined);

        const session = await prisma.authSession.findUnique({ where: { id: sessionId } });
        assert.strictEqual(session?.status, 'VOICE_VERIFIED');
    });

    // Test 4: MFA bypass attempt (CHALLENGE_REQUIRED)
    await run("4. MFA verification on CHALLENGE_REQUIRED session must be rejected (403)", async () => {
        // Create an alternative session in CHALLENGE_REQUIRED
        const dummySession = await prisma.authSession.create({
            data: {
                userId,
                ipAddress: '127.0.0.1',
                device: 'test',
                status: 'CHALLENGE_REQUIRED'
            }
        });

        const token = speakeasy.totp({ secret: totpSecret, encoding: 'base32' });
        const res = await request(app)
            .post('/api/mfa/totp/verify-login')
            .set('x-session-id', dummySession.id)
            .send({ userId, token });

        assert.strictEqual(res.status, 403);
    });

    // Test 5: MFA after face only (FACE_VERIFIED)
    await run("5. MFA verification on FACE_VERIFIED session must be rejected (403)", async () => {
        // Create an alternative session in FACE_VERIFIED
        const dummySession = await prisma.authSession.create({
            data: {
                userId,
                ipAddress: '127.0.0.1',
                device: 'test',
                status: 'FACE_VERIFIED'
            }
        });

        const token = speakeasy.totp({ secret: totpSecret, encoding: 'base32' });
        const res = await request(app)
            .post('/api/mfa/totp/verify-login')
            .set('x-session-id', dummySession.id)
            .send({ userId, token });

        assert.strictEqual(res.status, 403);
    });

    // Test 6: Correct MFA
    await run("6. MFA verification on VOICE_VERIFIED session transitions to ACTIVE & returns JWTs", async () => {
        const token = speakeasy.totp({ secret: totpSecret, encoding: 'base32' });
        const res = await request(app)
            .post('/api/mfa/totp/verify-login')
            .set('x-session-id', sessionId)
            .send({ userId, token });

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.status, 'ACTIVE');
        assert.ok(res.body.accessToken);
        assert.ok(res.body.refreshToken);
        assert.ok(res.body.user);
        assert.strictEqual(res.body.user.id, userId);

        accessToken = res.body.accessToken;

        const session = await prisma.authSession.findUnique({ where: { id: sessionId } });
        assert.strictEqual(session?.status, 'ACTIVE');
        assert.strictEqual(session?.isSuccessful, true);
        assert.strictEqual(session?.isActive, true);
    });

    // Test 7: Logout
    await run("7. Logout terminates session in database", async () => {
        const res = await request(app)
            .post('/api/auth/logout')
            .set('Authorization', `Bearer ${accessToken}`);

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);

        const session = await prisma.authSession.findUnique({ where: { id: sessionId } });
        assert.strictEqual(session?.status, 'TERMINATED');
        assert.strictEqual(session?.isActive, false);
    });

    // Test 8: Revoked session API access
    await run("8. Terminated session JWT access is rejected (403)", async () => {
        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${accessToken}`);

        assert.strictEqual(res.status, 403);
    });

    console.log(`\n=========================================`);
    console.log(`🏁 Phase 1 E2E Integration complete: ${passed} Passed, ${failed} Failed`);
    console.log(`=========================================`);
    if (failed > 0) process.exit(1);
    process.exit(0);
}

runPhase1Tests();
