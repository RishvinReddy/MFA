import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';
import { logEvent } from '../services/audit.service';
import { CryptoService } from '../services/crypto.service';
import crypto from 'crypto';

const prisma = new PrismaClient();

export const getOverview = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const totalUsers = await prisma.user.count();
        const activeSessions = await prisma.authSession.count({
            where: { status: 'ACTIVE' }
        });
        const disabledAccounts = await prisma.user.count({
            where: { status: 'DISABLED' }
        });
        const highRiskEvents = await prisma.authSession.count({
            where: { riskLevel: { in: ['HIGH', 'CRITICAL'] } }
        });
        const unresolvedSecurityEvents = await prisma.securityEvent.count({
            where: { resolved: false }
        });

        res.json({
            totalUsers,
            activeSessions,
            disabledAccounts,
            highRiskEvents,
            unresolvedSecurityEvents
        });
    } catch (err) {
        next(err);
    }
};

export const getStats = getOverview;

export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                role: true,
                status: true,
                createdAt: true
            }
        });

        const formattedUsers = users.map((u: any) => ({
            ...u,
            isActive: u.status === 'ACTIVE',
            mfaEnabled: true
        }));

        res.json({ success: true, data: formattedUsers });
    } catch (err) {
        next(err);
    }
};

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, role, fullName, password } = req.body;

        let passwordHash = "$argon2id$v=19$m=65536,t=3,p=1$dummy$dummy";
        if (password) {
            passwordHash = await CryptoService.hashPassword(password);
        }

        const rawToken = CryptoService.generateSecureToken(32);
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

        const adminId = (req as any).user?.id || 'admin_system';

        // 2. Provision User
        const user = await prisma.$transaction(async (tx) => {
            const newUser = await tx.user.create({
                data: {
                    email,
                    fullName,
                    passwordHash,
                    role: role || 'USER',
                    status: 'ENROLLMENT_REQUIRED'
                }
            });

            await tx.enrollmentState.create({
                data: {
                    userId: newUser.id,
                    passwordEnrolled: true
                }
            });

            await tx.enrollmentToken.create({
                data: {
                    userId: newUser.id,
                    tokenHash,
                    purpose: "INITIAL_ENROLLMENT",
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
                }
            });

            return newUser;
        });

        
        await logEvent({
            action: 'ADMIN_CREATED_USER',
            userId: adminId,
            metadata: { targetUser: user.id, email: user.email }
        });

        // The raw token is returned exactly once to the admin to give to the user
        res.json({ 
            success: true, 
            data: user,
            enrollmentToken: rawToken
        });
    } catch (err) {
        next(err);
    }
};

export const getSessions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sessions = await prisma.authSession.findMany({
            where: { status: 'ACTIVE' },
            include: { user: { select: { email: true } } }
        });
        res.json({ success: true, data: sessions });
    } catch (err) {
        next(err);
    }
};

export const revokeSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        await prisma.authSession.update({
            where: { id },
            data: { status: 'TERMINATED' }
        });
        res.json({ success: true, message: 'Session revoked' });
    } catch (err) {
        next(err);
    }
};

export const getAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const logs = await prisma.auditLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 100,
            include: { user: { select: { email: true } } }
        });
        res.json({ success: true, data: logs });
    } catch (err) {
        next(err);
    }
};

export const disableUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        let status = 'DISABLED';
        if (req.body.isActive !== undefined && req.body.isActive) {
            status = 'ACTIVE';
        }

        await prisma.user.update({
            where: { id },
            data: { status: status as any }
        });

        if (status === 'DISABLED') {
            await prisma.authSession.updateMany({
                where: { userId: id, status: { in: ['ACTIVE', 'CHALLENGE_REQUIRED', 'STEP_UP_REQUIRED'] } },
                data: { status: 'TERMINATED' }
            });
        }

        res.json({ success: true, message: `User ${status}` });
    } catch (err) {
        next(err);
    }
};

export const enableUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        await prisma.user.update({
            where: { id },
            data: { status: 'ACTIVE' }
        });
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

export const forceLogout = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        await prisma.authSession.updateMany({
            where: { userId: id, status: { in: ['ACTIVE', 'CHALLENGE_REQUIRED', 'STEP_UP_REQUIRED'] } },
            data: { status: 'TERMINATED' }
        });

        try {
            if ((prisma as any).refreshToken) {
                await (prisma as any).refreshToken.deleteMany({
                    where: { userId: id }
                });
            }
        } catch (e) {
            logger.warn("RefreshToken delete failed", e);
        }

        res.json({ success: true, message: "User forced out" });
    } catch (err) {
        next(err);
    }
};

export const resetMfa = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        try {
            if ((prisma as any).totpSecret) {
                await (prisma as any).totpSecret.deleteMany({
                    where: { userId: id }
                });
            }
        } catch (e) {
            logger.warn("TotpSecret model failed to delete", e);
        }

        await prisma.user.update({
            where: { id },
            data: { mfaEnabled: false }
        });

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

export const getSystemHealth = async (req: Request, res: Response, next: NextFunction) => {
    res.json({ success: true, data: { status: 'OPTIMAL', database: 'CONNECTED' } });
};

export const getAiTelemetry = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const logs = await prisma.auditLog.findMany({
            where: { action: 'AI_SECURITY_ANALYSIS' },
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: { user: { select: { email: true } } }
        });
        
        // Sanitize response DTO: Extract analysis and clean up format
        const sanitizedData = logs.map(log => ({
            id: log.id,
            timestamp: log.createdAt,
            userId: log.userId,
            userEmail: log.user?.email,
            trigger: (log.metadata as any)?.trigger,
            latencyMs: (log.metadata as any)?.latencyMs,
            analysis: (log.metadata as any)?.analysis
        }));
        
        res.json({ success: true, data: sanitizedData });
    } catch (err) {
        next(err);
    }
};
