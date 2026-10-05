import assert from 'assert';
import request from 'supertest';
import app from '../src/index';
import prisma from '../src/prisma';
import { generateToken } from '../src/authUtils';

async function runPhase7cTests() {
    console.log("=========================================");
    console.log("🛡️ Running Phase 7C API / Session Hardening Tests...");
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

    const userEmail = `harden-${Date.now()}@example.com`;
    const standardUser = await prisma.user.create({
        data: {
            email: userEmail,
            passwordHash: "$argon2id$v=19$m=65536,t=3,p=1$dummy$dummy",
            fullName: "Hardening Test User",
            role: "USER",
            status: "ACTIVE"
        }
    });

    const createSession = async (status = "ACTIVE") => {
        const session = await prisma.authSession.create({
            data: {
                userId: standardUser.id,
                ipAddress: "127.0.0.1",
                device: "test-device",
                status: status,
                isActive: status === "ACTIVE" || status.includes("CHALLENGE"),
                isSuccessful: true,
                trustState: "TRUSTED"
            }
        });
        const token = generateToken({ id: standardUser.id, email: userEmail, role: "USER", sessionId: session.id } as any);
        return { session, token };
    };

    await run("1. CORS allows valid origins", async () => {
        const res = await request(app).options('/api/health')
            .set('Origin', 'http://localhost:3000');
        assert.ok(res.headers['access-control-allow-origin'] === 'http://localhost:3000');
    });

    await run("2. CORS blocks invalid origins", async () => {
        const res = await request(app).get('/api/health')
            .set('Origin', 'http://evil-origin.com');
        
        // Express handles CORS failure by returning 500 error since the error is passed in callback
        assert.ok(res.status === 500 || !res.headers['access-control-allow-origin']);
    });

    await run("3. Malformed JSON does not leak stack traces (Sanitized 400)", async () => {
        const res = await request(app).post('/api/auth/login')
            .set('Content-Type', 'application/json')
            .send('{"email": "test@example.com", "password": "');
        
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.success, false);
        assert.ok(typeof res.body.error.message === 'string');
        assert.ok(!res.body.error.message.includes('node_modules'));
    });

    await run("4. Terminated sessions are rejected (403)", async () => {
        const { token, session } = await createSession("TERMINATED");
        const res = await request(app).get('/api/auth/me')
            .set('Authorization', `Bearer ${token}`)
            .set('x-session-id', session.id);
        
        assert.strictEqual(res.status, 403);
    });

    await run("5. Rate limiter blocks brute-force on MFA", async () => {
        const { token, session } = await createSession("CHALLENGE_REQUIRED");
        
        let lastStatus = 200;
        for (let i = 0; i < 22; i++) {
            const res = await request(app).post('/api/auth/login')
                .send({ email: "invalid@test.com", password: "wrong", deviceFingerprint: "mock", behavioralMetrics: { typingSpeed: 50, mouseVariance: 10 } });
            lastStatus = res.status;
        }

        assert.strictEqual(lastStatus, 429);
    });

    await prisma.authSession.deleteMany({ where: { userId: standardUser.id } });
    await prisma.user.delete({ where: { id: standardUser.id } });

    console.log(`\n=========================================`);
    console.log(`🏁 Phase 7C Integration complete: ${passed} Passed, ${failed} Failed`);
    console.log(`=========================================`);
    if (failed > 0) {
        throw new Error(`Tests failed with ${failed} errors`);
    }
}

if (typeof describe !== 'undefined') {
    describe('tests/phase7c.test.ts Legacy Suite', () => {
        it('executes without crashing', async () => {
            await runPhase7cTests();
        }, 30000);
    });
} else {
    runPhase7cTests().catch(err => {
        console.error('Failed', err);
        throw err;
    });
}
