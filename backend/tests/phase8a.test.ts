import assert from 'assert';
import request from 'supertest';
import app from '../src/index';
import prisma from '../src/prisma';
import { generateToken } from '../src/authUtils';
import { BiometricService } from '../src/services/biometric.service';
import { CryptoService } from '../src/services/crypto.service';
import { ChallengeService } from '../src/services/challenge.service';
import fs from 'fs';
import path from 'path';

async function runPhase8aTests() {
    console.log("=========================================");
    console.log("🛡️ Running Phase 8A Biometric Accuracy & Security Integration Tests...");
    console.log("=========================================\n");

    let passedCount = 0;
    let failedCount = 0;

    async function run(name: string, fn: () => void | Promise<void>) {
        try {
            await fn();
            console.log(`✅ PASS: ${name}`);
            passedCount++;
        } catch (e) {
            console.error(`❌ FAIL: ${name}`);
            console.error(e);
            failedCount++;
        }
    }

    const email = `biom-test-${Date.now()}@example.com`;
    const user = await prisma.user.create({
        data: {
            email,
            passwordHash: "$argon2id$v=19$m=65536,t=3,p=1$dummy$dummy",
            fullName: "Accuracy Test User",
            role: "USER",
            status: "ACTIVE"
        }
    });

    const createChallengeSession = async () => {
        const session = await prisma.authSession.create({
            data: {
                userId: user.id,
                ipAddress: "127.0.0.1",
                device: "test-device",
                status: "CHALLENGE_REQUIRED",
                isActive: true,
                isSuccessful: true,
                trustState: "TRUSTED"
            }
        });
        const token = generateToken({ id: user.id, email: user.email, role: user.role, sessionId: session.id } as any);
        const chal = await ChallengeService.createChallenge(session.id);
        return { session, token, chal };
    };

    // Create dummy face file for multer upload
    const dummyFilePath = path.join(__dirname, 'temp_face.jpg');
    fs.writeFileSync(dummyFilePath, 'dummy jpeg data');

    // 1. Missing authenticated identity / session
    await run("1. Missing x-session-id header rejected with 401", async () => {
        const res = await request(app)
            .post('/api/biometric/verify');

        assert.strictEqual(res.status, 401);
    });

    // 2a. Missing biometric profile (REST API returns 404)
    await run("2a. Missing biometric profile in database returns HTTP 404", async () => {
        const { session, token, chal } = await createChallengeSession();

        // Ensure biometric profile is deleted
        await prisma.biometricProfile.deleteMany({ where: { userId: user.id } });

        const res = await request(app)
            .post('/api/biometric/verify')
            .set('Authorization', `Bearer ${token}`)
            .set('x-session-id', session.id)
                .field('challengeId', chal.challengeId)
                .field('nonce', chal.nonce)
                .attach('face', dummyFilePath);

        assert.strictEqual(res.status, 404);
    });

    // 2b. Biometric profile exists but missing face template (Fail closed)
    await run("2b. Missing face template in profile fails closed with success: false", async () => {
        const { session, token, chal } = await createChallengeSession();

        // Upsert profile with null template
        await prisma.biometricProfile.upsert({
            where: { userId: user.id },
            update: { faceTemplate: null },
            create: { userId: user.id, faceTemplate: null }
        });

        // Mock extractFace to return dummy success extraction
        const originalExtractFace = BiometricService.analyzeLivenessSequence;
        BiometricService.analyzeLivenessSequence = async () => ({
            source: 'BiometricService',
            category: 'HUMAN', isContradictory: false, isSpoofed: false, modality: 'FACE',
            status: 'PASS',
            confidence: 0.99,
            quality: 80,
            timestamp: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 50000).toISOString(),
            modelVersion: '1.2.0',
            metadata: {
                liveness: true,
                antiSpoof: true,
                challengePassed: true,
                rawEmbedding: Array(512).fill(0.1)
            }
        });

        try {
            const res = await request(app)
                .post('/api/biometric/verify')
                .set('Authorization', `Bearer ${token}`)
                .set('x-session-id', session.id)
                .field('challengeId', chal.challengeId)
                .field('nonce', chal.nonce)
                .attach('face', dummyFilePath);

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.evidences[0].status, 'FAIL');
            assert.ok(res.body.evidences[0].metadata.reason.includes('No enrolled face template found'));
        } finally {
            BiometricService.analyzeLivenessSequence = originalExtractFace;
        }
    });

    // 3. Exact matching embedding (success: true + HTTP 200)
    await run("3. Matching face embedding yields success: true and HTTP 200", async () => {
        const { session, token, chal } = await createChallengeSession();

        const enrolledEmbedding = Array(512).fill(0).map(() => Math.random());
        const encryptedTemplate = CryptoService.encryptTemplate(JSON.stringify(enrolledEmbedding));

        // Create biometric profile
        await prisma.biometricProfile.upsert({
            where: { userId: user.id },
            update: { faceTemplate: encryptedTemplate },
            create: { userId: user.id, faceTemplate: encryptedTemplate }
        });

        // Mock extractFace to return same embedding
        const originalExtractFace = BiometricService.analyzeLivenessSequence;
        BiometricService.analyzeLivenessSequence = async () => ({
            source: 'BiometricService',
            category: 'HUMAN', isContradictory: false, isSpoofed: false, modality: 'FACE',
            status: 'PASS',
            confidence: 0.99,
            quality: 80,
            timestamp: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 50000).toISOString(),
            modelVersion: '1.2.0',
            metadata: {
                liveness: true,
                antiSpoof: true,
                challengePassed: true,
                rawEmbedding: enrolledEmbedding
            }
        });

        try {
            const res = await request(app)
                .post('/api/biometric/verify')
                .set('Authorization', `Bearer ${token}`)
                .set('x-session-id', session.id)
                .field('challengeId', chal.challengeId)
                .field('nonce', chal.nonce)
                .attach('face', dummyFilePath);

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            assert.strictEqual(res.body.evidences[0].status, 'PASS');
            assert.ok(res.body.evidences[0].similarityScore > 0.99);
        } finally {
            BiometricService.analyzeLivenessSequence = originalExtractFace;
        }
    });

    // 4. Mismatching face embedding (success: false + HTTP 200)
    await run("4. Mismatched face embedding yields success: false and HTTP 200", async () => {
        const { session, token, chal } = await createChallengeSession();

        const enrolledEmbedding = Array(512).fill(0);
        enrolledEmbedding[0] = 1.0; // Enrolled vector
        const encryptedTemplate = CryptoService.encryptTemplate(JSON.stringify(enrolledEmbedding));

        // Update biometric profile
        await prisma.biometricProfile.upsert({
            where: { userId: user.id },
            update: { faceTemplate: encryptedTemplate },
            create: { userId: user.id, faceTemplate: encryptedTemplate }
        });

        // Mock extractFace to return different orthogonal embedding
        const verifyEmbedding = Array(512).fill(0);
        verifyEmbedding[1] = 1.0; // Different vector

        const originalExtractFace = BiometricService.analyzeLivenessSequence;
        BiometricService.analyzeLivenessSequence = async () => ({
            source: 'BiometricService',
            category: 'HUMAN', isContradictory: false, isSpoofed: false, modality: 'FACE',
            status: 'PASS',
            confidence: 0.99,
            quality: 80,
            timestamp: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 50000).toISOString(),
            modelVersion: '1.2.0',
            metadata: {
                liveness: true,
                antiSpoof: true,
                challengePassed: true,
                rawEmbedding: verifyEmbedding
            }
        });

        try {
            const res = await request(app)
                .post('/api/biometric/verify')
                .set('Authorization', `Bearer ${token}`)
                .set('x-session-id', session.id)
                .field('challengeId', chal.challengeId)
                .field('nonce', chal.nonce)
                .attach('face', dummyFilePath);

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.evidences[0].status, 'FAIL');
            assert.ok(res.body.evidences[0].metadata.reason.includes('Face Mismatch'));
            assert.strictEqual(res.body.evidences[0].similarityScore, 0); // Orthogonal has cosine similarity 0
        } finally {
            BiometricService.analyzeLivenessSequence = originalExtractFace;
        }
    });

    // Cleanup face file
    if (fs.existsSync(dummyFilePath)) {
        fs.unlinkSync(dummyFilePath);
    }

    console.log("\n-----------------------------------------");
    console.log(`Phase 8A integration tests completed.`);
    console.log(`Passed: ${passedCount} | Failed: ${failedCount}`);
    console.log("-----------------------------------------\n");

    if (failedCount > 0) {
        throw new Error(`Phase 8A tests failed with ${failedCount} errors`);
    }
}

if (typeof describe !== 'undefined') {
    describe('tests/phase8a.test.ts Legacy Suite', () => {
        it('executes without crashing', async () => {
            await runPhase8aTests();
        }, 30000);
    });
} else {
    runPhase8aTests().catch(err => {
        console.error('Failed', err);
        throw err;
    });
}
