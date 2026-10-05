import prisma from '../prisma';
import { AppError } from '../middleware';
import { generateToken, generateRefreshToken, verifyRefreshToken, hashRefreshToken } from '../authUtils';
import { logEvent } from './audit.service';
import { CryptoService } from './crypto.service';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { registerSchema } from '../validators/auth.validator';

export class AuthService {
    
    // First-Time Admin Setup or Admin-Invited User Enrollment
    async register(data: unknown) {
        const parsed = registerSchema.parse(data);

        const existingUser = await prisma.user.findUnique({
            where: { email: parsed.email },
        });

        if (existingUser && existingUser.status !== 'ENROLLMENT_REQUIRED') {
            throw new AppError(400, "User already exists");
        }

        const passwordHash = await CryptoService.hashPassword(parsed.password);

        const mfaSecret = speakeasy.generateSecret({
            length: 20,
            name: `BioShield (${parsed.email})`,
        });

        const encryptedSecret = CryptoService.encryptTemplate(mfaSecret.base32);

        // Update if exists (from admin invite), else create (primary admin setup)
        const user = await prisma.$transaction(async (tx) => {
            const userData = {
                email: parsed.email,
                fullName: parsed.fullName,
                passwordHash,
                mfaSecretEnc: encryptedSecret,
                mfaEnabled: true,
                emailVerified: true,
                status: "ACTIVE" as any, // Cast to any to bypass TS complaining about Prisma enum if not fully synced
                role: existingUser ? existingUser.role : "PRIMARY_ADMIN" as any
            };

            const dbUser = existingUser 
                ? await tx.user.update({ where: { id: existingUser.id }, data: userData })
                : await tx.user.create({ data: userData });

            await tx.totpSecret.upsert({
                where: { userId: dbUser.id },
                update: { secret: mfaSecret.base32 },
                create: { userId: dbUser.id, secret: mfaSecret.base32 }
            });

            await tx.enrollmentState.upsert({
                where: { userId: dbUser.id },
                update: { passwordEnrolled: true },
                create: { userId: dbUser.id, passwordEnrolled: true }
            });

            await tx.auditLog.create({
                data: {
                    userId: dbUser.id,
                    action: "USER_REGISTERED",
                    metadata: JSON.stringify({ method: "password_setup" }),
                    ipAddress: "127.0.0.1"
                }
            });

            return dbUser;
        });

        const rawToken = CryptoService.generateSecureToken(32);
        const tokenHash = require('crypto').createHash('sha256').update(rawToken).digest('hex');
        
        await prisma.enrollmentToken.create({
            data: {
                userId: user.id,
                tokenHash,
                purpose: "INITIAL_ENROLLMENT",
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
            }
        });

        const qrCode = await QRCode.toDataURL(mfaSecret.otpauth_url!);

        return {
            message: "User registered successfully",
            userId: user.id,
            qrCode,
            enrollmentToken: rawToken
        };
    }
    async login(email: string, password: string, metadata: any) {
        // 1. Find User
        const user = await prisma.user.findUnique({ where: { email } });

        // 1.1 Check if User Exists
        if (!user) {
            await CryptoService.verifyPassword("$argon2id$v=19$m=65536,t=3,p=1$dummy$dummy", password);
            await logEvent({
                action: "LOGIN_FAILED",
                userId: "unknown",
                metadata: { email, reason: "User not found", ip: metadata.ip }
            });
            throw new AppError(401, 'Invalid credentials');
        }

        // 1.2 Account States
        if (user.status === 'DISABLED') {
            throw new AppError(403, "Account disabled");
        }
        if (user.status === 'LOCKED' || (user.lockedUntil && user.lockedUntil > new Date())) {
            throw new AppError(403, "Account locked");
        }

        // 2. Verify Password
        const result = await CryptoService.verifyPassword(user.passwordHash, password);

        if (result.valid && user.status === 'ENROLLMENT_REQUIRED') {
            const rawToken = CryptoService.generateSecureToken(32);
            const tokenHash = require('crypto').createHash('sha256').update(rawToken).digest('hex');

            await prisma.enrollmentToken.deleteMany({ where: { userId: user.id } });

            await prisma.enrollmentToken.create({
                data: {
                    userId: user.id,
                    tokenHash,
                    purpose: "INITIAL_ENROLLMENT",
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
                }
            });

            await logEvent({
                action: "ENROLLMENT_RECOVERY_STARTED",
                userId: user.id,
                metadata: { email, ip: metadata.ip }
            });

            return {
                requiresEnrollment: true,
                userId: user.id,
                enrollmentToken: rawToken
            };
        }        if (!result.valid) {
            const attempts = user.failedAttempts + 1;
            let updateData: any = { failedAttempts: attempts };
            
            if (attempts >= 5) {
                updateData.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
                updateData.status = 'LOCKED';
            }

            await prisma.user.update({ where: { id: user.id }, data: updateData });

            await logEvent({
                action: "LOGIN_FAILED",
                userId: user.id,
                metadata: { email, reason: `Invalid password (Attempt ${attempts}/5)`, ip: metadata.ip }
            });
            throw new AppError(401, 'Invalid credentials');
        }

        // 3. SUCCESSFUL PASSWORD - Reset lockouts & Handle Rehash
        let newPasswordHash = user.passwordHash;
        if (result.needsRehash) {
            newPasswordHash = await CryptoService.hashPassword(password);
            await logEvent({
                action: "PASSWORD_REHASHED",
                userId: user.id,
                metadata: { algorithm: "argon2id" }
            });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { 
                failedAttempts: 0, 
                lockedUntil: null, 
                status: 'ACTIVE',
                ...(result.needsRehash && { passwordHash: newPasswordHash })
            }
        });

        // 4. Create Pre-MFA Session (CHALLENGE_REQUIRED)
        // Adaptive MFA will inspect this session and request Face/Voice.
        const session = await prisma.authSession.create({
            data: {
                userId: user.id,
                ipAddress: metadata.ip || 'unknown',
                device: metadata.device || 'unknown',
                userAgent: metadata.userAgent,
                status: 'CHALLENGE_REQUIRED',
                mfaRequired: true,
                isSuccessful: false,
                isActive: true,
                riskLevel: 'PENDING' // To be updated by Risk Engine
            }
        });

        await logEvent({
            action: "PASSWORD_VERIFIED",
            userId: user.id,
            metadata: { sessionId: session.id, ip: metadata.ip }
        });

        return {
            success: true,
            requiresMfa: true,
            sessionId: session.id, // Client uses this for next step
            userId: user.id,
            message: "Password valid, MFA required."
        };
    }

    // Generate Final Tokens after successful MFA/Fusion
    async finalizeSession(sessionId: string, userId: string, trustState: string) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new AppError(404, "User not found");

        const tokenPayload = { id: user.id, email: user.email, role: user.role, sessionId };
        const accessToken = generateToken(tokenPayload);
        const refreshToken = generateRefreshToken(tokenPayload);
        const refreshTokenHash = hashRefreshToken(refreshToken);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await prisma.authSession.update({
            where: { id: sessionId },
            data: {
                status: 'ACTIVE',
                trustState,
                isSuccessful: true,
                refreshTokenHash,
                expiresAt,
                isActive: true
            }
        });

        return { accessToken, refreshToken, user: tokenPayload };
    }
}
