// acceptance_inject.js  — self-contained, no TypeScript imports
// Usage: node acceptance_inject.js <userId> <sessionId>
'use strict';

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

function encryptTemplate(data) {
    const key = process.env.BIOMETRIC_KEY;
    if (!key || key.length !== 64) throw new Error('BIOMETRIC_KEY missing or wrong length');
    const keyBuffer = Buffer.from(key, 'hex');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `v1:gcm:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

const prisma = new PrismaClient();
const userId    = process.argv[2];
const sessionId = process.argv[3];

if (!userId || !sessionId) {
    console.error('Usage: node acceptance_inject.js <userId> <sessionId>');
    process.exit(1);
}

async function main() {
    const emb = Array(512).fill(0.1);
    const ft  = encryptTemplate(JSON.stringify(emb));

    await prisma.biometricProfile.upsert({
        where:  { userId },
        create: { userId, faceTemplate: ft, voiceTemplate: 'mock_voice' },
        update: { faceTemplate: ft }
    });

    await prisma.authSession.update({
        where: { id: sessionId },
        data:  { status: 'ACTIVE', isActive: true, trustState: 'TRUSTED' }
    });

    console.log('INJECT_OK');
    await prisma.$disconnect();
}

main().catch(e => { console.error(String(e)); process.exit(1); });
