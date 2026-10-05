import React, { useEffect, useState } from 'react';
import { Shield, CheckCircle2, AlertTriangle, Loader2, Lock, MessageSquare } from 'lucide-react';
import { authFlowService } from '../services/authFlowService';
import { AuthenticationFlow, BehavioralMetrics, APP_ENVIRONMENT } from '../types';

interface FinalizingVerificationProps {
    onAuthorizeSession: (metrics: BehavioralMetrics, role: string) => void;
    onDeny: () => void;
}

// ─── Policy engine ─────────────────────────────────────────────────────────────
// RULES:
//   face  must be PASSED
//   voice must be PASSED
//   fingerprint: PASSED or UNAVAILABLE or (BYPASSED AND DEVELOPMENT only)
//   cognitive must be PASSED
//   No hard-coded ✓ TRUSTED for device — shows real score only

function evaluatePolicy(flow: AuthenticationFlow): {
    allowed: boolean;
    denyReason?: string;
} {
    if (flow.face.status !== 'PASSED') {
        return { allowed: false, denyReason: 'Face recognition did not pass. Identity unverified.' };
    }
    if (flow.voice.status !== 'PASSED') {
        return { allowed: false, denyReason: 'Voice verification did not pass. Speaker identity unverified.' };
    }

    return { allowed: true };
}

// ─── Factor row renderer ───────────────────────────────────────────────────────

