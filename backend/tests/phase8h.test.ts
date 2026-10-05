import request from 'supertest';
import app from '../src/index';
import prisma from '../src/prisma';
import { BiometricService } from '../src/services/biometric.service';
import jwt from 'jsonwebtoken';
import { CryptoService } from '../src/services/crypto.service';

jest.mock('../src/services/biometric.service', () => ({
    BiometricService: {
        analyzeLivenessSequence: jest.fn(),
        extractFace: jest.fn(),
        enrollVoice: jest.fn(),
        verifyVoice: jest.fn()
    }
}));

describe('Phase 8H: Liveness Challenge and Multi-frame Validation', () => {
    let token: string;
    let userId: string;
    let sessionId: string;

    beforeAll(async () => {
        // Create user
        const user = await prisma.user.create({
            data: {
                email: `test-8h-${Date.now()}@example.com`,
                passwordHash: 'hashed_password'
            }
        });
        userId = user.id;

        // Create enrollment token
        const eToken = 'test-enrollment-token';
        const hash = require('crypto').createHash('sha256').update(eToken).digest('hex');
        await prisma.enrollmentToken.create({
            data: {
                userId: user.id,
                tokenHash: hash,
                expiresAt: new Date(Date.now() + 3600000)
            }
        });
        token = eToken;

        // Generate session
        const session = await prisma.authSession.create({
            data: {
                userId,
                device: 'device-fp',
                ipAddress: '127.0.0.1',
                expiresAt: new Date(Date.now() + 3600000),
                status: 'CHALLENGE_REQUIRED'
            }
        });
        sessionId = session.id;

        // Enroll face using the mocked single frame extraction for backward compatibility
        (BiometricService.extractFace as jest.Mock).mockResolvedValue({
            status: 'PASS',
            confidence: 0.99,
            metadata: {
                rawEmbedding: new Array(512).fill(0.1) // dummy vector
            }
        });
        
        await request(app)
            .post('/api/biometric/register')
            .set('x-enrollment-token', token)
            .attach('face', Buffer.from('dummy image'), 'face.jpg');
    });

    afterAll(async () => {
        await prisma.biometricProfile.deleteMany({ where: { userId } });
        await prisma.enrollmentToken.deleteMany({ where: { userId } });
        await prisma.livenessChallenge.deleteMany({ where: { userId } });
        await prisma.enrollmentState.deleteMany({ where: { userId } });
        await prisma.auditLog.deleteMany({ where: { userId } });
        await prisma.securityEvent.deleteMany({ where: { userId } });
        await prisma.trustEvent.deleteMany({ where: { userId } });
        await prisma.refreshToken.deleteMany({ where: { userId } });
        await prisma.totpSecret.deleteMany({ where: { userId } });
        await prisma.authSession.deleteMany({ where: { userId } });
        await prisma.user.delete({ where: { id: userId } });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should generate a cryptographic liveness challenge', async () => {
        const res = await request(app)
            .post('/api/auth/generate-challenge')
            .set('x-session-id', sessionId)
            .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.challengeId).toBeDefined();
        expect(res.body.nonce).toBeDefined();
        expect(res.body.sequence).toBeInstanceOf(Array);
        expect(res.body.sequence.length).toBeGreaterThan(0);
    });

    it('should enforce challenge consumption on verification', async () => {
        const chalRes = await request(app)
            .post('/api/auth/generate-challenge')
            .set('x-session-id', sessionId)
            .expect(200);

        const { challengeId, nonce, sequence } = chalRes.body;

        (BiometricService.analyzeLivenessSequence as jest.Mock).mockResolvedValue({
            source: 'BiometricService',
            category: 'HUMAN',
            isContradictory: false,
            isSpoofed: false,
            modality: 'FACE',
            status: 'PASS',
            confidence: 0.99,
            quality: 95,
            timestamp: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 5 * 60000).toISOString(),
            modelVersion: '1.2.0',
            metadata: {
                livenessScore: 0.9,
                antiSpoof: true,
                challengePassed: true,
                rawEmbedding: new Array(512).fill(0.1)
            }
        });

        // 1. First verification attempt with challenge should PASS
        const vRes = await request(app)
            .post('/api/biometric/verify')
            .set('x-session-id', sessionId)
            .field('challengeId', challengeId)
            .field('nonce', nonce)
            .attach('face', Buffer.from('dummy image 1'), 'face1.jpg')
            .attach('face', Buffer.from('dummy image 2'), 'face2.jpg')
            .expect(200);

        expect(vRes.body.success).toBe(true);

        // 2. Second verification attempt with same challenge should FAIL (Challenge consumed)
        const vResFail = await request(app)
            .post('/api/biometric/verify')
            .set('x-session-id', sessionId)
            .field('challengeId', challengeId)
            .field('nonce', nonce)
            .attach('face', Buffer.from('dummy image'), 'face.jpg')
            .expect(400);

        expect(vResFail.body.success).toBe(false);
        expect(vResFail.body.message).toMatch(/consumed|expired|not found/i);
    });

    it('should fail verification if liveness score is too low or spoof detected', async () => {
        const chalRes = await request(app)
            .post('/api/auth/generate-challenge')
            .set('x-session-id', sessionId)
            .expect(200);

        const { challengeId, nonce } = chalRes.body;

        (BiometricService.analyzeLivenessSequence as jest.Mock).mockResolvedValue({
            source: 'BiometricService',
            category: 'HUMAN',
            isContradictory: false,
            isSpoofed: true,
            modality: 'FACE',
            status: 'FAIL',
            confidence: 0,
            quality: 95,
            timestamp: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 5 * 60000).toISOString(),
            modelVersion: '1.2.0',
            metadata: {
                livenessScore: 0.1,
                antiSpoof: false,
                reason: 'Spoof detected'
            }
        });

        const vRes = await request(app)
            .post('/api/biometric/verify')
            .set('x-session-id', sessionId)
            .field('challengeId', challengeId)
            .field('nonce', nonce)
            .attach('face', Buffer.from('dummy spoof image'), 'spoof.jpg')
            .expect(200);

        // The endpoint should not throw 500, but rather return a valid verification object indicating failure.
        // Wait, biometric verification returns an array of evidences. If the first one fails, success is false?
        // Actually, verifyBiometric returns { success: true, ... } but evidence says FAIL, depending on implementation.
        expect(vRes.body.success).toBe(false);
        expect(vRes.body.action).toBe('RESTRICT');
    });
});
