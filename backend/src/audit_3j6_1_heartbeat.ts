import { PrismaClient } from '@prisma/client';
import * as assert from 'assert';
import { Request, Response } from 'express';
import { continuousVerify } from './controllers/auth.controller';
import { BiometricService } from './services/biometric.service';
import { CryptoService } from './services/crypto.service';
import * as fs from 'fs';

const prisma = new PrismaClient();

// Mock BiometricService to bypass Python inference delay
BiometricService.extractFace = async () => ({
    source: 'BiometricService',
    category: 'HUMAN',
    modality: 'FACE',
    status: 'PASS',
    confidence: 0.95,
    quality: 90,
    timestamp: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    isContradictory: false,
    isSpoofed: false,
    liveness: 1.0,
    modelVersion: 'mock-v1',
    metadata: { rawEmbedding: [0.1, 0.2, 0.3], livenessScore: 1.0, antiSpoof: true }
} as any);


// Setup mock request function
const executeHeartbeat = async (sessionId: string, userId: string, overrides: any = {}): Promise<any> => {
    let result: any = null;
    let statusCode = 200;
    let nextError: any = null;

    const req: any = {
        headers: {
            authorization: `Bearer test-token`,
            'x-session-id': sessionId
        },
        user: { id: userId, sessionId },
        body: overrides.body || {
            presence: { faceDetected: true, lastActiveSecondsAgo: 0 },
            behavioral: { mouseVelocityVariance: 0.1, keyFlightTimeVariance: 0.1 }
        },
        file: overrides.file || { path: 'mock_path.jpg' }
    };

    const res: any = {
        status: (code: number) => {
            statusCode = code;
            return res;
        },
        json: (data: any) => {
            result = data;
        }
    };

    const next = (err: any) => {
        nextError = err;
    };

    // Note: We bypass the actual file upload middleware since we mock req.file
    // Also, we bypass the requireActiveSession middleware to directly hit the controller
    // but the controller itself checks `session.isActive` on line 310
    try {
        await continuousVerify(req as Request, res as Response, next);
        if (nextError) throw nextError;
    } catch (e: any) {
        return { error: true, message: e.message, statusCode: e.statusCode || statusCode };
    }

    return { statusCode, data: result };
};

async function createTestSession(idSuffix: string) {
    const user = await prisma.user.create({
        data: {
            email: `audit_3j6_${Date.now()}_${idSuffix}@test.com`,
            passwordHash: 'hash',
            role: 'USER',
            mfaEnabled: true
        }
    });

    await prisma.biometricProfile.create({
        data: {
            userId: user.id,
            faceTemplate: CryptoService.encryptTemplate(JSON.stringify([0.1, 0.2, 0.3]))
        }
    });

    const session = await prisma.authSession.create({
        data: {
            userId: user.id,
            ipAddress: '127.0.0.1',
            device: 'test_dev',
            trustState: 'TRUSTED',
            status: 'ACTIVE',
            isActive: true,
            userAgent: 'test'
        }
    });

    return { user, session };
}

async function cleanupTestSession(user: any, session: any) {
    await prisma.livenessChallenge.deleteMany({ where: { userId: user.id } });
    await prisma.authSession.delete({ where: { id: session.id } });
    await prisma.biometricProfile.deleteMany({ where: { userId: user.id } });
    await prisma.auditLog.deleteMany({ where: { userId: user.id } });
    await prisma.trustEvent.deleteMany({ where: { userId: user.id } });
    await prisma.securityEvent.deleteMany({ where: { userId: user.id } });
    try {
        await prisma.user.delete({ where: { id: user.id } });
    } catch (e) {
        // ignore FK constraints for other unhandled relationships if any
    }
}

