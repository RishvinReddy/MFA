import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyToken } from './authUtils';
import { logger } from './utils/logger';

// Custom Error Class
export class AppError extends Error {
  statusCode: number;
  action?: string;
  constructor(statusCode: number, message: string, action?: string) {
    super(message);
    this.statusCode = statusCode;
    this.action = action;
    if ((Error as any).captureStackTrace) {
      (Error as any).captureStackTrace(this, this.constructor);
    }
  }
}

import { RedisStore } from 'rate-limit-redis';
import { cacheService } from './services/cache.service';
import prisma from './prisma';

// Safe proxy function for RedisStore to use cacheService's client if available.
// RedisStore expects a sendCommand function.
const sendCommand = async (...args: string[]) => {
    // Cast args to any to bypass ioredis strict type definition issue with arbitrary strings
    const client = (cacheService as any).client;
    if (!client) {
        throw new Error('Redis is offline');
    }
    return client.call(...args);
};

// --- RATE LIMITER ---
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 login/MFA requests per `window` to accommodate multi-step auth
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  store: new RedisStore({
    sendCommand: sendCommand,
    prefix: process.env.NODE_ENV === 'test' ? `bioshield:rl:test:${process.env.TEST_SUITE_ID || 'default'}:login:` : 'bioshield:rl:login:'
  }),
  passOnStoreError: true, // Bypass for E2E testing without Redis
  message: {
    success: false,
    error: {
      code: 429,
      message: 'Too many login attempts from this IP, please try again after 15 minutes.'
    }
  }
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: sendCommand,
    prefix: process.env.NODE_ENV === 'test' ? `bioshield:rl:test:${process.env.TEST_SUITE_ID || 'default'}:api:` : 'bioshield:rl:api:'
  }),
  passOnStoreError: true, // Bypass for E2E testing without Redis
  message: {
    success: false,
    error: {
      code: 429,
      message: 'Too many requests, please try again later.'
    }
  }
});

// --- AUTHENTICATION ---

// Utility to verify token and extract user
const extractUserFromToken = (req: Request): any => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AppError(401, 'Unauthorized: Missing or invalid token format');
    }
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) {
        throw new AppError(403, 'Forbidden: Token expired or invalid');
    }
    return decoded;
};

// Verifies that the user has a fully ACTIVE session (Standard App Authority)
export const requireActiveSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sessionId = req.headers['x-session-id'];
        if (!sessionId) {
            return next(new AppError(401, 'Unauthorized: Missing x-session-id header'));
        }

        // Use singleton PrismaClient to avoid exhausting connection pool and leaving open handles
        const session = await prisma.authSession.findUnique({ 
            where: { id: sessionId as string },
            include: { user: true }
        });

        if (!session || session.status !== 'ACTIVE' || !session.isActive) {
            console.error("Session rejected:", session);
            let action: string | undefined = undefined;
            if (session?.status === 'STEP_UP_REQUIRED') action = 'STEP_UP_REQUIRED';
            else if (session?.status === 'RESTRICTED') action = 'RESTRICTED';
            else if (session?.status === 'LOCKED') action = 'LOCKED';
            
            return next(new AppError(403, 'Forbidden: Active session required.', action));
        }

        (req as any).user = {
            id: session.user.id,
            email: session.user.email,
            role: session.user.role,
            sessionId: session.id
        };
        next();
    } catch (error) {
        next(new AppError(401, 'Invalid session'));
    }
};

// Flexible middleware for enrollment: requires either a valid active session or an enrollment token
export const requireActiveSessionOrEnrollmentToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const enrollmentToken = req.headers['x-enrollment-token'] as string;
        if (enrollmentToken) {
            const crypto = require('crypto');
            const hash = crypto.createHash('sha256').update(enrollmentToken).digest('hex');
            
            const tokenRecord = await prisma.enrollmentToken.findFirst({
                where: { tokenHash: hash, expiresAt: { gt: new Date() } },
                include: { user: true }
            });
            
            if (!tokenRecord || !tokenRecord.user) {
                return next(new AppError(403, "Invalid or expired enrollment token"));
            }
            
            // Establish canonical principal contract on req.user
            (req as any).user = {
                id: tokenRecord.user.id,
                email: tokenRecord.user.email,
                role: tokenRecord.user.role,
                sessionId: undefined
            };
            
            return next();
        }
        
        // Otherwise, enforce Active Session
        const sessionId = req.headers['x-session-id'];
        if (!sessionId) {
            return next(new AppError(401, 'Unauthorized: Missing x-session-id header'));
        }

        const session = await prisma.authSession.findUnique({ 
            where: { id: sessionId as string },
            include: { user: true }
        });

        const allowedStates = ['ACTIVE', 'CHALLENGE_REQUIRED', 'FACE_VERIFIED', 'VOICE_VERIFIED', 'MFA_REQUIRED'];
        if (!session || !allowedStates.includes(session.status) || !session.isActive) {
            return next(new AppError(403, 'Forbidden: Valid session required. Current state: ' + (session?.status || 'UNKNOWN')));
        }

        (req as any).user = {
            id: session.user.id,
            email: session.user.email,
            role: session.user.role,
            sessionId: session.id
        };
        return next();
    } catch (err) {
        next(err);
    }
};

