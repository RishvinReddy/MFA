import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function run() {
    const user = await prisma.user.findFirst();
    if (!user) throw new Error("No user");

    const crypto = require('crypto');
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await prisma.enrollmentToken.create({
        data: {
            tokenHash: hash,
            userId: user.id,
            expiresAt: new Date(Date.now() + 3600000)
        }
    });

    const nonce = 'test-nonce-123';
    const challenge = await prisma.livenessChallenge.create({
        data: {
            nonce,
            sequence: JSON.stringify(["blue river"]),
            expiresAt: new Date(Date.now() + 3600000),
            userId: user.id
        }
    });

    const FormData = require('form-data');
    const form = new FormData();
    
    fs.writeFileSync('dummy.wav', 'RIFF....WAVEfmt ........data....');
    
    form.append('voice', fs.createReadStream('dummy.wav'), { filename: 'voice_sample.wav', contentType: 'audio/wav' });
    form.append('challengeId', challenge.id);
    form.append('nonce', nonce);

    const headers = {
        ...form.getHeaders(),
        'x-enrollment-token': rawToken
    };

    console.log("Sending request with headers:", headers);

    const res = await fetch(`http://localhost:8080/api/biometric/validate-voice-sample`, {
        method: 'POST',
        headers: headers,
        body: form as any
    });
    
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", text);
}

run().catch(console.error).finally(() => process.exit(0));
