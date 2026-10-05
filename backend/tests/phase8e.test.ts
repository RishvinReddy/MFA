import { AdaptiveAuthenticationService } from '../src/services/adaptiveAuth.service';
import { NormalizedEvidence } from '../src/types/evidence';
import prisma from '../src/prisma';

jest.mock('../src/prisma', () => ({
    authSession: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
    },
    user: {
        findUnique: jest.fn(),
    },
    fusionConfiguration: {
        findFirst: jest.fn(),
    }
}));

const createEvidence = (modality: any, category: any, confidence: number, isSpoof: boolean, quality: number = 90): NormalizedEvidence => ({
    source: 'TEST',
    modality,
    category,
    status: 'PASS',
    confidence,
    isSpoofed: isSpoof,
    quality,
    isContradictory: false,
    modelVersion: 'v1.0',
    timestamp: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60000).toISOString()
});

describe('Phase 8E - Risk/Trust Integration', () => {
    let mockSession: any;
    let mockUser: any;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockSession = {
            id: 'session-123',
            userId: 'user-123',
            status: 'ACTIVE',
            trustState: 'TRUSTED'
        };
        
        mockUser = {
            id: 'user-123',
            biometricProfile: {
                faceTemplate: 'some-data',
                voiceTemplate: 'some-data'
            }
        };
        
        (prisma.authSession.findUnique as jest.Mock).mockResolvedValue(mockSession);
        (prisma.authSession.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
        (prisma.fusionConfiguration.findFirst as jest.Mock).mockResolvedValue({
            humanWeight: 0.6,
            deviceWeight: 0.4,
            thresholdMatch: 0.75,
            thresholdObserve: 0.60
        });
    });

    const runAuth = async (evidence: NormalizedEvidence[], riskEvents: any[] = []) => {
        return await AdaptiveAuthenticationService.evaluateAuthenticationEvent('user-123', 'session-123', 'CONTINUOUS', evidence, riskEvents);
    };

    it('1. Genuine user (MATCH -> normal policy)', async () => {
        const evidence: NormalizedEvidence[] = [
            createEvidence('FACE', 'HUMAN', 0.95, false),
            createEvidence('DEVICE_IDENTITY', 'DEVICE', 0.99, false)
        ];
        const decision = await runAuth(evidence);
        expect(decision.action).toBe('ALLOW');
        expect(decision.nextSessionState).toBe('ACTIVE');
    });

    it('2. Different person (CONFLICT -> CHALLENGE -> NOT ALLOW)', async () => {
        const evidence: NormalizedEvidence[] = [
            createEvidence('FACE', 'HUMAN', 0.1, false), // Strong mismatch
            createEvidence('DEVICE_IDENTITY', 'DEVICE', 0.99, false)
        ];
        const decision = await runAuth(evidence);
        expect(decision.action).toBe('REQUIRE_MFA');
        expect(decision.nextSessionState).toBe('CHALLENGE_REQUIRED');
    });

    it('3. Spoof attempt (SPOOF_DETECTED -> RESTRICT -> NOT ALLOW)', async () => {
        const evidence: NormalizedEvidence[] = [
            createEvidence('FACE', 'HUMAN', 0.9, true),
            createEvidence('DEVICE_IDENTITY', 'DEVICE', 0.99, false)
        ];
        const decision = await runAuth(evidence);
        expect(decision.action).toBe('RESTRICT');
        expect(decision.nextSessionState).toBe('RESTRICTED');
    });

    it('4. Repeated spoof (SPOOF #1 -> RESTRICT, SPOOF #2 -> LOCK)', async () => {
        const evidence: NormalizedEvidence[] = [
            createEvidence('FACE', 'HUMAN', 0.9, true)
        ];
        
        // First spoof
        const decision1 = await runAuth(evidence);
        expect(decision1.action).toBe('RESTRICT');
        expect(decision1.nextSessionState).toBe('RESTRICTED');
        
        // Update mock session to reflect restriction
        mockSession.status = 'RESTRICTED';
        mockSession.trustState = 'RESTRICTED';
        
        // Second spoof
        const existingRiskEvents = [{
            type: 'SECURITY_EVENT',
            severity: 70,
            timestamp: new Date(),
            description: 'Spoofing detected by Fusion Engine'
        }];
        const decision2 = await runAuth(evidence, existingRiskEvents);
        expect(decision2.action).toBe('LOCK');
        expect(decision2.nextSessionState).toBe('LOCKED');
    });

    it('5. Poor capture (INSUFFICIENT_EVIDENCE -> CHALLENGE, not treated as impostor)', async () => {
        const evidence: NormalizedEvidence[] = [
            createEvidence('FACE', 'HUMAN', 0.5, false, 30), // Poor quality
            createEvidence('DEVICE_IDENTITY', 'DEVICE', 0.99, false)
        ];
        const decision = await runAuth(evidence);
        expect(decision.action).toBe('REQUIRE_MFA');
        expect(decision.nextSessionState).toBe('CHALLENGE_REQUIRED');
    });

    it('6. Device-only (INSUFFICIENT_EVIDENCE -> CHALLENGE)', async () => {
        const evidence: NormalizedEvidence[] = [
            createEvidence('DEVICE_IDENTITY', 'DEVICE', 0.99, false)
        ];
        const decision = await runAuth(evidence);
        expect(decision.action).toBe('REQUIRE_MFA');
        expect(decision.nextSessionState).toBe('CHALLENGE_REQUIRED');
    });
});
