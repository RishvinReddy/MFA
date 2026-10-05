import { Request, Response } from 'express';
import { requireActiveSession, requirePrivilegedAction, AppError } from './middleware';
import prisma from './prisma';
import { AdaptiveAuthenticationService } from './services/adaptiveAuth.service';
import { aiEventCoordinator } from './services/ai';
import { TrustEngineService } from './services/trust.service';
import * as assert from 'assert';

async function runPolicyAudit() {
    console.log("===================================================================");
    console.log("  PHASE 3J.4 POLICY ENFORCEMENT AUDIT (STRICT ASSERTIONS)");
    console.log("===================================================================");

    let mockSessionState = 'ACTIVE';
    let mockTrustState = 'TRUSTED';

    (prisma.authSession as any).findUnique = async (args: any) => {
        if (args.where.id === 'test-session') {
            return {
                id: 'test-session',
                userId: 'test-user',
                status: mockSessionState,
                trustState: mockTrustState,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                user: { id: 'test-user', email: 'a@a.com', role: 'USER' }
            };
        }
        return null;
    };
    
    (prisma.authSession as any).update = async (args: any) => {
        if (args.where.id === 'test-session') {
            mockSessionState = args.data.status || mockSessionState;
            mockTrustState = args.data.trustState || mockTrustState;
        }
        return {};
    };

    (prisma.user as any).findUnique = async () => ({
        id: 'test-user', biometricProfile: null
    });
    
    (aiEventCoordinator as any).analyzeEvent = () => {};
    (TrustEngineService as any).logTrustEvent = async () => {};

    const mockRequest = () => ({
        headers: { 'x-session-id': 'test-session' },
        user: { id: 'test-user', sessionId: 'test-session', role: 'USER' }
    } as unknown as Request);

    const mockResponse = () => {
        const res: any = {};
        res.status = (code: number) => { res.statusCode = code; return res; };
        res.json = (data: any) => { res._body = data; return res; };
        return res as Response;
    };

    const runMiddleware = async (mw: Function, req: Request): Promise<{error?: any, res?: any}> => {
        return new Promise((resolve) => {
            const res = mockResponse();
            const next = (err?: any) => {
                resolve({ error: err, res });
            };
            
            const originalJson = res.json;
            res.json = (data: any) => {
                (res as any)._body = data;
                resolve({ res });
                return res;
            };
            
            mw(req, res, next).catch(next);
        });
    };

    console.log("\n--- TEST 1: Baseline ACCESS ---");
    let result = await runMiddleware(requireActiveSession, mockRequest());
    assert.ok(!result.error, "requireActiveSession should allow ACTIVE session");
    console.log("[PASS] requireActiveSession allows access");

    result = await runMiddleware(requirePrivilegedAction, mockRequest());
    assert.ok(!result.error && !result.res?.statusCode, "requirePrivilegedAction should allow TRUSTED/ACTIVE session");
    console.log("[PASS] requirePrivilegedAction allows access");

    console.log("\n--- TEST 2: RESTRICTED ENFORCEMENT ---");
    
    // Inject Risk 60 to force RESTRICTED
    await AdaptiveAuthenticationService.evaluateAuthenticationEvent(
        'test-user', 'test-session', 'CONTINUOUS', [], [{ type: 'SESSION_ANOMALY', severity: 60, timestamp: new Date(), description: 'Test' }]
    );
    
    assert.strictEqual(mockSessionState, 'RESTRICTED', "DB Session should be RESTRICTED");
    console.log(`[INFO] Session successfully transitioned to RESTRICTED in DB.`);

    result = await runMiddleware(requireActiveSession, mockRequest());
    assert.ok(result.error instanceof AppError && result.error.statusCode === 403, "requireActiveSession should block RESTRICTED session");
    console.log("[PASS] Protected API (requireActiveSession) ACTUALLY REJECTED request");

    result = await runMiddleware(requirePrivilegedAction, mockRequest());
    assert.strictEqual(result.res?.statusCode, 403, "requirePrivilegedAction should block RESTRICTED session");
    
    // As the session is RESTRICTED, Fusion Engine evaluated with no new evidence produces INSUFFICIENT_EVIDENCE
    // Policy Engine converts INSUFFICIENT_EVIDENCE to REQUIRE_MFA, and the middleware returns STEP_UP_REQUIRED.
    assert.strictEqual((result.res as any)._body?.action, 'STEP_UP_REQUIRED', "Action should force step up");
    console.log("[PASS] Sensitive Endpoint (requirePrivilegedAction) ACTUALLY DENIED request");

    console.log("\n--- TEST 3: LOCKED ENFORCEMENT ---");
    
    mockSessionState = 'ACTIVE'; mockTrustState = 'TRUSTED'; // reset
    
    // Inject Risk 80 to force LOCKED
    await AdaptiveAuthenticationService.evaluateAuthenticationEvent(
        'test-user', 'test-session', 'CONTINUOUS', [], [{ type: 'SESSION_ANOMALY', severity: 85, timestamp: new Date(), description: 'Test' }]
    );

    assert.strictEqual(mockSessionState, 'LOCKED', "DB Session should be LOCKED");
    console.log(`[INFO] Session successfully transitioned to LOCKED in DB.`);

    result = await runMiddleware(requireActiveSession, mockRequest());
    assert.ok(result.error instanceof AppError && result.error.statusCode === 403, "requireActiveSession should block LOCKED session");
    console.log("[PASS] Protected API (requireActiveSession) ACTUALLY REJECTED request");

    result = await runMiddleware(requirePrivilegedAction, mockRequest());
    assert.strictEqual(result.res?.statusCode, 403, "requirePrivilegedAction should block LOCKED session");
    // LOCKED is evaluated before INSUFFICIENT_EVIDENCE in the policy engine
    assert.strictEqual((result.res as any)._body?.action, 'LOCK', "Action should be LOCK");
    console.log("[PASS] Sensitive Endpoint (requirePrivilegedAction) ACTUALLY DENIED request");

    console.log("\n[INFO] All strict assertions passed.");
    process.exit(0);
}

runPolicyAudit().catch(err => {
    console.error(err);
    process.exit(1);
});
