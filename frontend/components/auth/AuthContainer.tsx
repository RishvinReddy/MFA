import React from 'react';
import { AuthStep, AuthMode, StepProgress } from './StepProgress';
import { AuthHeader } from './AuthHeader';
import { RecoveryNotice } from './RecoveryNotice';
import { Shield } from 'lucide-react';

interface AuthContainerProps {
    mode: AuthMode;
    currentStep: AuthStep;
    completedSteps: AuthStep[];
    title?: string;
    description?: string;
    nextInstruction?: string;
    isRecovery?: boolean;
    recoveryEmail?: string;
    completedStepName?: string;
    nextStepName?: string;
    onContinueRecovery?: () => void;
    children: React.ReactNode;
    onCancel?: () => void;
    variant?: 'card' | 'transparent';
    hideHeader?: boolean;
}

export const AuthContainer: React.FC<AuthContainerProps> = ({
    mode,
    currentStep,
    completedSteps,
    title,
    description,
    nextInstruction,
    isRecovery = false,
    recoveryEmail,
    completedStepName,
    nextStepName,
    onContinueRecovery,
    children,
    onCancel,
    variant = 'card',
    hideHeader = false
}) => {
    return (
        <div className="w-full h-full max-w-full mx-auto">
            <div className={`transition-all duration-300 w-full h-full flex flex-col ${
                variant === 'card' 
                    ? 'bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-3xl shadow-2xl overflow-hidden' 
                    : 'bg-transparent'
            }`}>
                {/* Header Brand Bar */}
                {!hideHeader && (
                    <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 rounded-t-3xl">
                        <div className="flex items-center space-x-2.5">
                        <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-1.5 rounded-lg shadow-sm">
                            <Shield className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold text-sm tracking-tight">
                            BioShield<span className="text-blue-400">.ID</span>
                        </span>
                    </div>

                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700">
                        {mode === 'REGISTRATION' ? 'Account Registration' : isRecovery ? 'Setup Recovery' : 'Secure Login'}
                    </div>
                </div>
                )}

                {/* Main Content Area */}
                <div className="p-6 md:p-8 flex-1 flex flex-col">
                    {/* Stepper */}
                    <StepProgress mode={mode} currentStep={currentStep} completedSteps={completedSteps} />

                    {/* Step Title & Guidance */}
                    <AuthHeader
                        mode={mode}
                        currentStep={currentStep}
                        title={title}
                        description={description}
                        nextInstruction={nextInstruction}
                    />

                    {/* Optional Recovery Banner */}
                    {isRecovery && (
                        <RecoveryNotice
                            email={recoveryEmail}
                            completedStepName={completedStepName}
                            nextStepName={nextStepName}
                            onContinue={onContinueRecovery}
                        />
                    )}

                    {/* Step Content Slot */}
                    <div className="mt-4 flex-1 flex flex-col items-center justify-center">
                        <div className="w-full max-w-2xl">
                            {children}
                        </div>
                    </div>

                    {/* Footer Actions */}
                    {onCancel && (
                        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
                            <button
                                onClick={onCancel}
                                className="text-xs text-slate-400 hover:text-slate-600 font-semibold transition-colors"
                            >
                                Cancel & Return to Login
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuthContainer;
