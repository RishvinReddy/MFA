import React from 'react';
import { AuthMode } from './StepProgress';
import { FaceScanner } from '../FaceScanner';

interface FaceModalityPanelProps {
    mode: AuthMode;
    userId: string;
    sessionId?: string;
    enrollmentToken?: string;
    onSuccess: () => void;
    onError?: (message: string) => void;
    onCancel?: () => void;
}

export const FaceModalityPanel: React.FC<FaceModalityPanelProps> = ({
    mode,
    userId,
    onSuccess,
    onError,
    onCancel
}) => {
    // In BioShield MFA 2025, Face Verification during login requires the full active
    // challenge-response (liveness) pipeline, which is implemented in FaceScanner.
    return (
        <div className="w-full">
            <FaceScanner
                variant="inline"
                userId={userId}
                profileId={userId}
                mode={mode === 'REGISTRATION' ? 'REGISTRATION' : 'LOGIN'}
                onComplete={(success) => {
                    if (success) {
                        onSuccess();
                    } else if (onError) {
                        onError("Face verification failed.");
                    }
                }}
                onCancel={
                    (onCancel || onError) 
                        ? () => {
                            if (onCancel) onCancel();
                            else if (onError) onError("Face verification cancelled.");
                        } 
                        : undefined
                }
            />
        </div>
    );
};

export default FaceModalityPanel;
