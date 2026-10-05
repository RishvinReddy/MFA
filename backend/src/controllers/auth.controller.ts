import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { AppError } from '../middleware';
import prisma from '../prisma';
import { loginSchema } from '../validators/auth.validator';
import { logger } from '../utils/logger';
import { ChallengeService } from '../services/challenge.service';
import { BiometricService } from '../services/biometric.service';
import { CryptoService } from '../services/crypto.service';
import { cosineSimilarity } from './biometric.controller';
import { NormalizedEvidence } from '../types/evidence';
import fs from 'fs';

const authService = new AuthService();

export const register = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await authService.register(req.body);
        res.status(201).json({ success: true, ...result });
    } catch (err) {
        next(err);
    }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const parsed = loginSchema.parse(req.body);
        const { email, password, behavioralMetrics, deviceFingerprint } = parsed;

        const metadata = {
            ip: req.ip,
            device: deviceFingerprint,
            typingSpeed: behavioralMetrics?.typingSpeed,
            mouseVariance: behavioralMetrics?.mouseVariance
        };

        const result = await authService.login(email, password, metadata);

        if (result.requiresEnrollment) {
            return res.json({
                success: true,
                requiresEnrollment: true,
                userId: result.userId,
                enrollmentToken: result.enrollmentToken,
                message: "Account enrollment incomplete. Please complete biometrics and MFA."
            });
        }

        res.json({
            success: true,
            requiresMfa: true,
            sessionId: result.sessionId,
            userId: result.userId,
            message: result.message
        });

    } catch (err) {
        next(err);
    }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) throw new AppError(400, 'Refresh token required');

        res.status(501).json({ success: false, message: "Refresh token rotation not fully implemented in prototype yet." });
    } catch (err) {
        next(err);
    }
};

export const logout = async (req: Request, res: Response) => {
    try {
        const sessionId = (req as any).user?.sessionId;
        if (sessionId) {
            await prisma.authSession.update({
                where: { id: sessionId },
                data: {
                    status: 'TERMINATED',
                    isActive: false
                }
            });
        }
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (err: any) {
        logger.error("Logout Error:", err);
        res.status(500).json({ success: false, message: "Logout failed" });
    }
};

export const me = async (req: Request, res: Response) => {
    // req.user comes from middleware which verifies token.
    res.json({ user: (req as any).user });
};

export const getMyAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) throw new AppError(401, 'Unauthorized');
        
        const logs = await prisma.auditLog.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        
        const timelineEvents = logs.map(log => {
            let status = 'PASSED';
            let description = log.action;
            let riskScore = (log.metadata as any)?.score || 0;
            
            if (log.action.includes('FAILED') || log.action.includes('BLOCKED') || log.action.includes('LOCKED')) {
                status = 'FAILED';
                description = (log.metadata as any)?.reason || log.action;
            } else if (log.action.includes('SUCCESS')) {
                status = 'PASSED';
                description = 'Authentication Successful';
            } else if (log.action === 'RISK_ASSESSMENT') {
                status = (log.metadata as any)?.decision === 'DENY' ? 'FAILED' : 'PASSED';
                description = 'Risk Assessment';
            } else if (log.action === 'DURESS_TRIGGERED') {
                status = 'CRITICAL';
                description = 'DURESS SIGNAL DETECTED';
                riskScore = 100;
            }

            return {
                id: log.id,
                timestamp: new Date(log.createdAt).toLocaleTimeString(),
                type: log.action,
                status,
                description,
                riskScore,
                aiExplanation: JSON.stringify(log.metadata)
            };
        });

        res.json({ success: true, timeline: timelineEvents });
    } catch (err) {
        next(err);
    }
};

export const getMyAiTelemetry = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) throw new AppError(401, 'Unauthorized');
        
        const logs = await prisma.auditLog.findMany({
            where: { 
                userId,
                action: 'AI_SECURITY_ANALYSIS'
            },
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        
        const sanitizedData = logs.map(log => ({
            id: log.id,
            timestamp: log.createdAt,
            trigger: (log.metadata as any)?.trigger,
            latencyMs: (log.metadata as any)?.latencyMs,
            analysis: (log.metadata as any)?.analysis
        }));

        res.json({ success: true, data: sanitizedData });
    } catch (err) {
        next(err);
    }
};

