import { Request, Response, NextFunction } from 'express';
import { localAssistantService } from '../services/localAssistant.service';
import prisma from '../prisma';
import { SystemDiagnosticsService } from '../services/systemDiagnostics.service';
import { DefenderService } from '../services/defender.service';

export const checkHealth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const isHealthy = await localAssistantService.checkHealth();
        if (isHealthy) {
            res.json({
                status: "AVAILABLE",
                provider: "Ollama",
                model: process.env.OLLAMA_MODEL || 'qwen2.5:3b',
                source: "Local AI"
            });
        } else {
            res.status(503).json({
                status: "UNAVAILABLE",
                provider: "Ollama",
                model: process.env.OLLAMA_MODEL || 'qwen2.5:3b',
                source: "Local AI"
            });
        }
    } catch (err) {
        next(err);
    }
};

export const chat = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { message, history, pageContext } = req.body;

        if (!message) {
            return res.status(400).json({ success: false, message: 'Message is required' });
        }

        // 1. Gather Authentication Context
        let authState = 'PRE-AUTHENTICATION';
        let userContext: any = null;
        let sessionContext: any = null;
        let enrollmentContext: any = null;
        let recentAuditEvents: any[] = [];

        const authHeader = req.headers.authorization;
        const sessionId = req.headers['x-session-id'] as string;
        const enrollmentToken = req.headers['x-enrollment-token'] as string;

        let userId: string | null = null;

        // Try to decode full auth token if present
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.split(' ')[1];
                const { verifyToken } = require('../authUtils');
                const decoded = verifyToken(token);
                if (decoded && decoded.id) {
                    userId = decoded.id;
                    authState = 'FULL_AUTHENTICATION';
                }
            } catch (err) {
                // Invalid token
            }
        }

        if (!userId && sessionId) {
            // Check for intermediate authentication state
            const session = await prisma.authSession.findUnique({ where: { id: sessionId } });
            if (session) {
                userId = session.userId;
                authState = 'INTERMEDIATE_AUTHENTICATION';
                sessionContext = {
                    status: session.status,
                    isActive: session.isActive
                };
            }
        }

        if (!userId && enrollmentToken) {
            // Very basic enrollment token validation logic based on your setup.
            // Assuming enrollment token matches user ID for now or we query user by it.
            // We check if it exists in DB.
            const user = await prisma.user.findFirst({ where: { id: enrollmentToken } });
            if (user) {
                userId = user.id;
                authState = 'ENROLLMENT';
            }
        }

        if (userId) {
            enrollmentContext = await prisma.enrollmentState.findUnique({
                where: { userId },
                select: {
                    faceEnrolled: true,
                    voiceEnrolled: true,
                    passwordEnrolled: true,
                    mfaConfigured: true,
                    recoveryConfigured: true
                }
            });

            const logs = await prisma.auditLog.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 10
            });
            
            recentAuditEvents = logs.map(l => ({
                action: l.action,
                createdAt: l.createdAt,
                status: l.action.includes('FAILED') || l.action.includes('BLOCKED') ? 'FAILED' : 'SUCCESS'
            }));
        }

        // 2. Gather Host Context
        const hostContext = {
            system: await SystemDiagnosticsService.runDiagnostics(),
            defender: await DefenderService.getThreatReport()
        };

        // 3. Build Safe Context for LLM
        const safeContext = {
            authenticationState: authState,
            pageContext: pageContext || { page: 'unknown', stage: 'unknown' },
            hostTelemetry: {
                secureBoot: hostContext.system.secureBootEnabled ? 'VERIFIED' : 'DISABLED',
                tpm: hostContext.system.tpmPresent ? 'VERIFIED' : 'UNKNOWN',
                defenderStatus: hostContext.defender.healthStatus === 'HEALTHY' ? 'VERIFIED' : 'WARNING',
                activeThreats: hostContext.defender.activeThreats
            },
            enrollmentState: enrollmentContext,
            sessionState: sessionContext,
            recentEvents: recentAuditEvents
        };

        // Validate history length
        let safeHistory = Array.isArray(history) ? history : [];
        if (safeHistory.length > 20) {
            safeHistory = safeHistory.slice(-20);
        }

        // 4. Generate Response
        const responseText = await localAssistantService.generateChatResponse(message, safeHistory, safeContext);

        res.json({
            success: true,
            message: responseText
        });

    } catch (err: any) {
        if (err.message === 'AI_UNAVAILABLE' || err.message === 'AI_TIMEOUT') {
            return res.status(503).json({ success: false, message: 'Local AI service is offline or timed out.' });
        }
        next(err);
    }
};
