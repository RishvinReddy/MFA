import React from 'react';
import { Check, Shield, User, Camera, Mic, KeyRound } from 'lucide-react';

export type AuthStep = 'IDENTITY' | 'FACE' | 'VOICE' | 'MFA' | 'COMPLETE';
export type AuthMode = 'REGISTRATION' | 'LOGIN' | 'RECOVERY';

interface StepProgressProps {
    mode: AuthMode;
    currentStep: AuthStep;
    completedSteps: AuthStep[];
}

export const StepProgress: React.FC<StepProgressProps> = ({ mode, currentStep, completedSteps }) => {
    const steps: { id: AuthStep; label: string; icon: React.FC<{ className?: string }> }[] = [
        { id: 'IDENTITY', label: mode === 'REGISTRATION' ? 'Account' : 'Identity', icon: User },
        { id: 'FACE', label: 'Face', icon: Camera },
        { id: 'VOICE', label: 'Voice', icon: Mic },
        { id: 'MFA', label: 'MFA', icon: KeyRound },
    ];

    const getStepState = (stepId: AuthStep) => {
        if (completedSteps.includes(stepId)) return 'COMPLETED';
        if (currentStep === stepId) return 'ACTIVE';
        return 'PENDING';
    };

    return (
        <div className="w-full py-4 mb-6 border-b border-slate-100">
            <div className="flex items-center justify-between max-w-md mx-auto relative">
                {/* Connecting background line */}
                <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-slate-200 -translate-y-1/2 z-0"></div>

                {steps.map((step, idx) => {
                    const state = getStepState(step.id);
                    const Icon = step.icon;

                    return (
                        <div key={step.id} className="relative z-10 flex flex-col items-center group">
                            <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 shadow-sm ${
                                    state === 'COMPLETED'
                                        ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                                        : state === 'ACTIVE'
                                        ? 'bg-blue-600 text-white ring-4 ring-blue-100 shadow-blue-500/30 scale-110'
                                        : 'bg-slate-100 text-slate-400 border border-slate-200'
                                }`}
                            >
                                {state === 'COMPLETED' ? (
                                    <Check className="w-5 h-5 stroke-[3]" />
                                ) : (
                                    <Icon className="w-4 h-4" />
                                )}
                            </div>

                            <span
                                className={`mt-2 text-xs font-semibold tracking-wide transition-colors ${
                                    state === 'COMPLETED'
                                        ? 'text-emerald-600 font-bold'
                                        : state === 'ACTIVE'
                                        ? 'text-blue-600 font-bold'
                                        : 'text-slate-400'
                                }`}
                            >
                                {step.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default StepProgress;