export const getSessionStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
        let sessionId = req.headers['x-session-id'] as string;
        
        const authHeader = req.headers.authorization;
        let decodedToken: any = null;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                const { verifyToken } = require('../authUtils');
                decodedToken = verifyToken(token);
                if (decodedToken && decodedToken.sessionId) {
                    sessionId = decodedToken.sessionId;
                }
            } catch (err) {
                // Ignore token verification error; default to x-session-id if present
            }
        }

        if (!sessionId) {
            return res.status(400).json({ success: false, message: "Missing session identifier" });
        }

        const session = await prisma.authSession.findUnique({
            where: { id: sessionId },
            select: {
                id: true,
                userId: true,
                status: true,
                isActive: true,
                expiresAt: true
            }
        });

        if (!session) {
            return res.status(404).json({ success: false, message: "Session not found" });
        }

        if (session.expiresAt && new Date() > session.expiresAt) {
            return res.json({
                success: true,
                status: "TERMINATED",
                isActive: false
            });
        }

        if (session.status === 'ACTIVE' && decodedToken) {
            if (session.userId !== decodedToken.id) {
                return res.status(403).json({ success: false, message: "Forbidden: Session identity mismatch" });
            }
        }

        res.json({
            success: true,
            status: session.status,
            isActive: session.isActive
        });
    } catch (err) {
        next(err);
    }
};

export const getEnrollmentStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id;
        
        let state = await prisma.enrollmentState.findUnique({ where: { userId } });
        if (!state) {
            state = await prisma.enrollmentState.create({
                data: {
                    userId,
                    passwordEnrolled: true,
                    faceEnrolled: false,
                    voiceEnrolled: false,
                    recoveryConfigured: false
                }
            });
        }

        res.json({
            success: true,
            userId,
            passwordEnrolled: state.passwordEnrolled,
            faceEnrolled: state.faceEnrolled,
            voiceEnrolled: state.voiceEnrolled,
            recoveryConfigured: state.recoveryConfigured
        });
    } catch (error) {
        next(error);
    }
};

export const generateLivenessChallenge = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id;
        const sessionId = (req as any).user?.sessionId; // Null if enrollment

        if (!userId && !sessionId) {
            throw new AppError(401, 'Unauthorized: Need active session or enrollment state');
        }

        const type = req.query.type as string; // 'FACE' | 'VOICE'

        let challenge: any;
        if (type === 'VOICE') {
            challenge = await ChallengeService.createVoiceChallenge(sessionId, userId);
        } else {
            challenge = await ChallengeService.createChallenge(sessionId, userId);
        }

        res.json({
            success: true,
            challengeId: challenge.challengeId,
            nonce: challenge.nonce,
            sessionId: challenge.sessionId,
            sequence: challenge.sequence, // for FACE
            phrase: challenge.phrase, // for VOICE
            issuedAt: challenge.issuedAt,
            expiresAt: challenge.expiresAt,
            consumed: challenge.consumed
        });
    } catch (error) {
        next(error);
    }
};

