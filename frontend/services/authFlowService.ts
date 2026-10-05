import { VerificationResult, AuthenticationFlow } from '../types';

const FLOW_KEY = 'bioshield_auth_flow';

export const authFlowService = {
    start(): AuthenticationFlow {
        const newFlow: AuthenticationFlow = {
            flowId: `flow-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            status: 'IN_PROGRESS',
            currentStage: 'FACE',
            face: { status: 'PENDING' },
            voice: { status: 'PENDING' },
            startedAt: Date.now(),
            expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes expiration
        };
        sessionStorage.setItem(FLOW_KEY, JSON.stringify(newFlow));
        return newFlow;
    },

    get(): AuthenticationFlow | null {
        const data = sessionStorage.getItem(FLOW_KEY);
        if (!data) return null;
        try {
            const flow: AuthenticationFlow = JSON.parse(data);
            if (Date.now() > flow.expiresAt) {
                this.clear();
                return null;
            }
            return flow;
        } catch {
            return null;
        }
    },

    completeStage(stage: 'FACE' | 'VOICE', evidence: VerificationResult): AuthenticationFlow | null {
        const flow = this.get();
        if (!flow || flow.status !== 'IN_PROGRESS') return null;

        if (stage === 'FACE') {
            flow.face = evidence;
            if (evidence.status === 'PASSED') flow.currentStage = 'VOICE';
        } else if (stage === 'VOICE') {
            flow.voice = evidence;
            if (evidence.status === 'PASSED') flow.currentStage = 'DECISION';
        }

        sessionStorage.setItem(FLOW_KEY, JSON.stringify(flow));
        return flow;
    },

    clear() {
        sessionStorage.removeItem(FLOW_KEY);
    },

    canAccessStage(targetStage: 'FACE' | 'VOICE' | 'DECISION'): { allowed: boolean; redirect?: string } {
        const flow = this.get();
        if (!flow || flow.status !== 'IN_PROGRESS') {
            return { allowed: false, redirect: '/' };
        }

        if (targetStage === 'FACE') {
            return { allowed: true };
        }
        if (targetStage === 'VOICE') {
            if (flow.face.status !== 'PASSED') return { allowed: false, redirect: '/verify/face' };
            return { allowed: true };
        }
        if (targetStage === 'DECISION') {
            if (flow.face.status !== 'PASSED' || flow.voice.status !== 'PASSED') {
                return { allowed: false, redirect: '/verify/voice' };
            }
            return { allowed: true };
        }

        return { allowed: false, redirect: '/' };
    }
};
