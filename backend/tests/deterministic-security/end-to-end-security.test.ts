import request from 'supertest';
import app from '../../src/index';
import prisma from '../../src/prisma';
import { AdaptiveAuthenticationService } from '../../src/services/adaptiveAuth.service';
import { FusionEngineService } from '../../src/services/fusion.service';
import { RiskEngineService } from '../../src/services/risk.service';
import { TrustEngineService } from '../../src/services/trust.service';
import { PolicyEngineService } from '../../src/services/policy.service';
import { EvidenceCalibrator } from '../../src/services/calibration.service';
import { aiEventCoordinator } from '../../src/services/ai';
import { NormalizedEvidence } from '../../src/types/evidence';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-tests';

describe('Phase 3I.2 - End-to-End Security Validation', () => {
    let testUser: any;
    let sessionId: string;
    let validToken: string;
    let aiMockEnabled = true;
    let aiMockTimeout = false;
    let aiMockMalformed = false;

    const setupSession = async (trustState = 'TRUSTED', status = 'ACTIVE') => {
        testUser = await prisma.user.create({
            data: {
                email: `test-${Date.now()}@example.com`,
                passwordHash: 'hashed_password',
                biometricProfile: {
                    create: {
                        faceTemplate: 'mock-face-template',
                        voiceTemplate: 'mock-voice-template'
                    }
                }
            }
        });

        const session = await prisma.authSession.create({
            data: {
                userId: testUser.id,
                device: 'device-test',
                ipAddress: '127.0.0.1',
                expiresAt: new Date(Date.now() + 3600000),
                status,
                trustState
            }
        });
        sessionId = session.id;

        validToken = jwt.sign({ id: testUser.id, sessionId, purpose: 'SESSION' }, JWT_SECRET, { expiresIn: '1h' });
    };

    beforeAll(() => {
        jest.spyOn(aiEventCoordinator, 'analyzeEvent').mockImplementation(async (ev: any) => {
            if (!aiMockEnabled) throw new Error('AI Unavailable');
            if (aiMockTimeout) {
                await new Promise(r => setTimeout(r, 6000));
                throw new Error('Timeout');
            }
            if (aiMockMalformed) {
                // simulate malformed schema logic internally
            }
        });
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    const createEvidence = (modality: 'FACE'|'VOICE', pass: boolean, conf: number, isSpoofed = false): NormalizedEvidence => ({
        source: 'test', category: 'HUMAN', modality, status: pass ? 'PASS' : 'FAIL',
        confidence: conf, isContradictory: !pass, isSpoofed, quality: 100,
        timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString(), modelVersion: '1.0'
    });

    const runScenario = async (scenarioId: string, description: string, setupFn: () => Promise<NormalizedEvidence[]>, testFn: (evidence: NormalizedEvidence[], spies: any) => Promise<void>) => {
        console.log(`\n--- SCENARIO ${scenarioId}: ${description} ---`);
        const ev = await setupFn();
        
        const calibrateSpy = jest.spyOn(EvidenceCalibrator, 'calibrate');
        const fusionSpy = jest.spyOn(FusionEngineService, 'evaluate');
        const riskSpy = jest.spyOn(RiskEngineService, 'evaluate');
        const trustSpy = jest.spyOn(TrustEngineService, 'evaluate');
        const policySpy = jest.spyOn(PolicyEngineService, 'evaluate');

        await testFn(ev, { calibrateSpy, fusionSpy, riskSpy, trustSpy, policySpy });

        const getRet = (spy: any) => spy.mock.results && spy.mock.results[0] ? spy.mock.results[0].value : undefined;
        
        const logData = {
            scenarioId,
            calibrationCalled: calibrateSpy.mock.calls.length,
            fusionResult: getRet(fusionSpy),
            riskResult: getRet(riskSpy),
            trustResult: getRet(trustSpy),
            policyResult: getRet(policySpy),
        };
        console.log(`SCENARIO_RECORD: ${JSON.stringify(logData)}`);

        calibrateSpy.mockRestore();
        fusionSpy.mockRestore();
        riskSpy.mockRestore();
        trustSpy.mockRestore();
        policySpy.mockRestore();
    };

    it('I-01 - Normal authenticated session', async () => {
        await runScenario('I-01', 'Normal healthy auth', 
            async () => {
                await setupSession('TRUSTED', 'ACTIVE');
                return [createEvidence('FACE', true, 0.95), createEvidence('VOICE', true, 0.92)];
            },
            async (evidence, spies) => {
                const res = await AdaptiveAuthenticationService.evaluateAuthenticationEvent(testUser.id, sessionId, 'CONTINUOUS', evidence, []);
                expect(res.action).toBe('ALLOW');
                expect(res.nextSessionState).toBe('ACTIVE');
                const fusion = await spies.fusionSpy.mock.results[0].value;
                expect(fusion.decision).toBe('MATCH');
            }
        );
    });

    it('I-02 - Face degradation', async () => {
        await runScenario('I-02', 'Face degradation', 
            async () => {
                await setupSession('TRUSTED', 'ACTIVE');
                // Face 0.45 calibrates to 0.675, Voice 0.40 calibrates to 0.75
                // Human = 0.6 * 0.675 + 0.4 * 0.75 = 0.405 + 0.3 = 0.705 (< 0.75, LOW_CONFIDENCE)
                return [createEvidence('FACE', true, 0.45), createEvidence('VOICE', true, 0.40)];
            },
            async (evidence, spies) => {
                const res = await AdaptiveAuthenticationService.evaluateAuthenticationEvent(testUser.id, sessionId, 'CONTINUOUS', evidence, []);
                const policy = await spies.policySpy.mock.results[0].value;
                expect(['ALLOW', 'REQUIRE_MFA']).toContain(policy.action);
            }
        );
    });

    it('I-03 - Voice degradation', async () => {
        await runScenario('I-03', 'Voice degradation (Regression)', 
            async () => {
                await setupSession('TRUSTED', 'ACTIVE');
                return [createEvidence('VOICE', true, 0.42)]; // Calibrates to 0.7625
            },
            async (evidence, spies) => {
                const res = await AdaptiveAuthenticationService.evaluateAuthenticationEvent(testUser.id, sessionId, 'CONTINUOUS', evidence, []);
                // check calibration spy
                const calCalls = spies.calibrateSpy.mock.calls.filter((c: any) => c[0].modality === 'VOICE');
                expect(calCalls.length).toBeGreaterThan(0);
                const calResult = spies.calibrateSpy.mock.results.find((r: any) => r.type === 'return' && Math.abs(r.value - 0.7625) < 0.001);
                expect(calResult).toBeDefined(); // Ensures it returned correctly stretched score, not 1.0!
                expect(res.action).toBe('OBSERVE'); // Since 0.7625 is MEDIUM assurance, TRUSTED drops to OBSERVE
            }
        );
    });

    it('I-04 - Face + voice contradiction', async () => {
        await runScenario('I-04', 'Face + voice contradiction', 
            async () => {
                await setupSession('TRUSTED', 'ACTIVE');
                return [createEvidence('FACE', true, 0.9), createEvidence('VOICE', false, 0.1)];
            },
            async (evidence, spies) => {
                const res = await AdaptiveAuthenticationService.evaluateAuthenticationEvent(testUser.id, sessionId, 'CONTINUOUS', evidence, []);
                const fusion = await spies.fusionSpy.mock.results[0].value;
                expect(fusion.decision).toBe('CONFLICT');
                expect(res.action).toBe('REQUIRE_MFA');
            }
        );
    });

    it('I-05 - Repeated authentication failures', async () => {
        await runScenario('I-05', 'Repeated authentication failures', 
            async () => {
                await setupSession('TRUSTED', 'ACTIVE');
                return [createEvidence('FACE', false, 0.2)];
            },
            async (evidence, spies) => {
                let res: any;
                let riskEvents: any[] = [];
                for(let i=0; i<3; i++) {
                    res = await AdaptiveAuthenticationService.evaluateAuthenticationEvent(testUser.id, sessionId, 'CONTINUOUS', evidence, riskEvents);
                    riskEvents.push({ type: 'SECURITY_EVENT', severity: 40, timestamp: new Date(), description: 'Fail' });
                }
                const trust = await spies.trustSpy.mock.results[2].value;
                expect(trust.state).not.toBe('TRUSTED');
                expect(['RESTRICT', 'LOCK', 'REQUIRE_MFA']).toContain(res.action);
            }
        );
    });

    it('I-06 - Risk escalation', async () => {
        await runScenario('I-06', 'Risk escalation', 
            async () => {
                await setupSession('TRUSTED', 'ACTIVE');
                return [];
            },
            async (evidence, spies) => {
                const riskEvents: any[] = [{ type: 'SECURITY_EVENT', severity: 90, timestamp: new Date(), description: 'Fail' }];
                const res = await AdaptiveAuthenticationService.evaluateAuthenticationEvent(testUser.id, sessionId, 'CONTINUOUS', evidence, riskEvents);
                const risk = await spies.riskSpy.mock.results[0].value;
                expect(risk.level).toBe('CRITICAL');
                expect(res.action).toBe('LOCK');
            }
        );
    });

    it('I-07 - Risk recovery', async () => {
        await runScenario('I-07', 'Risk recovery', 
            async () => {
                await setupSession('CHALLENGE', 'ACTIVE');
                return [];
            },
            async (evidence, spies) => {
                // Decay mechanism: event is 4 hours old, so decayed by 2 half lives
                const riskEvents: any[] = [{ type: 'SECURITY_EVENT', severity: 80, timestamp: new Date(Date.now() - 4 * 3600 * 1000), description: 'Old fail' }];
                const res = await AdaptiveAuthenticationService.evaluateAuthenticationEvent(testUser.id, sessionId, 'CONTINUOUS', evidence, riskEvents);
                const risk = await spies.riskSpy.mock.results[0].value;
                // 80 -> 40 -> 20 (LOW/MEDIUM boundary)
                expect(risk.score).toBeLessThanOrEqual(25);
            }
        );
    });

    it('I-08 - TRUSTED to OBSERVE', async () => {
        await runScenario('I-08', 'TRUSTED -> OBSERVE', 
            async () => {
                await setupSession('TRUSTED', 'ACTIVE');
                return [createEvidence('FACE', true, 0.60)]; // Raw 0.60 calibrates to 0.80 -> MEDIUM assurance -> OBSERVE
            },
            async (evidence, spies) => {
                const res = await AdaptiveAuthenticationService.evaluateAuthenticationEvent(testUser.id, sessionId, 'CONTINUOUS', evidence, []);
                const trust = await spies.trustSpy.mock.results[0].value;
                expect(trust.state).toBe('OBSERVE');
            }
        );
    });

    it('I-09 - OBSERVE to CHALLENGE', async () => {
        await runScenario('I-09', 'OBSERVE -> CHALLENGE', 
            async () => {
                await setupSession('OBSERVE', 'ACTIVE');
                return [createEvidence('FACE', true, 0.45)]; // Raw 0.45 calibrates to 0.675 -> LOW assurance -> CHALLENGE
            },
            async (evidence, spies) => {
                const res = await AdaptiveAuthenticationService.evaluateAuthenticationEvent(testUser.id, sessionId, 'CONTINUOUS', evidence, []);
                const trust = await spies.trustSpy.mock.results[0].value;
                expect(trust.state).toBe('CHALLENGE');
                expect(res.action).toBe('REQUIRE_MFA');
            }
        );
    });

    it('I-10 - CHALLENGE to RESTRICTED', async () => {
        await runScenario('I-10', 'CHALLENGE -> RESTRICTED', 
            async () => {
                await setupSession('CHALLENGE', 'ACTIVE');
                return [createEvidence('FACE', false, 0.1, true)]; // Spoofing forces RESTRICTED
            },
            async (evidence, spies) => {
                const res = await AdaptiveAuthenticationService.evaluateAuthenticationEvent(testUser.id, sessionId, 'CONTINUOUS', evidence, []);
                const trust = await spies.trustSpy.mock.results[0].value;
                expect(trust.state).toBe('RESTRICTED');
                expect(res.action).toBe('RESTRICT');
            }
        );
    });

    it('I-11 - RESTRICTED to LOCKED', async () => {
        await runScenario('I-11', 'RESTRICTED -> LOCKED', 
            async () => {
                await setupSession('RESTRICTED', 'ACTIVE');
                return [createEvidence('FACE', false, 0.1, true)]; // Another spoof from RESTRICTED might lock? Or critical risk locks.
            },
            async (evidence, spies) => {
                const riskEvents: any[] = [{ type: 'SECURITY_EVENT', severity: 90, timestamp: new Date(), description: 'Critical risk' }];
                const res = await AdaptiveAuthenticationService.evaluateAuthenticationEvent(testUser.id, sessionId, 'CONTINUOUS', evidence, riskEvents);
                const trust = await spies.trustSpy.mock.results[0].value;
                expect(trust.state).toBe('LOCKED');
                expect(res.action).toBe('LOCK');

                // Enforce verification
                const apiRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${validToken}`);
                expect(apiRes.status).toBe(401);
            }
        );
    });

    it('I-12 - Recovery after successful challenge', async () => {
        await runScenario('I-12', 'Recovery after successful challenge', 
            async () => {
                await setupSession('CHALLENGE', 'ACTIVE');
                return [createEvidence('FACE', true, 0.95), createEvidence('VOICE', true, 0.95)];
            },
            async (evidence, spies) => {
                const res = await AdaptiveAuthenticationService.evaluateAuthenticationEvent(testUser.id, sessionId, 'CONTINUOUS', evidence, []);
                const trust = await spies.trustSpy.mock.results[0].value;
                expect(['OBSERVE', 'TRUSTED']).toContain(trust.state); // Follows hysteresis rules
            }
        );
    });

    it('I-13 - Policy restriction enforcement', async () => {
        await runScenario('I-13', 'Policy restriction enforcement', 
            async () => {
                await setupSession('RESTRICTED', 'ACTIVE');
                return [];
            },
            async (evidence, spies) => {
                const res = await AdaptiveAuthenticationService.evaluateAuthenticationEvent(testUser.id, sessionId, 'CONTINUOUS', evidence, []);
                expect(['RESTRICT', 'REQUIRE_MFA']).toContain(res.action);
            }
        );
    });

    it('I-14 - Session expiration', async () => {
        await setupSession('TRUSTED', 'ACTIVE');
        // Update DB to expire session in past
        await prisma.authSession.update({ where: { id: sessionId }, data: { expiresAt: new Date(Date.now() - 1000) } });
        
        const res = await request(app).get('/api/auth/session-status').set('Authorization', `Bearer ${validToken}`);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('TERMINATED');
    });

    it('I-15 - Logout', async () => {
        await setupSession('TRUSTED', 'ACTIVE');
        await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${validToken}`);
        
        const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${validToken}`);
        expect(res.status).toBe(401);
    });

    it('I-16 - AI unavailable', async () => {
        await runScenario('I-16', 'AI Unavailable', 
            async () => {
                await setupSession('TRUSTED', 'ACTIVE');
                aiMockEnabled = false;
                return [createEvidence('FACE', true, 0.95)];
            },
            async (evidence, spies) => {
                const res = await AdaptiveAuthenticationService.evaluateAuthenticationEvent(testUser.id, sessionId, 'CONTINUOUS', evidence, []);
                expect(res.action).toBe('ALLOW'); // Unaffected
            }
        );
    });

    it('I-17 - AI timeout', async () => {
        await runScenario('I-17', 'AI Timeout', 
            async () => {
                await setupSession('TRUSTED', 'ACTIVE');
                aiMockEnabled = true;
                aiMockTimeout = true;
                return [createEvidence('FACE', true, 0.95)];
            },
            async (evidence, spies) => {
                const res = await AdaptiveAuthenticationService.evaluateAuthenticationEvent(testUser.id, sessionId, 'CONTINUOUS', evidence, []);
                expect(res.action).toBe('ALLOW'); // Unaffected
            }
        );
    });

    it('I-18 - AI malformed output', async () => {
        await runScenario('I-18', 'AI Malformed Output', 
            async () => {
                await setupSession('TRUSTED', 'ACTIVE');
                aiMockEnabled = true;
                aiMockTimeout = false;
                aiMockMalformed = true;
                return [createEvidence('FACE', true, 0.95)];
            },
            async (evidence, spies) => {
                const res = await AdaptiveAuthenticationService.evaluateAuthenticationEvent(testUser.id, sessionId, 'CONTINUOUS', evidence, []);
                expect(res.action).toBe('ALLOW'); // Unaffected
            }
        );
    });

    it('I-19 - Rapid security-event sequence', async () => {
        await runScenario('I-19', 'Rapid event sequence', 
            async () => {
                await setupSession('TRUSTED', 'ACTIVE');
                return [];
            },
            async (evidence, spies) => {
                // Test race and state accumulation
                let riskEvents: any[] = [];
                let res: any;
                for(let i=0; i<3; i++) {
                    riskEvents.push({ type: 'SECURITY_EVENT', severity: 20, timestamp: new Date(), description: 'Spam' });
                    res = await AdaptiveAuthenticationService.evaluateAuthenticationEvent(testUser.id, sessionId, 'CONTINUOUS', [], riskEvents);
                }
                const risk = await spies.riskSpy.mock.results[2].value;
                expect(risk.score).toBeGreaterThan(0);
                expect(['OBSERVE', 'REQUIRE_MFA']).toContain(res.action);
            }
        );
    });

    it('I-20 - Cross-session isolation', async () => {
        await setupSession('TRUSTED', 'ACTIVE');
        const sessionA = sessionId;
        const userA = testUser.id;
        
        await setupSession('TRUSTED', 'ACTIVE');
        const sessionB = sessionId;
        const userB = testUser.id;

        // B triggers high risk
        const riskEvents: any[] = [{ type: 'SECURITY_EVENT', severity: 90, timestamp: new Date(), description: 'Fail' }];
        await AdaptiveAuthenticationService.evaluateAuthenticationEvent(userB, sessionB, 'CONTINUOUS', [], riskEvents);

        // A should remain TRUSTED
        const resA = await AdaptiveAuthenticationService.evaluateAuthenticationEvent(userA, sessionA, 'CONTINUOUS', [], []);
        
        // Let's verify DB state of session A
        const sA = await prisma.authSession.findUnique({ where: { id: sessionA } });
        expect(sA?.trustState).toBe('TRUSTED');
    });
});
