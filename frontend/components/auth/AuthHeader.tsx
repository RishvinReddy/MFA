import React from 'react';
import { AuthStep, AuthMode } from './StepProgress';
import { HelpCircle, ArrowRight } from 'lucide-react';

interface AuthHeaderProps {
    mode: AuthMode;
    currentStep: AuthStep;
    title?: string;
    description?: string;
    nextInstruction?: string;
}

export const AuthHeader: React.FC<AuthHeaderProps> = ({
    mode,
    currentStep,
    title,
    description,
    nextInstruction
}) => {
    const getStepGuidance = () => {
        switch (currentStep) {
            case 'IDENTITY':
                return {
                    where: mode === 'REGISTRATION' ? 'Step 1 of 4 — Create Account' : 'Step 1 of 4 — Account Sign In',
                    why: mode === 'REGISTRATION' ? 'Provide your account details to initiate enrollment.' : 'Verify your email and password credentials.',
                    next: 'Next: Face Verification'
                };
            case 'FACE':
                return {
                    where: 'Step 2 of 4 — Face Verification',
                    why: 'Look into the camera so BioShield can verify your face biometric.',
                    next: 'Next: Voice Verification'
                };
            case 'VOICE':
                return {
                    where: 'Step 3 of 4 — Voice Verification',
                    why: 'Speak the security phrase into your microphone to verify vocal harmonics.',
                    next: 'Next: MFA Verification'
                };
            case 'MFA':
                return {
                    where: 'Step 4 of 4 — Multi-Factor Authentication',
                    why: 'Enter the 6-digit verification code from your authenticator app.',
                    next: mode === 'REGISTRATION' ? 'Next: Complete Activation' : 'Next: Launch Dashboard'
                };
            case 'COMPLETE':
                return {
                    where: 'Verification Complete',
                    why: 'Your identity has been fully authenticated.',
                    next: 'Access Granted'
                };
        }
    };

    const guidance = getStepGuidance();

    return (
        <div className="text-center mb-6">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
                <span>{guidance.where}</span>
            </div>
            
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {title || (currentStep === 'IDENTITY' ? (mode === 'REGISTRATION' ? 'Create Your Account' : 'Account Sign In') : `${currentStep.charAt(0) + currentStep.slice(1).toLowerCase()} Verification`)}
            </h2>

            <p className="text-sm text-slate-600 mt-1 max-w-sm mx-auto leading-relaxed">
                {description || guidance.why}
            </p>

            {nextInstruction && (
                <div className="flex items-center justify-center space-x-1 mt-2 text-xs font-medium text-slate-400">
                    <ArrowRight className="w-3 h-3 text-blue-500" />
                    <span>{nextInstruction}</span>
                </div>
            )}
        </div>
    );
};

export default AuthHeader;