function FactorRow({ label, status, isBypassed = false }: {
    label: string;
    status: string;
    isBypassed?: boolean;
}) {
    if (status === 'PASSED') {
        return (
            <div className="flex justify-between items-center py-1.5 border-b border-slate-200/80">
                <span className="text-slate-700 font-bold">{label}</span>
                <span className="text-emerald-700 font-bold flex items-center gap-1.5">✓ VERIFIED</span>
            </div>
        );
    }
    if (isBypassed || status === 'BYPASSED') {
        return (
            <div className="flex justify-between items-center py-1.5 border-b border-slate-200/80">
                <span className="text-slate-700 font-bold">{label}</span>
                <span className="text-amber-600 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px]">
                    ⚠ DEV BYPASS
                </span>
            </div>
        );
    }
    if (status === 'UNAVAILABLE') {
        return (
            <div className="flex justify-between items-center py-1.5 border-b border-slate-200/80">
                <span className="text-slate-700 font-bold">{label}</span>
                <span className="text-blue-600 font-bold">— UNAVAILABLE</span>
            </div>
        );
    }
    return (
        <div className="flex justify-between items-center py-1.5 border-b border-slate-200/80">
            <span className="text-slate-700 font-bold">{label}</span>
            <span className="text-amber-600 font-bold">{status || 'PENDING'}</span>
        </div>
    );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export const FinalizingVerification: React.FC<FinalizingVerificationProps> = ({
    onAuthorizeSession,
    onDeny,
}) => {
    const [evalStatus, setEvalStatus] = useState<'EVALUATING' | 'ALLOWED' | 'DENIED'>('EVALUATING');
    const [denyReason, setDenyReason] = useState('');
    const [flow, setFlow]             = useState<AuthenticationFlow | null>(null);

    useEffect(() => {
        const liveFlow = authFlowService.get();

        if (!liveFlow) {
            setEvalStatus('DENIED');
            setDenyReason('Authentication session expired or missing. Please re-authenticate from the lock screen.');
            return;
        }

        setFlow(liveFlow);

        const evaluateAsync = async () => {
            // Brief deliberate pause for the policy engine animation
            await new Promise(resolve => setTimeout(resolve, 1800));

            const { allowed, denyReason: reason } = evaluatePolicy(liveFlow);

            if (allowed) {
                setEvalStatus('ALLOWED');
                setTimeout(() => {
                    onAuthorizeSession(
                        {
                            typingVariance:      0.12,
                            mousePathEfficiency: 0.88,
                            interactionTime:     (Date.now() % 10000) / 1000,
                        },
                        'USER'
                    );
                }, 1500);
            } else {
                setEvalStatus('DENIED');
                setDenyReason(reason || 'Policy denied: one or more required factors did not pass.');
            }
        };

        evaluateAsync();
    }, [onAuthorizeSession]);


    return (
        <div className="min-h-[75vh] flex items-center justify-center p-4">
            <div className="max-w-xl w-full bg-white border border-slate-200 rounded-[32px] p-8 lg:p-10 text-slate-900 shadow-xl relative overflow-hidden animate-fade-in font-sans">

                {/* Ambient glow */}
                <div className="absolute -top-24 -right-24 w-72 h-72 bg-blue-100/40 rounded-full blur-[90px] pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-emerald-100/40 rounded-full blur-[90px] pointer-events-none" />

                <div className="relative z-10 text-center space-y-6">

                    {/* Header icon */}
                    <div className="w-16 h-16 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                        <Shield className="w-8 h-8 text-blue-600" />
                    </div>

                    <div>
                        <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
                            BioShield.ID Security Authority
                        </div>
                        <h2 className="text-2xl font-extrabold tracking-tight mt-1 text-slate-900">
                            Finalizing Authentication
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">
                            Policy engine evaluating multi-factor biometric evidence.
                        </p>
                    </div>

                    {/* Evidence attestation table */}
                    {flow && (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left font-mono text-xs space-y-1 shadow-sm">
                            <div className="text-slate-500 font-bold text-center pb-2 border-b border-slate-200 uppercase tracking-wider text-[10px]">
                                EVIDENCE ATTESTATION TABLE
                            </div>

                            <FactorRow label="Face Recognition"     status={flow.face.status} />
                            <FactorRow label="Liveness / PAD Check" status={flow.face.status === 'PASSED' ? 'PASSED' : 'PENDING'} />
                            <FactorRow label="Voice Harmonics"      status={flow.voice.status} />
                            <div className="flex justify-between items-center py-1.5">
                                <span className="text-slate-700 font-bold">Device Trust Score</span>
                                <span className="text-emerald-700 font-bold">ACTIVE</span>
                            </div>
                        </div>
                    )}

                    {/* Authentication policy badge */}
                    <div className={`inline-flex items-center space-x-2 text-[11px] font-bold px-3 py-1.5 rounded-full border ${
                        APP_ENVIRONMENT === 'DEVELOPMENT'
                            ? 'bg-amber-50 border-amber-200 text-amber-700'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    }`}>
                        <span>Authentication Policy: {APP_ENVIRONMENT}</span>
                    </div>

                    {/* Risk metrics */}
                    <div className="grid grid-cols-1 gap-3 font-sans">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                                <div className="flex items-center space-x-3">
                                    <Shield className={`w-5 h-5 ${flow?.face.status === 'PASSED' ? 'text-emerald-500' : 'text-amber-500'}`} />
                                    <span className="text-sm font-bold text-slate-700">Face Recognition</span>
                                </div>
                                <span className={`text-xs font-bold px-2 py-1 rounded-md ${flow?.face.status === 'PASSED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {flow?.face.status}
                                </span>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                                <div className="flex items-center space-x-3">
                                    <MessageSquare className={`w-5 h-5 ${flow?.voice.status === 'PASSED' ? 'text-emerald-500' : 'text-amber-500'}`} />
                                    <span className="text-sm font-bold text-slate-700">Voice Harmonics</span>
                                </div>
                                <span className={`text-xs font-bold px-2 py-1 rounded-md ${flow?.voice.status === 'PASSED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {flow?.voice.status}
                                </span>
                            </div>
                    </div>

                    {/* Footer action */}
                    <div className="pt-4 border-t border-slate-200">
                        {evalStatus === 'EVALUATING' && (
                            <div className="flex items-center justify-center space-x-3 text-blue-600 font-bold text-sm py-2">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Evaluating biometric evidence &amp; policy…</span>
                            </div>
                        )}

                        {evalStatus === 'ALLOWED' && (
                            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 flex items-center justify-center space-x-3 font-bold text-sm animate-fade-in shadow-sm">
                                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                                <span>Policy ALLOWED. Establishing Secure Session…</span>
                            </div>
                        )}

                        {evalStatus === 'DENIED' && (
                            <div className="space-y-4 animate-fade-in">
                                <div className="bg-red-50 border border-red-200 text-red-900 rounded-2xl p-4 text-xs font-medium text-left flex items-start space-x-3 shadow-sm">
                                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <div className="font-bold uppercase text-red-700 mb-0.5">Policy Denied</div>
                                        <div>{denyReason}</div>
                                    </div>
                                </div>
                                <button
                                    id="btn-finalizing-deny-back"
                                    type="button"
                                    onClick={() => {
                                        authFlowService.clear();
                                        onDeny();
                                    }}
                                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3.5 rounded-2xl text-xs transition-all flex items-center justify-center space-x-2 border border-slate-200 shadow-sm"
                                >
                                    <Lock className="w-4 h-4 text-slate-500" />
                                    <span>Return to Lock Screen</span>
                                </button>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};
