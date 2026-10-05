import { Request, Response } from 'express';
import { requireActiveSession, requirePrivilegedAction, AppError } from './middleware';
import prisma from './prisma';
import { AdaptiveAuthenticationService } from './services/adaptiveAuth.service';
import * as assert from 'assert';

async function runPolicyAudit() {
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
        id: 'test-user', biometricProfile: { faceTemplate: 'yes', voiceTemplate: 'yes' }
    });

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

    let result = await runMiddleware(requirePrivilegedAction, mockRequest());
    console.log("Result of requirePrivilegedAction on ACTIVE/TRUSTED:", result);
}
runPolicyAudit();
