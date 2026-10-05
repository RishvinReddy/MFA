import { Request, Response } from 'express';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import prisma from '../prisma';
import { generateToken, generateRefreshToken } from '../authUtils';
import axios from 'axios';
import { logger } from '../utils/logger';
import { cacheService } from '../services/cache.service';

export const setupTotp = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id; // From middleware
        const secret = speakeasy.generateSecret({ name: "BioShield MFA" });

        // upsert secret
        await prisma.totpSecret.upsert({
            where: { userId },
            update: { secret: secret.base32 },
            create: { userId, secret: secret.base32 }
        });

        const qr = await QRCode.toDataURL(secret.otpauth_url!);

        res.json({ success: true, qr });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error setting up TOTP" });
    }
};

export const verifyTotpSetup = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { token } = req.body;

        const record = await prisma.totpSecret.findUnique({ where: { userId } });
        if (!record) return res.status(400).json({ success: false, message: "Setup MFA first" });

        const valid = speakeasy.totp.verify({
            secret: record.secret,
            encoding: "base32",
            token
        });

        if (!valid) return res.status(400).json({ success: false, message: "Invalid code" });

        await prisma.user.update({
            where: { id: userId },
            data: { mfaEnabled: true }
        });

        // Update enrollment state and evaluate completion
        const state = await prisma.enrollmentState.upsert({
            where: { userId },
            update: { recoveryConfigured: true },
            create: { userId, recoveryConfigured: true }
        });

        let isFullyEnrolled = false;
        if (state.passwordEnrolled && state.faceEnrolled && state.voiceEnrolled && state.recoveryConfigured) {
            await prisma.user.update({
                where: { id: userId },
                data: { status: 'ACTIVE' }
            });
            await prisma.enrollmentToken.deleteMany({
                where: { userId }
            });
            isFullyEnrolled = true;
        }

        res.json({ success: true, message: "MFA Enabled", isFullyEnrolled });
    } catch (error) {
        logger.error("verifyTotpSetup Error:", error);
        res.status(500).json({ success: false, message: "Verification failed" });
    }
};

export const sendEmailOtp = async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const record = await prisma.totpSecret.findUnique({ where: { userId } });
        if (!record) return res.status(400).json({ success: false, message: "MFA not set up" });
        const secret = record.secret;

        // Generate current TOTP
        const token = speakeasy.totp({
            secret: secret,
            encoding: "base32"
        });

        logger.debug(`[MFA] Generated OTP for ${user.email}: ${token}`);

        // Send via EmailJS API
        if (process.env.EMAILJS_SERVICE_ID && process.env.EMAILJS_TEMPLATE_ID && process.env.EMAILJS_PUBLIC_KEY) {
            await axios.post('https://api.emailjs.com/api/v1.0/email/send', {
                service_id: process.env.EMAILJS_SERVICE_ID,
                template_id: process.env.EMAILJS_TEMPLATE_ID,
                user_id: process.env.EMAILJS_PUBLIC_KEY,
                accessToken: process.env.EMAILJS_PRIVATE_KEY,
                template_params: {
                    to_email: user.email,
                    email: user.email,
                    user_email: user.email,
                    otp_code: token,
                    message: token,
                    time: "10 minutes",
                    requestTime: new Date().toLocaleString()
                }
            });
            res.json({ success: true, message: "Email sent" });
        } else {
            logger.error("CRITICAL: EmailJS credentials not configured.");
            res.status(500).json({ success: false, message: "Email service not configured" });
        }
    } catch (error) {
        logger.error("EmailJS Error:", error);
        res.status(500).json({ success: false, message: "Failed to send email" });
    }
};

export const verifyEmail = async (req: Request, res: Response) => {
    try {
        const { userId, token } = req.body;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        if (user.emailVerified) {
            return res.status(400).json({ success: false, message: "Email already verified" });
        }

        let secret: string;
        if (user.mfaSecretEnc) {
            const { decrypt } = require('../utils/kms');
            secret = decrypt(user.mfaSecretEnc);
        } else {
            return res.status(400).json({ success: false, message: "MFA secret not found for user" });
        }

        const valid = speakeasy.totp.verify({
            secret: secret,
            encoding: "base32",
            token,
            window: 5 // allows +/- 5 windows (2.5 minutes) for email delivery delay
        });

        if (!valid) return res.status(400).json({ success: false, message: "Invalid verification code" });

        await prisma.user.update({
            where: { id: userId },
            data: { emailVerified: true }
        });

        res.json({ success: true, message: "Email verified successfully" });
    } catch (error) {
        logger.error("Email Verify Error:", error);
        res.status(500).json({ success: false, message: "Verification failed" });
    }
};

