import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const CHALLENGE_VOCABULARY = ['TURN_LEFT', 'TURN_RIGHT'];
const VOICE_VOCABULARY = [
    'blue river',
    'green mountain',
    'secure access',
    'open the vault',
    'digital shield'
];
const EXPIRY_SECONDS = 120;

export type ChallengeAction = 'TURN_LEFT' | 'TURN_RIGHT';

export interface LivenessChallenge {
    challengeId: string;
    nonce: string;
    sessionId: string;
    sequence: ChallengeAction[];
    issuedAt: string;
    expiresAt: string;
    consumed: boolean;
}

export class ChallengeService {
    /**
     * Generates a random sequence of 1 to 3 actions.
     */
    private static generateRandomSequence(): ChallengeAction[] {
        const length = Math.floor(Math.random() * 3) + 1; // 1 to 3 challenges
        const sequence: ChallengeAction[] = [];
        
        for (let i = 0; i < length; i++) {
            // Pick a random action
            let action = CHALLENGE_VOCABULARY[Math.floor(Math.random() * CHALLENGE_VOCABULARY.length)] as ChallengeAction;
            // Prevent consecutive duplicates
            while (sequence.length > 0 && sequence[sequence.length - 1] === action) {
                action = CHALLENGE_VOCABULARY[Math.floor(Math.random() * CHALLENGE_VOCABULARY.length)] as ChallengeAction;
            }
            sequence.push(action);
        }
        
        return sequence;
    }

    /**
     * Creates a new liveness challenge for a session or user (enrollment).
     */
    static async createChallenge(sessionId?: string, userId?: string): Promise<LivenessChallenge> {
        if (!sessionId && !userId) {
            throw new Error('Must provide either sessionId or userId to bind the challenge.');
        }

        const nonce = crypto.randomBytes(16).toString('hex');
        
        // Enrollment (userId) gets a strict 2-step challenge sequence.
        // Login (sessionId) gets a randomized sequence.
        let sequence = this.generateRandomSequence();
        if (userId) {
            sequence = Math.random() > 0.5 ? ['TURN_LEFT', 'TURN_RIGHT'] : ['TURN_RIGHT', 'TURN_LEFT'];
        }

        const expiresAt = new Date(Date.now() + EXPIRY_SECONDS * 1000);

        const challenge = await prisma.livenessChallenge.create({
            data: {
                nonce,
                sequence: JSON.stringify(sequence),
                expiresAt,
                sessionId,
                userId
            }
        });

        return {
            challengeId: challenge.id,
            nonce: challenge.nonce,
            sessionId: challenge.sessionId || '',
            sequence,
            issuedAt: challenge.createdAt.toISOString(),
            expiresAt: challenge.expiresAt.toISOString(),
            consumed: challenge.isConsumed
        };
    }

    /**
     * Creates a new voice liveness challenge.
     */
    static async createVoiceChallenge(sessionId?: string, userId?: string): Promise<{challengeId: string, nonce: string, phrase: string, expiresAt: string}> {
        if (!sessionId && !userId) {
            throw new Error('Must provide either sessionId or userId to bind the challenge.');
        }

        const nonce = crypto.randomBytes(16).toString('hex');
        
        // Pick a random phrase
        const phrase = VOICE_VOCABULARY[Math.floor(Math.random() * VOICE_VOCABULARY.length)];

        const expiresAt = new Date(Date.now() + EXPIRY_SECONDS * 1000);

        const challenge = await prisma.livenessChallenge.create({
            data: {
                nonce,
                sequence: JSON.stringify([phrase]), // store phrase as a single element array
                expiresAt,
                sessionId,
                userId
            }
        });

        return {
            challengeId: challenge.id,
            nonce: challenge.nonce,
            phrase,
            expiresAt: challenge.expiresAt.toISOString()
        };
    }

    /**
     * Verifies the challenge exists, matches session, isn't expired, and consumes it.
     */
    static async verifyAndConsumeChallenge(challengeId: string, nonce: string, sessionId?: string, userId?: string) {
        const challenge = await prisma.livenessChallenge.findUnique({
            where: { id: challengeId }
        });

        if (!challenge) {
            throw new Error('Challenge not found.');
        }

        if (challenge.nonce !== nonce) {
            throw new Error('Invalid nonce.');
        }

        if (challenge.isConsumed) {
            throw new Error('Challenge already consumed.');
        }

        if (new Date() > challenge.expiresAt) {
            throw new Error('Challenge expired.');
        }

        if (sessionId && challenge.sessionId !== sessionId) {
            throw new Error('Challenge session mismatch.');
        }

        if (userId && challenge.userId !== userId) {
            throw new Error('Challenge user mismatch.');
        }

        // Consume it atomically
        const updateResult = await prisma.livenessChallenge.updateMany({
            where: { id: challengeId, isConsumed: false, nonce: nonce },
            data: { isConsumed: true }
        });

        if (updateResult.count === 0) {
            throw new Error('Challenge already consumed or concurrent update occurred.');
        }

        return {
            success: true,
            sequence: JSON.parse(challenge.sequence) as string[]
        };
    }
}
