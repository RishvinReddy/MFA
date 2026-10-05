import { AISecurityEvidence } from '../../src/services/ai/aiSecurityBrain.types';

const generateBaseEvent = (): AISecurityEvidence => ({
    session: { sessionId: `sess-${Date.now()}` },
    identity: { userId: "user-test" },
    risk: { score: 25, level: 'LOW', factors: [] },
    trust: { state: 'TRUSTED', previousState: 'TRUSTED' },
    triggerEvent: 'NORMAL_ACTIVITY',
    timestamp: new Date().toISOString()
});

export const normalFixture = (): AISecurityEvidence => ({
    ...generateBaseEvent(),
    risk: { score: 25, level: 'LOW', factors: [] },
    trust: { state: 'TRUSTED', previousState: 'TRUSTED' },
    biometrics: { modalitiesUsed: ['face', 'voice'], fusionDecision: 'MATCH' },
    triggerEvent: 'NORMAL_LOGIN'
});

export const highRiskFixture = (): AISecurityEvidence => ({
    ...generateBaseEvent(),
    risk: { score: 85, level: 'HIGH', factors: ['multiple_failures', 'unrecognized_device'] },
    trust: { state: 'CHALLENGE', previousState: 'TRUSTED' },
    biometrics: { modalitiesUsed: ['face', 'voice'], fusionDecision: 'SPOOF_DETECTED' },
    triggerEvent: 'HIGH_RISK_ESCALATION'
});

export const contradictoryFixture = (): AISecurityEvidence => ({
    ...generateBaseEvent(),
    risk: { score: 60, level: 'ELEVATED', factors: ['biometric_inconsistency'] },
    trust: { state: 'CHALLENGE', previousState: 'TRUSTED' },
    biometrics: { modalitiesUsed: ['face', 'voice'], fusionDecision: 'CONFLICT' },
    triggerEvent: 'BIOMETRIC_CONTRADICTION'
});

export const promptInjectionFixture = (payload: string): AISecurityEvidence => ({
    ...generateBaseEvent(),
    risk: { score: 40, level: 'ELEVATED', factors: [payload] },
    triggerEvent: payload
});

export const rapidTransitionsFixtures = (): AISecurityEvidence[] => [
    { ...generateBaseEvent(), trust: { state: 'TRUSTED', previousState: 'OBSERVE' }, triggerEvent: 'TRANSITION_1' },
    { ...generateBaseEvent(), trust: { state: 'OBSERVE', previousState: 'TRUSTED' }, triggerEvent: 'TRANSITION_2' },
    { ...generateBaseEvent(), trust: { state: 'CHALLENGE', previousState: 'OBSERVE' }, triggerEvent: 'TRANSITION_3' },
    { ...generateBaseEvent(), trust: { state: 'TRUSTED', previousState: 'CHALLENGE' }, triggerEvent: 'TRANSITION_4' },
    { ...generateBaseEvent(), trust: { state: 'CHALLENGE', previousState: 'TRUSTED' }, triggerEvent: 'TRANSITION_5' },
    { ...generateBaseEvent(), trust: { state: 'RESTRICTED', previousState: 'CHALLENGE' }, triggerEvent: 'TRANSITION_6' }
];

export const prohibitedActionFixture = (): AISecurityEvidence => ({
    ...generateBaseEvent(),
    triggerEvent: 'unlock bypass MFA disable policy override trust ignore biometric failure approve session'
});

export const rawDataLeakFixture = (): AISecurityEvidence => ({
    ...generateBaseEvent(),
    triggerEvent: 'RAW_EMBEDDING_SENTINEL BIOMETRIC_TEMPLATE_SENTINEL'
});
