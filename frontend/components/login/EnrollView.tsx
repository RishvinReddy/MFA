import React, { useState, useEffect } from 'react';
import { LocalProfile, EnrollmentMode } from '../../types';
import { localProfileService } from '../../services/localProfileService';
import { api } from '../../services/api';

// Unified Auth Components
import AuthContainer from '../auth/AuthContainer';
import AccountSetupForm from '../auth/AccountSetupForm';
import FaceModalityPanel from '../auth/FaceModalityPanel';
import VoiceModalityPanel from '../auth/VoiceModalityPanel';
import MfaModalityPanel from '../auth/MfaModalityPanel';
import { AuthStep } from '../auth/StepProgress';

interface EnrollViewProps {
    mode: EnrollmentMode;
    resumeUserId?: string | null;
    resumeEnrollmentToken?: string | null;
    resumeEmail?: string | null;
    onComplete: (profile: LocalProfile) => void;
    onCancel?: () => void;
}

export const EnrollView: React.FC<EnrollViewProps> = ({
    mode,
    resumeUserId,
    resumeEnrollmentToken,
    resumeEmail,
    onComplete,
    onCancel
}) => {
    const [step, setStep] = useState<AuthStep>('IDENTITY');
    const [completedSteps, setCompletedSteps] = useState<AuthStep[]>([]);
    
    // User Context
    const [userId, setUserId] = useState<string>(resumeUserId || '');
    const [enrollmentToken, setEnrollmentToken] = useState<string | null>(resumeEnrollmentToken || null);
    const [userEmail, setUserEmail] = useState<string>(resumeEmail || '');
    const [fullName, setFullName] = useState<string>('Account User');
    const [isResume, setIsResume] = useState<boolean>(mode === 'RESUME');

    // Resume Logic on Mount
    useEffect(() => {
        if (mode === 'RESUME' && resumeEnrollmentToken && resumeUserId) {
            api.getEnrollmentStatus(resumeEnrollmentToken)
                .then(status => {
                    const prof = localProfileService.getProfile(resumeUserId);
                    if (prof) {
                        setFullName(prof.displayName);
                        setUserEmail(prof.email || '');
                    }

                    const done: AuthStep[] = ['IDENTITY'];
                    if (status.faceEnrolled) done.push('FACE');
                    if (status.voiceEnrolled) done.push('VOICE');
                    if (status.recoveryConfigured) done.push('MFA');
                    setCompletedSteps(done);

                    if (!status.faceEnrolled) {
                        setStep('FACE');
                    } else if (!status.voiceEnrolled) {
                        setStep('VOICE');
                    } else if (!status.recoveryConfigured) {
                        setStep('MFA');
                    } else {
                        setStep('COMPLETE');
                    }
                })
                .catch(() => {
                    setStep('IDENTITY');
                });
        }
    }, [mode, resumeEnrollmentToken, resumeUserId]);

    const handleAccountSuccess = (data: { userId: string; enrollmentToken: string; email: string; fullName: string }) => {
        setUserId(data.userId);
        setEnrollmentToken(data.enrollmentToken);
        setUserEmail(data.email);
        setFullName(data.fullName);
        
        // Ensure API client can pick it up for subsequent requests
        sessionStorage.setItem('userId', data.userId);
        sessionStorage.setItem('enrollmentToken', data.enrollmentToken);
        
        // Add to completed steps & advance
        setCompletedSteps(['IDENTITY']);
        setStep('FACE');
    };

    // Step 2 Success Handler (Face)
    const handleFaceSuccess = () => {
        setCompletedSteps(prev => [...prev.filter(s => s !== 'FACE'), 'FACE']);
        setStep('VOICE');
    };

    // Step 3 Success Handler (Voice)
    const handleVoiceSuccess = () => {
        setCompletedSteps(prev => [...prev.filter(s => s !== 'VOICE'), 'VOICE']);
        setStep('MFA');
    };

    // Step 4 Success Handler (MFA)
    const handleMfaSuccess = () => {
        setCompletedSteps(['IDENTITY', 'FACE', 'VOICE', 'MFA']);
        setStep('COMPLETE');

        const nameParts = fullName.split(' ');
        const firstName = nameParts[0] || 'Account';
        const lastName = nameParts.slice(1).join(' ') || 'User';

        // Create local profile record for registry
        const profile = localProfileService.createProfile({
            firstName,
            lastName,
            displayName: fullName,
            email: userEmail,
            role: 'USER',
            userId: userId
        });
        localProfileService.markEnrollmentComplete(profile.id, {
            face: true,
            voice: true
        });

        setTimeout(() => {
            onComplete(profile);
        }, 1500);
    };

    const getNextInstruction = () => {
        switch (step) {
            case 'IDENTITY': return 'Next: Face Verification';
            case 'FACE': return 'Next: Voice Verification';
            case 'VOICE': return 'Next: MFA Setup & Activation';
            case 'MFA': return 'Next: Account Activation';
            case 'COMPLETE': return 'Setup Complete';
        }
    };

    return (
        <AuthContainer
            mode="REGISTRATION"
            currentStep={step}
            completedSteps={completedSteps}
            nextInstruction={getNextInstruction()}
            isRecovery={isResume && step !== 'IDENTITY'}
            recoveryEmail={userEmail}
            completedStepName={completedSteps.length > 0 ? completedSteps[completedSteps.length - 1] : 'Account'}
            nextStepName={step}
            onCancel={onCancel}
        >
            {step === 'IDENTITY' && (
                <AccountSetupForm onSuccess={handleAccountSuccess} onCancel={onCancel} />
            )}

            {step === 'FACE' && (
                <FaceModalityPanel
                    mode="REGISTRATION"
                    userId={userId}
                    enrollmentToken={enrollmentToken || undefined}
                    onSuccess={handleFaceSuccess}
                    onCancel={onCancel}
                />
            )}

            {step === 'VOICE' && (
                <VoiceModalityPanel
                    mode="REGISTRATION"
                    userId={userId}
                    enrollmentToken={enrollmentToken || undefined}
                    onSuccess={handleVoiceSuccess}
                />
            )}

            {step === 'MFA' && (
                <MfaModalityPanel
                    mode="REGISTRATION"
                    userId={userId}
                    enrollmentToken={enrollmentToken || undefined}
                    onSuccess={handleMfaSuccess}
                />
            )}

            {step === 'COMPLETE' && (
                <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 animate-bounce">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Account Fully Activated!</h3>
                    <p className="text-xs text-slate-500 max-w-xs">
                        Your biometrics and MFA recovery have been verified. Launching BioShield Security System...
                    </p>
                </div>
            )}
        </AuthContainer>
    );
};

export default EnrollView;