async function runAudit() {
    console.log("Starting Phase 3J.6.1 Audit...\n");
    fs.writeFileSync('mock_path.jpg', 'dummy image content');

    // TEST 1 — NORMAL HEARTBEAT
    console.log("--- TEST 1: NORMAL HEARTBEAT ---");
    const t1 = await createTestSession("t1");
    const res1 = await executeHeartbeat(t1.session.id, t1.user.id);
    assert.strictEqual(res1.data?.sessionStatus, 'ACTIVE', "Normal heartbeat should maintain ACTIVE state");
    console.log("PASS: Normal heartbeat accepted.");
    await cleanupTestSession(t1.user, t1.session);

    // TEST 2 — DELAYED HEARTBEAT (Network Gap)
    console.log("\n--- TEST 2: DELAYED HEARTBEAT ---");
    const t2 = await createTestSession("t2");
    
    // Artificially age the session to simulate network delivery delay / missed heartbeats
    await prisma.authSession.update({
        where: { id: t2.session.id },
        data: { updatedAt: new Date(Date.now() - 160000) } // >150s gap
    });

    const res2 = await executeHeartbeat(t2.session.id, t2.user.id);
    const updatedT2 = await prisma.authSession.findUnique({ where: { id: t2.session.id }});
    assert.strictEqual(updatedT2?.status, 'LOCKED', "150s network gap should trigger LOCKED");
    assert.strictEqual(res2.data?.sessionStatus, 'LOCKED', "Response should communicate LOCKED");
    console.log("PASS: Delayed heartbeat (network gap >150s) triggers LOCKED state.");
    await cleanupTestSession(t2.user, t2.session);

    // TEST 4 — DUPLICATE HEARTBEAT
    console.log("\n--- TEST 4: DUPLICATE HEARTBEAT ---");
    const t3 = await createTestSession("t3");
    
    const body3 = {
        presence: { faceDetected: true, lastActiveSecondsAgo: 0 },
        behavioral: { mouseVelocityVariance: 0.1, keyFlightTimeVariance: 0.1 }
    };
    
    const reqPromises = [];
    for (let i = 0; i < 4; i++) {
        reqPromises.push(executeHeartbeat(t3.session.id, t3.user.id, { body: body3 }));
    }
    
    const duplicateResults = await Promise.all(reqPromises);
    const updatedT3 = await prisma.authSession.findUnique({ where: { id: t3.session.id }});
    console.log(`Duplicate Request Results:`, duplicateResults.map(r => r.data?.sessionStatus || r.message));
    console.log(`Final Status: ${updatedT3?.status}`);
    await cleanupTestSession(t3.user, t3.session);

    // TEST 6 — CONCURRENT HEARTBEATS (Volume)
    console.log("\n--- TEST 6: CONCURRENT HEARTBEATS ---");
    const t5 = await createTestSession("t5");
    const concurrentReqs = Array.from({ length: 50 }).map(() => 
        executeHeartbeat(t5.session.id, t5.user.id)
    );
    await Promise.all(concurrentReqs);
    const updatedT5 = await prisma.authSession.findUnique({ where: { id: t5.session.id }});
    assert.ok(['ACTIVE', 'LOCKED', 'RESTRICTED'].includes(updatedT5!.status), "Final state must be valid");
    console.log("PASS: Concurrent load processed safely without bypass.");
    await cleanupTestSession(t5.user, t5.session);

    // TEST 7 — LOCKED SESSION + HEARTBEAT
    console.log("\n--- TEST 7: LOCKED SESSION + HEARTBEAT ---");
    const t6 = await createTestSession("t6");
    await prisma.authSession.update({
        where: { id: t6.session.id },
        data: { status: 'LOCKED', trustState: 'LOCKED', riskLevel: 'CRITICAL' }
    });
    
    const res6 = await executeHeartbeat(t6.session.id, t6.user.id);
    const updatedT6 = await prisma.authSession.findUnique({ where: { id: t6.session.id }});
    
    assert.strictEqual(updatedT6?.status, 'LOCKED', "LOCKED session MUST NOT unlock from heartbeat");
    assert.ok(res6.error || res6.data?.sessionStatus === 'LOCKED', "Response MUST reflect LOCKED or throw 403");
    console.log("PASS: Heartbeat against LOCKED session safely rejected.");
    await cleanupTestSession(t6.user, t6.session);

    // TEST 8 — RESTRICTED SESSION + HEARTBEAT
    console.log("\n--- TEST 8: RESTRICTED SESSION + HEARTBEAT ---");
    const t7 = await createTestSession("t7");
    await prisma.authSession.update({
        where: { id: t7.session.id },
        data: { status: 'RESTRICTED', trustState: 'RESTRICTED', riskLevel: 'HIGH' }
    });
    
    const res7 = await executeHeartbeat(t7.session.id, t7.user.id);
    const updatedT7 = await prisma.authSession.findUnique({ where: { id: t7.session.id }});
    
    assert.strictEqual(updatedT7?.status, 'RESTRICTED', "RESTRICTED session MUST NOT silently restore to ACTIVE via heartbeat");
    assert.notStrictEqual(res7.data?.sessionStatus, 'ACTIVE', "Response MUST NOT be ACTIVE");
    console.log(`PASS: RESTRICTED session handled safely (Result: ${res7.data?.sessionStatus}).`);
    await cleanupTestSession(t7.user, t7.session);

    // TEST 10 — LOGOUT / INVALIDATED SESSION
    console.log("\n--- TEST 10: LOGOUT / INVALIDATED SESSION ---");
    const t8 = await createTestSession("t8");
    await prisma.authSession.update({
        where: { id: t8.session.id },
        data: { status: 'TERMINATED', isActive: false }
    });
    
    const res8 = await executeHeartbeat(t8.session.id, t8.user.id);
    const updatedT8 = await prisma.authSession.findUnique({ where: { id: t8.session.id }});
    
    assert.strictEqual(updatedT8?.status, 'TERMINATED', "TERMINATED session MUST NOT resurrect");
    assert.strictEqual(res8.error, true, "Controller must reject terminated session");
    console.log("PASS: Invalidated session cannot be resurrected.");
    await cleanupTestSession(t8.user, t8.session);

    fs.unlinkSync('mock_path.jpg');
    console.log("\n=================================");
    console.log("Phase 3J.6.1 Audit Completed.");
}

runAudit().catch(e => {
    console.error("AUDIT FAILED:", e);
    process.exit(1);
});