export const continuousVerify = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id;
        const sessionId = (req as any).user?.sessionId || (req.headers['x-session-id'] as string);

        if (!userId || !sessionId) {
            throw new AppError(401, 'Unauthorized: Missing user context or session identifier');
        }

        // 1. Verify active session in DB
        const session = await prisma.authSession.findUnique({ where: { id: sessionId } });
        if (!session || !session.isActive || session.status === 'TERMINATED' || session.status === 'LOCKED') {
            throw new AppError(403, `Forbidden: Active session required. Current state: ${session?.status || 'TERMINATED'}`);
        }

        // 2. Read server-side receipt time independently of client timestamp
        const serverReceiptTime = new Date();
        const { presence, behavioral } = req.body || {};

        // 3. Compute elapsed time since last updated session timestamp
        const lastUpdatedTime = session.updatedAt ? session.updatedAt.getTime() : session.createdAt.getTime();
        const elapsedSeconds = (serverReceiptTime.getTime() - lastUpdatedTime) / 1000;

        // 4. Determine risk events based on explicit grace/tolerance policy
        const riskEvents: any[] = [];

        if (elapsedSeconds >= 150) {
            riskEvents.push({
                type: 'SESSION_ANOMALY',
                severity: 85,
                timestamp: serverReceiptTime,
                description: `Heartbeat abandoned: missing for ${Math.round(elapsedSeconds)}s`
            });
        } else if (elapsedSeconds >= 75) {
            riskEvents.push({
                type: 'SESSION_ANOMALY',
                severity: 55,
                timestamp: serverReceiptTime,
                description: `Stale heartbeat: missing for ${Math.round(elapsedSeconds)}s`
            });
        } else if (elapsedSeconds >= 36) {
            riskEvents.push({
                type: 'SESSION_ANOMALY',
                severity: 35,
                timestamp: serverReceiptTime,
                description: `Delayed heartbeat: ${Math.round(elapsedSeconds)}s interval`
            });
        }

        if (presence && presence.faceDetected === false) {
            riskEvents.push({
                type: 'BIOMETRIC_FAILURE',
                severity: 25,
                timestamp: serverReceiptTime,
                description: 'Face presence not detected during heartbeat'
            });
        }

        // 4.5 Process uploaded face frame if present
        let newEvidence: NormalizedEvidence[] = [];

        if (req.file) {
            let faceEvidence: NormalizedEvidence;
            try {
                faceEvidence = await BiometricService.extractFace(req.file.path);
                
                if (faceEvidence.status === 'PASS' && faceEvidence.metadata?.rawEmbedding) {
                    const profile = await prisma.biometricProfile.findUnique({ where: { userId } });
                    if (profile && profile.faceTemplate) {
                        const storedTemplate = JSON.parse(CryptoService.decryptTemplate(profile.faceTemplate));
                        const similarity = cosineSimilarity(faceEvidence.metadata.rawEmbedding, storedTemplate);
                        const envThreshold = process.env.FACE_SIMILARITY_THRESHOLD;
                        const threshold = envThreshold ? parseFloat(envThreshold) : 0.50;

                        logger.info(`[Continuous Verify] Cosine similarity: ${similarity.toFixed(4)} (Threshold: ${threshold.toFixed(2)})`);
                        
                        if (!faceEvidence.metadata) faceEvidence.metadata = {};
                        (faceEvidence.metadata as any).similarityScore = similarity;
                        (faceEvidence as any).similarityScore = similarity;
                        faceEvidence.confidence = similarity;

                        if (similarity >= threshold) {
                            faceEvidence.status = 'PASS';
                            faceEvidence.isContradictory = false;
                        } else {
                            faceEvidence.status = 'FAIL';
                            faceEvidence.isContradictory = true;
                            faceEvidence.metadata.reason = 'Face Mismatch';
                            faceEvidence.confidence = 0;
                        }
                    } else {
                        faceEvidence.status = 'FAIL';
                        if (!faceEvidence.metadata) faceEvidence.metadata = {};
                        faceEvidence.metadata.reason = 'No enrolled face template';
                        faceEvidence.confidence = 0;
                    }
                }
            } catch (e: any) {
                logger.error("Continuous auth face processing failed:", e);
                faceEvidence = {
                    source: 'BiometricService',
                    category: 'HUMAN',
                    modality: 'FACE',
                    status: 'UNAVAILABLE',
                    confidence: 0,
                    quality: 0,
                    timestamp: new Date().toISOString(),
                    expiresAt: new Date().toISOString(),
                    isContradictory: false,
                    isSpoofed: false,
                    modelVersion: 'unknown',
                    metadata: { reason: e.message }
                };
            } finally {
                try {
                    fs.unlinkSync(req.file.path);
                } catch (unlinkErr) {
                    logger.warn("Failed to delete continuous-verify file:", unlinkErr);
                }
            }
            newEvidence.push(faceEvidence);
        }

        if (req.file && newEvidence[0] && (newEvidence[0].status === 'INSUFFICIENT_DATA' || newEvidence[0].status === 'UNAVAILABLE')) {
            riskEvents.push({
                type: 'BIOMETRIC_FAILURE',
                severity: 25,
                timestamp: serverReceiptTime,
                description: 'Face presence not detected during frame capture'
            });
        }

        // 5. Evaluate Adaptive Auth Engine
        const { AdaptiveAuthenticationService } = require('../services/adaptiveAuth.service');
        const decision = await AdaptiveAuthenticationService.evaluateAuthenticationEvent(
            userId,
            sessionId,
            'CONTINUOUS',
            newEvidence,
            riskEvents
        );

        res.json({
            success: decision.nextSessionState === 'ACTIVE',
            sessionStatus: decision.nextSessionState,
            action: decision.action,
            reason: decision.reason,
            requiredFactors: decision.requiredFactors
        });
    } catch (err) {
        next(err);
    }
};
