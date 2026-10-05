import React from 'react';
import { AuthMode } from './StepProgress';
import { VoiceScanner } from '../VoiceScanner';

interface VoiceModalityPanelProps {
    mode: AuthMode;
    userId: string;
    sessionId?: string;
    enrollmentToken?: string;
    onSuccess: () => void;
    onError?: (message: string) => void;
}

/**
 * Thin delegation wrapper around VoiceScanner — the canonical Phase 4
 * challenge-response voice verifier. Mirrors the same pattern used by
 * FaceModalityPanel → FaceScanner.
 *
 * The previous implementation called `voiceVerificationService.getChallengPhrase()`
 * which no longer exists after Phase 4 was introduced, causing a white-screen crash.
 */
export const VoiceModalityPanel: React.FC<VoiceModalityPanelProps> = ({
    mode,
    userId,
    enrollmentToken,
    onSuccess,
    onError,
}) => {
    return (
        <div className="w-full">
            <VoiceScanner
                mode={mode === 'RECOVERY' ? 'LOGIN' : mode}
                userId={userId}
                enrollmentToken={enrollmentToken}
                securityLevel="HIGH"
                onComplete={(success) => {
                    if (success) {
                        onSuccess();
                    } else if (onError) {
                        onError('Voice verification failed.');
                    }
                }}
            />
        </div>
    );
};

export default VoiceModalityPanel;
