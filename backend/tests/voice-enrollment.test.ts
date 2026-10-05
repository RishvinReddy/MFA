import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../src/index'; // Adjust path if needed
import { CryptoService } from '../src/services/crypto.service';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

describe('Phase 2 Voice Enrollment (ECAPA-TDNN -> Prisma)', () => {
    let testUserId: string;
    let enrollmentToken: string;

    beforeAll(async () => {
        // Create test user
        const user = await prisma.user.create({
            data: {
                email: 'voice-enrollment-test@example.com',
                fullName: 'Voice Test User',
                passwordHash: 'dummy_hash',
                status: 'ENROLLMENT_REQUIRED'
            }
        });
        testUserId = user.id;

        // Create enrollment token
        const token = `test-token-voice-${Date.now()}`;
        const hash = require('crypto').createHash('sha256').update(token).digest('hex');
        
        await prisma.enrollmentToken.create({
            data: {
                userId: testUserId,
                tokenHash: hash,
                purpose: 'INITIAL_ENROLLMENT',
                expiresAt: new Date(Date.now() + 1000 * 60 * 60)
            }
        });
        enrollmentToken = token;
    });

    afterAll(async () => {
        await prisma.enrollmentToken.deleteMany({ where: { userId: testUserId } });
        await prisma.biometricProfile.deleteMany({ where: { userId: testUserId } });
        await prisma.enrollmentState.deleteMany({ where: { userId: testUserId } });
        await prisma.user.delete({ where: { id: testUserId } });
        await prisma.$disconnect();
    });

    it('1. Voice enrollment creates voiceTemplate and encrypts it', async () => {
        // Create a dummy wav
        const dummyWavPath = path.join(__dirname, 'dummy_voice.wav');
        const dummyWav = Buffer.from("RIFF$000WAVEfmt 0000000000000000data0000" + "dummydata", "utf8");
        fs.writeFileSync(dummyWavPath, dummyWav);

        // Mock extractVoice so registration doesn't hit the offline Python server
        const { BiometricService } = require('../src/services/biometric.service');
        const enrollSpy = jest.spyOn(BiometricService, 'extractVoice').mockResolvedValue({
            status: 'PASS',
            metadata: { rawEmbedding: new Array(192).fill(0.5) }
        });

        const res = await request(app)
            .post('/api/biometric/register')
            .set('x-enrollment-token', enrollmentToken)
            .attach('voice', dummyWavPath);
        
        if (fs.existsSync(dummyWavPath)) fs.unlinkSync(dummyWavPath);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const profile = await prisma.biometricProfile.findUnique({
            where: { userId: testUserId }
        });

        expect(profile).toBeDefined();
        expect(profile?.voiceTemplate).toBeDefined();
        expect(profile?.voiceTemplate).not.toBeNull();
        
        // 2. verify encryption
        expect(profile?.voiceTemplate).toMatch(/^v1:gcm:/);

        // Try decrypting
        const decrypted = CryptoService.decryptTemplate(profile!.voiceTemplate!);
        const parsed = JSON.parse(decrypted);
        
        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed.length).toBe(192); // ECAPA dim
    }, 15000);

    it('3. No plaintext voice template is written to disk', () => {
        // The old code used voice_refs/
        const voiceRefsDir = path.join(__dirname, '../../biometric-service/voice_refs');
        if (fs.existsSync(voiceRefsDir)) {
            const files = fs.readdirSync(voiceRefsDir);
            expect(files.length).toBe(0);
        } else {
            expect(true).toBe(true);
        }
    });
});
