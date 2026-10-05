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
                    if (sessionId) {
                        const session = await prisma.authSession.findUnique({ where: { id: sessionId } });
                        if (session && session.isActive) {
                            if (session.status === 'ACTIVE') {
                                userId = session.userId;
                                authState = 'FULL_AUTHENTICATION';
                                sessionContext = { status: session.status, isActive: session.isActive };
                            } else {
                                const allowedIntermediateStates = ['CHALLENGE_REQUIRED', 'FACE_VERIFIED', 'VOICE_VERIFIED', 'RESTRICTED', 'MFA_REQUIRED', 'STEP_UP_REQUIRED'];
                                if (allowedIntermediateStates.includes(session.status)) {
                                    userId = session.userId;
                                    authState = 'INTERMEDIATE_AUTHENTICATION';
                                    sessionContext = { status: session.status, isActive: session.isActive };
                                }
                            }
                        }
                    } else {
                        userId = decoded.id;
                        authState = 'FULL_AUTHENTICATION';
                    }
                }
            } catch (err) {
                // Invalid token
            }
        }

        if (!userId && enrollmentToken) {
            const crypto = require('crypto');
            const hash = crypto.createHash('sha256').update(enrollmentToken).digest('hex');
            const tokenRecord = await prisma.enrollmentToken.findUnique({ where: { tokenHash: hash } });
            if (tokenRecord && tokenRecord.expiresAt > new Date() && !tokenRecord.usedAt) {
                userId = tokenRecord.userId;
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
                    recoveryConfigured: true
                }
            });

            const logs = await prisma.auditLog.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 10
            });

            recentAuditEvents = logs.map(l => {
                const meta = l.metadata as any;
                return {
                    action: l.action,
                    createdAt: l.createdAt,
                    status: meta?.status || (l.action.includes('FAILED') || l.action.includes('BLOCKED') ? 'FAILED' : 'SUCCESS')
                };
            });
        }

        const safePageContext = {
            page: typeof pageContext?.page === 'string' ? pageContext.page.slice(0, 100) : 'unknown',
            stage: typeof pageContext?.stage === 'string' ? pageContext.stage.slice(0, 50) : 'unknown'
        };

        const safeContext: any = {
            authenticationState: authState,
            pageContext: safePageContext,
            enrollmentState: enrollmentContext,
            sessionState: sessionContext,
            recentEvents: recentAuditEvents
        };

        if (authState !== 'PRE-AUTHENTICATION') {
            // 2. Gather Host Context only if authenticated or enrolling
            const systemDiagnostics = await SystemDiagnosticsService.runDiagnostics();
            safeContext.hostTelemetry = {
                secureBoot: systemDiagnostics.security.secureBoot.status,
                secureBootConfidence: systemDiagnostics.security.secureBoot.confidence,
                tpm: systemDiagnostics.security.tpm.status,
                tpmConfidence: systemDiagnostics.security.tpm.confidence,
                firewall: systemDiagnostics.security.firewall.status,
                firewallConfidence: systemDiagnostics.security.firewall.confidence,
                defender: {
                    status: systemDiagnostics.security.defender.status,
                    threatCount: systemDiagnostics.security.defender.threats.length
                },
                diskEncryption: systemDiagnostics.security.diskEncryption.status
            };
        } else {
            safeContext.hostTelemetry = { status: 'HIDDEN_PRE_AUTH' };
        }

        // Validate and sanitize history length and roles
        let safeHistory = Array.isArray(history)
            ? history
                .filter(
                    (item: any) =>
                        item &&
                        item.sender === 'USER' &&
                        typeof item.text === 'string'
                )
                .slice(-20)
                .map((item: any) => ({
                    sender: 'USER',
                    text: item.text.slice(0, 2000)
                }))
            : [];

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