export const verifyLoginTotp = async (req: Request, res: Response) => {
    try {
        const { userId, token } = req.body; // userId sent from frontend after first step of login
        const sessionId = req.headers['x-session-id'] as string;

        if (!sessionId) {
            return res.status(401).json({ success: false, message: "Missing x-session-id header" });
        }

        const session = await prisma.authSession.findUnique({ where: { id: sessionId } });
        if (!session) {
            return res.status(404).json({ success: false, message: "Session not found" });
        }

        console.log(`\n[AUTH TRACE][MFA REQUEST]`);
        console.log(`userId=${userId}`);
        console.log(`sessionId=${sessionId}`);
        console.log(`tokenSource=${req.headers.authorization ? 'Bearer JWT' : (req.headers['x-enrollment-token'] ? 'Enrollment Token' : 'None')}`);
        console.log(`sessionExists=${!!session}`);
        console.log(`sessionStatus=${session?.status}`);
        console.log(`----------------------------------------`);

        if (session.status !== 'VOICE_VERIFIED') {
            console.log(`[BIOMETRIC GATE] REJECTED. Expected status VOICE_VERIFIED, got ${session.status}`);
            return res.status(403).json({ success: false, message: "Forbidden: Session has not passed biometric verification." });
        }

        if (session.userId !== userId) {
            return res.status(403).json({ success: false, message: "Forbidden: Session user mismatch." });
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const record = await prisma.totpSecret.findUnique({ where: { userId } });
        if (!record) return res.status(400).json({ success: false, message: "MFA not set up" });
        const secret = record.secret;

        const valid = speakeasy.totp.verify({
            secret: secret,
            encoding: "base32",
            token,
            window: 5 // allows +/- 5 windows (2.5 minutes) for email delivery delay
        });

        if (!valid) return res.status(400).json({ success: false, message: "Invalid code" });

        const { AuthService } = require('../services/auth.service');
        const authService = new AuthService();
        const sessionTokens = await authService.finalizeSession(sessionId, userId, 'TRUSTED');

        res.json({
            success: true,
            status: "ACTIVE",
            accessToken: sessionTokens.accessToken,
            refreshToken: sessionTokens.refreshToken,
            user: sessionTokens.user
        });
    } catch (error) {
        logger.error("verifyLoginTotp Error:", error);
        res.status(500).json({ success: false, message: "Verification failed" });
    }
};
// --- PRE-REGISTRATION EMAIL VERIFICATION ---
// import { cacheService } from '../services/cache.service'; // Ensure this is imported at the top of the file if not already.

export const sendPreRegOtp = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: "Email required" });

        // Generate a random 6-digit OTP
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        const cacheKey = `bioshield:otp:prereg:${email}`;
        // Store for 5 minutes (300 seconds), initialize attempts to 0
        await cacheService.set(cacheKey, JSON.stringify({ code, attempts: 0 }), 300);

        logger.debug(`[PRE-REG MFA] Generated OTP for ${email}: ${code}`);

        if (process.env.EMAILJS_SERVICE_ID && process.env.EMAILJS_TEMPLATE_ID && process.env.EMAILJS_PUBLIC_KEY) {
            await axios.post('https://api.emailjs.com/api/v1.0/email/send', {
                service_id: process.env.EMAILJS_SERVICE_ID,
                template_id: process.env.EMAILJS_TEMPLATE_ID,
                user_id: process.env.EMAILJS_PUBLIC_KEY,
                accessToken: process.env.EMAILJS_PRIVATE_KEY,
                template_params: {
                    to_email: email,
                    email: email,
                    user_email: email,
                    otp_code: code,
                    message: code,
                    otp: code,
                    code: code,
                    verification_code: code,
                    time: "5 minutes",
                    requestTime: new Date().toLocaleString()
                }
            });
            res.json({ success: true, message: "Verification code sent" });
        } else {
            logger.error("CRITICAL: EmailJS credentials not configured for pre-reg OTP.");
            res.status(500).json({ success: false, message: "Email service not configured" });
        }
    } catch (error) {
        logger.error("Pre-Reg EmailJS Error:", error);
        res.status(500).json({ success: false, message: "Failed to send verification email" });
    }
};

export const verifyPreRegOtp = async (req: Request, res: Response) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) return res.status(400).json({ success: false, message: "Email and code required" });

        const cacheKey = `bioshield:otp:prereg:${email}`;
        const result = await cacheService.verifyOtp(cacheKey, code, 3);

        if (result === 'NOT_FOUND') {
            return res.status(400).json({ success: false, message: "Verification code expired or not requested" });
        }

        if (result === 'TOO_MANY_ATTEMPTS') {
            return res.status(400).json({ success: false, message: "Too many failed attempts. Request a new code." });
        }

        if (result === 'INVALID_CODE') {
            return res.status(400).json({ success: false, message: "Invalid verification code" });
        }

        if (result === 'ERROR') {
            return res.status(500).json({ success: false, message: "Verification unavailable" });
        }

        // result === 'SUCCESS'
        res.json({ success: true, message: "Email verified successfully" });
    } catch (error) {
        logger.error("Pre-Reg Verify Error:", error);
        res.status(500).json({ success: false, message: "Verification failed" });
    }
};