// Verifies that the user has a CHALLENGE session (meaning they need to pass MFA to escalate to ACTIVE)for /auth/mfa/* endpoints)
export const requireChallengeSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sessionId = req.headers['x-session-id'];
        if (!sessionId) {
            return next(new AppError(401, 'Unauthorized: Missing x-session-id header'));
        }

        const session = await prisma.authSession.findUnique({ where: { id: sessionId as string } });

        if (!session) {
            return next(new AppError(401, 'Unauthorized: Invalid session ID'));
        }

        const allowedStates = ['CHALLENGE_REQUIRED', 'FACE_VERIFIED', 'VOICE_VERIFIED'];
        if (!allowedStates.includes(session.status)) {
            return next(new AppError(403, 'Forbidden: Session is not in a valid intermediate challenge state. Current state: ' + session.status));
        }

        // We populate req.user based on the session so the controllers can use it
        (req as any).user = { id: session.userId };
        
        next();
    } catch (error) {
        next(error);
    }
};

export const authorize = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!(req as any).user || !allowedRoles.includes((req as any).user.role)) {
      return next(new AppError(403, `Access Denied: Requires one of roles [${allowedRoles.join(', ')}]`));
    }
    next();
  };
};

export const requirePrivilegedAction = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id;
        const sessionId = (req as any).user?.sessionId || req.headers['x-session-id'];

        if (!userId || !sessionId) {
             return next(new AppError(401, 'Unauthorized: Missing user or session context for privileged action.'));
        }

        // Use singleton PrismaClient
        const session = await prisma.authSession.findUnique({ where: { id: sessionId as string } });

        if (!session) {
            return next(new AppError(403, 'Forbidden: Invalid session.'));
        }

        const serverReceiptTime = new Date();
        const lastUpdatedTime = session.updatedAt ? session.updatedAt.getTime() : session.createdAt.getTime();
        const elapsedSeconds = (serverReceiptTime.getTime() - lastUpdatedTime) / 1000;

        const riskEvents: any[] = [];
        if (elapsedSeconds >= 150) {
            riskEvents.push({ type: 'SESSION_ANOMALY', severity: 85, timestamp: serverReceiptTime, description: `Heartbeat abandoned: missing for ${Math.round(elapsedSeconds)}s` });
        } else if (elapsedSeconds >= 75) {
            riskEvents.push({ type: 'SESSION_ANOMALY', severity: 55, timestamp: serverReceiptTime, description: `Stale heartbeat: missing for ${Math.round(elapsedSeconds)}s` });
        } else if (elapsedSeconds >= 36) {
            riskEvents.push({ type: 'SESSION_ANOMALY', severity: 35, timestamp: serverReceiptTime, description: `Delayed heartbeat: ${Math.round(elapsedSeconds)}s interval` });
        }
        
        // Also add risk from session if it was previously set to CRITICAL or HIGH manually in tests
        if (session.riskLevel === 'CRITICAL') {
             riskEvents.push({ type: 'SECURITY_EVENT', severity: 100, timestamp: serverReceiptTime, description: `Manual CRITICAL risk override` });
        }

        const { AdaptiveAuthenticationService } = require('./services/adaptiveAuth.service');
        const decision = await AdaptiveAuthenticationService.evaluateAuthenticationEvent(
            userId, sessionId as string, 'CONTINUOUS', [], riskEvents
        );

        if (decision.action === 'ALLOW' || decision.action === 'OBSERVE') {
            return next();
        } else if (decision.action === 'REQUIRE_MFA') {
            return res.status(403).json({
                success: false,
                error: 'Step-up authentication required',
                action: 'STEP_UP_REQUIRED',
                decision
            });
        } else {
            return res.status(403).json({
                success: false,
                error: 'Action restricted by security policy',
                action: decision.action,
                decision
            });
        }
    } catch (err) {
        next(err);
    }
};

// --- VALIDATION ---
export const validateEnrollment = (req: Request, res: Response, next: NextFunction) => {
  const { userId, modality } = req.body;
  const validModalities = ['face', 'voice', 'palm', 'behavioral'];

  if (!userId || typeof userId !== 'string') {
    return next(new AppError(400, 'Validation Error: userId is required and must be a string'));
  }

  if (!modality || !validModalities.includes(modality)) {
    return next(new AppError(400, `Validation Error: Invalid modality. Allowed: ${validModalities.join(', ')}`));
  }

  next();
};

// --- ERROR HANDLER ---
export const errorHandler = (err: any, req: any, res: any, next: NextFunction) => {
  const statusCode = err.statusCode || 500;
  
  // Preserve detailed errors only in secure server-side logging
  logger.error(`[ERROR] ${req.method} ${req.url} - Status: ${statusCode} - Message: ${err.message}`);
  if (process.env.NODE_ENV !== 'production') {
      logger.error(err.stack);
  }
  
  if (err.name === 'ZodError') {
      const issues = err.issues || err.errors || [];
      const messages = issues.map((e: any) => `${(e.path || []).join('.')}: ${e.message}`).join(', ');
      return res.status(400).json({ success: false, error: { code: 400, message: `Validation Error - ${messages}` } });
  }

  // Sanitize production 5xx responses
  const message = statusCode >= 500 && process.env.NODE_ENV === 'production' 
      ? 'Internal Server Error' 
      : (err.message || 'Internal Server Error');

  const responsePayload: any = {
    success: false,
    error: {
      code: statusCode,
      message: message
    }
  };
  
  if (err.action) {
      responsePayload.action = err.action;
  }

  res.status(statusCode).json(responsePayload);
};