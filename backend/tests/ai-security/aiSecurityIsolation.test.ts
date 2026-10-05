import request from 'supertest';
import app from '../../src/index';
import prisma from '../../src/prisma';
import { generateToken } from '../../src/authUtils';

describe('Phase 3H.7 & 3H.11: Session and User Isolation', () => {
    let userA: any;
    let userB: any;
    let tokenA: string;
    let sessionA: any;
    let tokenB: string;
    let sessionB: any;

    beforeAll(async () => {
        const passwordHash = "$argon2id$v=19$m=65536,t=3,p=1$dummy$dummy";
        
        userA = await prisma.user.create({
            data: { email: `userA-${Date.now()}@example.com`, passwordHash, role: 'USER', status: 'ACTIVE' }
        });
        userB = await prisma.user.create({
            data: { email: `userB-${Date.now()}@example.com`, passwordHash, role: 'USER', status: 'ACTIVE' }
        });

        sessionA = await prisma.authSession.create({
            data: { userId: userA.id, ipAddress: "127.0.0.1", device: "A", status: "ACTIVE", isActive: true, isSuccessful: true }
        });
        tokenA = generateToken({ id: userA.id, email: userA.email, role: userA.role, sessionId: sessionA.id } as any);

        sessionB = await prisma.authSession.create({
            data: { userId: userB.id, ipAddress: "127.0.0.1", device: "B", status: "ACTIVE", isActive: true, isSuccessful: true }
        });
        tokenB = generateToken({ id: userB.id, email: userB.email, role: userB.role, sessionId: sessionB.id } as any);

        // Seed Audit Logs
        await prisma.auditLog.create({
            data: {
                userId: userA.id,
                action: 'AI_SECURITY_ANALYSIS',
                metadata: { trigger: 'USER_A_EVENT', analysis: { riskScore: 10, confidence: 0.9, explanation: 'Test A' } }
            }
        });

        await prisma.auditLog.create({
            data: {
                userId: userB.id,
                action: 'AI_SECURITY_ANALYSIS',
                metadata: { trigger: 'USER_B_EVENT', analysis: { riskScore: 50, confidence: 0.9, explanation: 'Test B' } }
            }
        });
    });

    it('3H.11 - User A cannot observe User B telemetry', async () => {
        const res = await request(app)
            .get('/api/auth/ai-telemetry')
            .set('Authorization', `Bearer ${tokenA}`)
            .set('x-session-id', sessionA.id);
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.length).toBeGreaterThan(0);
        
        const triggers = res.body.data.map((d: any) => d.trigger);
        expect(triggers).toContain('USER_A_EVENT');
        expect(triggers).not.toContain('USER_B_EVENT');
    });

    it('3H.11 - User B cannot observe User A telemetry', async () => {
        const res = await request(app)
            .get('/api/auth/ai-telemetry')
            .set('Authorization', `Bearer ${tokenB}`)
            .set('x-session-id', sessionB.id);
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.length).toBeGreaterThan(0);
        
        const triggers = res.body.data.map((d: any) => d.trigger);
        expect(triggers).toContain('USER_B_EVENT');
        expect(triggers).not.toContain('USER_A_EVENT');
    });
});
