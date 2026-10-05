import assert from 'assert';
import request from 'supertest';
import app from '../src/index';
import prisma from '../src/prisma';
import crypto from 'crypto';
import speakeasy from 'speakeasy';

async function runMfaEnrollmentTests() {
    console.log("=========================================");
    console.log("🛡️ Running MFA Enrollment Fix Integration Tests...");
    console.log("=========================================\n");

    const email = `mfa-fix-test-${Date.now()}@example.com`;
    const password = 'SecurePassword123!';
    const fullName = 'MFA Fix Test User';
    let userId = '';

    // Create user in ENROLLMENT_REQUIRED state
    const user = await prisma.user.create({
        data: {
            email,
            passwordHash: "$argon2id$v=19$m=65536,t=3,p=1$MmdhY2Fkc2E$abcdefghijkl", // mock hash
            fullName,
            role: 'USER',
            status: 'ENROLLMENT_REQUIRED'
        }
    });
    userId = user.id;

    // Initialize EnrollmentState
    await prisma.enrollmentState.create({
        data: {
            userId,
            passwordEnrolled: true,
            faceEnrolled: false,
            voiceEnrolled: false,
            recoveryConfigured: false
        }
    });

    // Create a valid enrollment token
    const validToken = "valid-mfa-enrollment-token-123456789";
    const validHash = crypto.createHash('sha256').update(validToken).digest('hex');
    await prisma.enrollmentToken.create({
        data: {
            userId,
            tokenHash: validHash,
            purpose: 'INITIAL_ENROLLMENT',
            expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
        }
    });

    // Create an expired enrollment token
    const expiredToken = "expired-mfa-enrollment-token-987654321";
    const expiredHash = crypto.createHash('sha256').update(expiredToken).digest('hex');
    await prisma.enrollmentToken.create({
        data: {
            userId,
            tokenHash: expiredHash,
            purpose: 'INITIAL_ENROLLMENT',
            expiresAt: new Date(Date.now() - 1000) // expired
        }
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

    // Test 1: setupTotp succeeds with valid enrollment token
    let qr = '';
    await run("1. Valid enrollment token -> /totp/setup succeeds", async () => {
        const res = await request(app)
            .post('/api/mfa/totp/setup')
            .set('x-enrollment-token', validToken)
            .send();

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.ok(res.body.qr);
        qr = res.body.qr;
    });

    // Test 2: setupTotp rejected with invalid token
    await run("2. Invalid token -> setup rejected (403)", async () => {
        const res = await request(app)
            .post('/api/mfa/totp/setup')
            .set('x-enrollment-token', 'wrong-token-value')
            .send();

        assert.strictEqual(res.status, 403);
    });

    // Test 3: setupTotp rejected with expired token
    await run("3. Expired token -> setup rejected (403)", async () => {
        const res = await request(app)
            .post('/api/mfa/totp/setup')
            .set('x-enrollment-token', expiredToken)
            .send();

        assert.strictEqual(res.status, 403);
    });

    // Test 4: verifyTotpSetup with valid token succeeds, but incomplete enrollment doesn't activate user
    let totpSecretRecord = await prisma.totpSecret.findUnique({ where: { userId } });
    const secret = totpSecretRecord!.secret;
    await run("4. Valid token -> /totp/verify succeeds, incomplete enrollment does not activate", async () => {
        const token = speakeasy.totp({ secret, encoding: 'base32' });
        const res = await request(app)
            .post('/api/mfa/totp/verify')
            .set('x-enrollment-token', validToken)
            .send({ token });

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.isFullyEnrolled, false);

        // Verify status remains ENROLLMENT_REQUIRED
        const userCheck = await prisma.user.findUnique({ where: { id: userId } });
        assert.strictEqual(userCheck?.status, 'ENROLLMENT_REQUIRED');
        
        // Verify recoveryConfigured updated to true
        const stateCheck = await prisma.enrollmentState.findUnique({ where: { userId } });
        assert.strictEqual(stateCheck?.recoveryConfigured, true);
    });

    // Test 5: verifyTotpSetup with valid token succeeds, and complete enrollment activates user and deletes token
    // Update state to simulate biometrics enrolled
    await prisma.enrollmentState.update({
        where: { userId },
        data: { faceEnrolled: true, voiceEnrolled: true }
    });

    await run("5. Complete enrollment + valid TOTP -> becomes ACTIVE & deletes token", async () => {
        // Generate new TOTP
        const token = speakeasy.totp({ secret, encoding: 'base32' });
        const res = await request(app)
            .post('/api/mfa/totp/verify')
            .set('x-enrollment-token', validToken)
            .send({ token });

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.isFullyEnrolled, true);

        // Verify status is now ACTIVE
        const userCheck = await prisma.user.findUnique({ where: { id: userId } });
        assert.strictEqual(userCheck?.status, 'ACTIVE');

        // Verify enrollment token record deleted
        const tokens = await prisma.enrollmentToken.findMany({ where: { userId } });
        assert.strictEqual(tokens.length, 0);
    });

    // Clean up
    await prisma.enrollmentState.deleteMany({ where: { userId } });
    await prisma.totpSecret.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });

    console.log(`\n=========================================`);
    console.log(`🏁 MFA Enrollment Fix complete: ${passed} Passed, ${failed} Failed`);
    console.log(`=========================================`);
    if (failed > 0) process.exit(1);
    process.exit(0);
}

runMfaEnrollmentTests();
