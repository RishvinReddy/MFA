import { Request, Response, NextFunction } from 'express';
import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { AuthenticatorTransport } from '@simplewebauthn/typescript-types';
import prisma from '../prisma';
import { AppError } from '../middleware';
import { cacheService } from '../services/cache.service';

const RP_NAME = 'BioShield MFA';
const RP_ID = 'localhost';
const ORIGIN = 'http://localhost:5173';

export const generateRegistrationOptionsHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id;
        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user) throw new AppError(404, "User not found");

        const userCredentials = await prisma.webAuthnCredential.findMany({
            where: { userId }
        });

        const options = await generateRegistrationOptions({
            rpName: RP_NAME,
            rpID: RP_ID,
            userID: userId,
            userName: user.email,
            // Don't exclude credentials we want to allow multiple passkeys needed?
            // Usually we exclude existing credentials to prevent re-registration of same authenticator
            excludeCredentials: userCredentials.map((cred: any) => ({
                id: cred.credentialId,
                type: 'public-key',
                transports: [] as AuthenticatorTransport[],
            })),
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'preferred',
                authenticatorAttachment: 'platform', // TouchID/Windows Hello
            },
        });

        // Save challenge to Redis
        await cacheService.set(`bioshield:webauthn:challenge:${userId}`, options.challenge);

        res.json(options);
    } catch (err) {
        next(err);
    }
};

export const verifyRegistrationHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id;
        const body = req.body;

        const expectedChallenge = await cacheService.get(`bioshield:webauthn:challenge:${userId}`);
        if (!expectedChallenge) throw new AppError(400, "Challenge expired or invalid");

        const verification = await verifyRegistrationResponse({
            response: body,
            expectedChallenge,
            expectedOrigin: ORIGIN,
            expectedRPID: RP_ID,
        });

        if (verification.verified && verification.registrationInfo) {
            const { credentialID, credentialPublicKey, counter, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

            await prisma.webAuthnCredential.create({
                data: {
                    userId,
                    credentialId: Buffer.from(credentialID).toString('base64url'),
                    publicKey: Buffer.from(credentialPublicKey).toString('base64'),
                    counter
                }
            });

            // Ensure MFA method is enabled
            // Ensure MFA method is enabled
            await prisma.user.update({
                where: { id: userId },
                data: { mfaEnabled: true }
            });

            const consumed = await cacheService.compareAndDelete(`bioshield:webauthn:challenge:${userId}`, expectedChallenge);
            if (!consumed) throw new AppError(400, "Challenge already consumed or invalid");
            res.json({ success: true, verified: true });
        } else {
            throw new AppError(400, "Verification failed");
        }
    } catch (err) {
        next(err);
    }
};

export const generateAuthenticationOptionsHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // For login, we might identify user by email first? 
        // Or for username-less ("discoverable credential"), we don't need user ID yet.
        // But typical flow: Enter email -> Check availability -> Generate options.
        const { email } = req.body;

        // If Passkey Login (Autofill), we might not have email.
        // But let's assume 'Enter Email' step first for now.
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) throw new AppError(404, "User not found");

        const userCredentials = await prisma.webAuthnCredential.findMany({
            where: { userId: user.id }
        });

        const options = await generateAuthenticationOptions({
            rpID: RP_ID,
            allowCredentials: userCredentials.map((cred: any) => ({
                id: cred.credentialId,
                type: 'public-key',
                transports: cred.transports as AuthenticatorTransport[],
            })),
        });

        await cacheService.set(`bioshield:webauthn:challenge:${user.id}`, options.challenge);
        // Return userId implicitly via state or handled in verify
        res.json({ options, userId: user.id }); // Frontend needs to track userId
    } catch (err) {
        next(err);
    }
};

export const verifyAuthenticationHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId, response } = req.body;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new AppError(404, "User not found");

        const expectedChallenge = await cacheService.get(`bioshield:webauthn:challenge:${userId}`);
        if (!expectedChallenge) throw new AppError(400, "Challenge expired");

        const credential = await prisma.webAuthnCredential.findFirst({
            where: { userId, credentialId: response.id }
        });

        if (!credential) throw new AppError(400, "Credential not found");

        // Convert stored base64 public key back to Uint8Array/Buffer
        const publicKeyBuffer = Buffer.from(credential.publicKey, 'base64');
        // Uint8Array for library
        const publicKeyUint8 = new Uint8Array(publicKeyBuffer);

        const verification = await verifyAuthenticationResponse({
            response: response,
            expectedChallenge,
            expectedOrigin: ORIGIN,
            expectedRPID: RP_ID,
            authenticator: {
                credentialID: new Uint8Array(Buffer.from(credential.credentialId, 'base64url')),
                credentialPublicKey: publicKeyUint8,
                counter: credential.counter,
            },
        });

        if (verification.verified) {
            // Update counter
            await prisma.webAuthnCredential.update({
                where: { credentialId: credential.credentialId },
                data: { counter: verification.authenticationInfo.newCounter }
            });

            const consumed = await cacheService.compareAndDelete(`bioshield:webauthn:challenge:${userId}`, expectedChallenge);
            if (!consumed) throw new AppError(400, "Challenge already consumed or invalid");

            // Generate Tokens (Same logic as login)
            // ... (We should refactor token generation to a service to reuse here)
            // For now, mocking response instructions or reusing auth controller logic (requires refactor).
            // Let's just return success for Phase 5 verification and we'll integrate token issue next.
            res.json({ success: true, userId: user.id, message: "Use existing auth logic to issue tokens" });
        } else {
            throw new AppError(400, "Authentication failed");
        }
    } catch (err) {
        next(err);
    }
};

// Removed simple in-memory store. In production, using Redis.
