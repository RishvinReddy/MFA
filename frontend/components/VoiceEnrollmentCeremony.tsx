import React, { useState, useRef, useEffect } from 'react';
import {
    Mic, CheckCircle2, AlertTriangle, Loader2, MicOff,
    RefreshCw, Lock, Shield, AudioWaveform
} from 'lucide-react';
import { voiceVerificationService } from '../services/voiceVerificationService';
import { biometricVault } from '../services/biometricVault';

interface VoiceEnrollmentCeremonyProps {
    profileId: string;
    enrollmentToken?: string;
    onEnrollSuccess: () => void;
    onCancel: () => void;
}

const REQUIRED_SAMPLES    = 5;
const RECORDING_DURATION  = 4000; // ms per sample

import { VOICE_CHALLENGE_PHRASES } from '../services/voiceVerificationService';

type SampleStatus = 'IDLE' | 'RECORDING' | 'PROCESSING' | 'DONE' | 'ERROR';

interface SampleState {
    status:  SampleStatus;
    error?:  string;
    token?:  string;
    phrase:  string;
    challengeId?: string;
    nonce?: string;
}

export const VoiceEnrollmentCeremony: React.FC<VoiceEnrollmentCeremonyProps> = ({
    profileId,
    enrollmentToken,
    onEnrollSuccess,
    onCancel,
}) => {
    const [samples, setSamples]             = useState<SampleState[]>(
        Array.from({ length: REQUIRED_SAMPLES }, (_, i) => ({ 
            status: 'IDLE', 
            phrase: VOICE_CHALLENGE_PHRASES[i % VOICE_CHALLENGE_PHRASES.length] 
        }))
    );
    const [currentSample, setCurrentSample] = useState(0);
    const [globalError, setGlobalError]     = useState<string | null>(null);
    const [enrollComplete, setEnrollComplete] = useState(false);
    const [bars, setBars]                   = useState<number[]>(new Array(24).fill(6));
    const [finalizing, setFinalizing]       = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef        = useRef<Blob[]>([]);
    const barIntervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
    const fetchingChallengeRef = useRef<boolean>(false);

    useEffect(() => {
        const fetchCurrentChallenge = async () => {
            if (enrollComplete) return;
            const current = samples[currentSample];
            if (current && current.status === 'IDLE' && !current.challengeId && !fetchingChallengeRef.current) {
                fetchingChallengeRef.current = true;
                try {
                    const result = await voiceVerificationService.fetchChallenge('REGISTRATION');
                    console.log(`[DEBUG] Fetched challenge for Sample ${currentSample + 1}: ${result.challengeId}`);
                    updateSample(currentSample, { 
                        phrase: result.phrase, 
                        challengeId: result.challengeId, 
                        nonce: result.nonce 
                    });
                } catch (e: any) {
                    updateSample(currentSample, { error: 'Failed to fetch challenge phrase.' });
                } finally {
                    fetchingChallengeRef.current = false;
                }
            }
        };
        fetchCurrentChallenge();
    }, [currentSample, samples, enrollComplete]);

    const startVisualizer = () => {
        if (barIntervalRef.current) clearInterval(barIntervalRef.current);
        barIntervalRef.current = setInterval(() => {
            setBars(prev => prev.map(() => Math.random() * 50 + 10));
        }, 80);
    };

    const stopVisualizer = () => {
        if (barIntervalRef.current) clearInterval(barIntervalRef.current);
        setBars(new Array(24).fill(6));
    };

    const updateSample = (index: number, patch: Partial<SampleState>) => {
        setSamples(prev => {
            const next = [...prev];
            next[index] = { ...next[index], ...patch };
            return next;
        });
    };

    const finalizeBatch = async (allSamples: SampleState[]) => {
        setFinalizing(true);
        setGlobalError(null);
        
        const tokens = allSamples.map(s => s.token as string);
        const result = await voiceVerificationService.finalizeEnrollment(profileId, tokens, enrollmentToken);
        
        setFinalizing(false);
        if (result.success) {
            setEnrollComplete(true);
        } else {
            if (result.outlierIndex !== undefined && result.outlierIndex >= 0 && result.outlierIndex < REQUIRED_SAMPLES) {
                updateSample(result.outlierIndex, { status: 'ERROR', error: 'Sample detected as an outlier. Please re-record.' });
                setCurrentSample(result.outlierIndex);
                setGlobalError("One of the recordings varied too much from the others. Please record it again clearly.");
            } else {
                setGlobalError(result.error || "Failed to finalize enrollment");
            }
        }
    };

    const recordSample = async (index: number) => {
        if (samples[index].status !== 'IDLE' || !samples[index].challengeId) return;

        setGlobalError(null);
        updateSample(index, { status: 'RECORDING', error: undefined, token: undefined });

        let stream: MediaStream | null = null;
        try {
            const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '[::1]';
            const canUseMic = window.isSecureContext || isLocalhost;

            if (!canUseMic) {
                throw new Error("NOT_SECURE_CONTEXT");
            }
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("NOT_SECURE_CONTEXT");
            }

            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err: any) {
            const msg = err instanceof Error ? err.message : "Microphone error";
            const lower = msg.toLowerCase();
            let errorText = 'Microphone error.';
            if (lower.includes("not_secure_context") || lower.includes("unavailable") || lower.includes("api") || lower.includes("not supported")) {
                errorText = 'Microphone access requires a secure context or localhost.';
            } else if (lower.includes("denied") || lower.includes("permission") || lower.includes("not allowed")) {
                errorText = 'Microphone permission denied. Please allow microphone access.';
            } else if (lower.includes("not found") || lower.includes("no microphone") || lower.includes("device not found")) {
                errorText = 'No microphone found on your device.';
            } else if (lower.includes("in use") || lower.includes("readable") || lower.includes("could not start") || lower.includes("notreadableerror")) {
                errorText = 'Microphone is currently in use by another application.';
            } else {
                errorText = `Microphone error: ${msg}`;
            }
            updateSample(index, { status: 'ERROR', error: errorText });
            return;
        }

        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
            stopVisualizer();
            stream?.getTracks().forEach(t => t.stop());
            updateSample(index, { status: 'PROCESSING' });

            const result = await voiceVerificationService.validateSample(
                profileId, 
                chunksRef.current, 
                enrollmentToken,
                samples[index].challengeId,
                samples[index].nonce
            );

            if (!result.success || !result.sample) {
                let errorMessage = result.error || "Validation failed";
                if (errorMessage.includes('VOICE_SPEECH_NOT_DETECTED')) {
                    errorMessage = 'No speech was detected. Please speak clearly and try again.';
                } else if (errorMessage.includes('VOICE_PHRASE_MISMATCH')) {
                    errorMessage = 'The spoken phrase did not match. Please repeat the displayed phrase.';
                } else if (errorMessage.includes('VOICE_AUDIO_INVALID')) {
                    errorMessage = 'Audio recording is invalid or too short.';
                } else if (errorMessage.includes('VOICE_EMBEDDING_INVALID')) {
                    errorMessage = 'Could not process your voice. Please record again in a quiet environment.';
                } else if (errorMessage.includes('Invalid or expired challenge')) {
                    errorMessage = 'Challenge expired. Please try again.';
                }
                updateSample(index, { status: 'ERROR', error: errorMessage });
                return;
            }

            updateSample(index, { status: 'DONE', token: result.sample });

            // Check if all samples are DONE (need to use the latest state)
            setSamples(currentSamples => {
                const updated = [...currentSamples];
                updated[index] = { ...updated[index], status: 'DONE', token: result.sample };
                
                const allDone = updated.every(s => s.status === 'DONE' && s.token);
                if (allDone) {
                    finalizeBatch(updated);
                } else {
                    // Find the next IDLE or ERROR sample to record
                    const nextIndex = updated.findIndex(s => s.status === 'IDLE' || s.status === 'ERROR');
                    if (nextIndex !== -1) {
                        setCurrentSample(nextIndex);
                    }
                }
                return updated;
            });
        };

        recorder.start();
        startVisualizer();

        // Auto-stop after RECORDING_DURATION
        setTimeout(() => {
            if (recorder.state !== 'inactive') recorder.stop();
        }, RECORDING_DURATION);
    };

    const handleRetry = (index: number) => {
        updateSample(index, { status: 'IDLE', error: undefined, challengeId: undefined, nonce: undefined });
    };

    const handleRetryAll = async () => {
        // Revoke existing reference and start over
        await voiceVerificationService.revokeEnrollment(profileId);
        setSamples(Array.from({ length: REQUIRED_SAMPLES }, (_, i) => ({ 
            status: 'IDLE',
            phrase: VOICE_CHALLENGE_PHRASES[i % VOICE_CHALLENGE_PHRASES.length]
        })));
        setCurrentSample(0);
        setEnrollComplete(false);
        setGlobalError(null);
    };

    return (
        <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-[32px] p-8 text-slate-900 shadow-xl font-sans mx-auto animate-fade-in">

            {/* Header */}
            <div className="flex items-center justify-between pb-6 border-b border-slate-200">
                <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-violet-50 border border-violet-200 rounded-2xl flex items-center justify-center">
                        <Shield className="w-6 h-6 text-violet-600" />
                    </div>
                    <div>
                        <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                            BioShield Identity Engine
                        </div>
                        <h2 className="text-xl font-extrabold text-slate-900 font-mono">
                            VOICE ENROLLMENT CEREMONY
                        </h2>
                    </div>
                </div>
                <div className="text-xs font-mono font-bold bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl text-slate-700">
                    {enrollComplete ? 'COMPLETE' : `${samples.filter(s => s.status === 'DONE').length} / ${REQUIRED_SAMPLES}`}
                </div>
            </div>

            {/* Phrase box */}
            <div className="my-6 bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center space-y-2">
                <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                    Enrollment Phrase — read aloud for each sample
                </div>
                <p className="text-xl font-mono font-bold text-slate-900">
                    "{samples[currentSample]?.phrase || "BioShield verifies my identity"}"
                </p>
                <p className="text-xs text-slate-500">
                    Speak naturally and clearly. Each recording is {RECORDING_DURATION / 1000} seconds.
                </p>
            </div>

            {/* Visualizer */}
            <div className="h-16 flex items-end justify-center space-x-1 mb-6 bg-slate-50 rounded-xl border border-slate-200 px-4 overflow-hidden">
                {bars.map((h, i) => (
                    <div
                        key={i}
                        className={`w-1.5 rounded-t-sm transition-all duration-75 ${
                            samples[currentSample]?.status === 'RECORDING'
                                ? 'bg-violet-500 shadow-[0_0_6px_#7c3aed]'
                                : 'bg-slate-200'
                        }`}
                        style={{ height: `${h}px` }}
                    />
                ))}
            </div>

            {/* Sample rows */}
            <div className="space-y-3">
                {samples.map((sample, i) => {
                    const isActive   = i === currentSample && !enrollComplete;
                    const isFuture   = i > currentSample && !enrollComplete;

                    return (
                        <div
                            key={i}
                            className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                                sample.status === 'DONE'
                                    ? 'bg-emerald-50 border-emerald-200'
                                    : sample.status === 'ERROR'
                                        ? 'bg-red-50 border-red-200'
                                        : isActive
                                            ? 'bg-violet-50 border-violet-400 shadow-sm'
                                            : 'bg-slate-50 border-slate-200'
                            }`}
                        >
                            <div className="flex items-center space-x-3">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${
                                    sample.status === 'DONE'    ? 'bg-emerald-100 text-emerald-700' :
                                    sample.status === 'ERROR'   ? 'bg-red-100 text-red-700' :
                                    sample.status === 'RECORDING' ? 'bg-violet-100 text-violet-700' :
                                    isActive                    ? 'bg-violet-100 text-violet-600' :
                                    'bg-slate-100 text-slate-400'
                                }`}>
                                    {sample.status === 'DONE'      ? <CheckCircle2 className="w-4 h-4" /> :
                                     sample.status === 'ERROR'     ? <AlertTriangle className="w-4 h-4" /> :
                                     sample.status === 'RECORDING' ? <Mic className="w-4 h-4 animate-pulse" /> :
                                     sample.status === 'PROCESSING'? <Loader2 className="w-4 h-4 animate-spin" /> :
                                     <span>{i + 1}</span>}
                                </div>
                                <div>
                                    <div className={`text-sm font-bold ${
                                        sample.status === 'DONE'  ? 'text-emerald-700' :
                                        sample.status === 'ERROR' ? 'text-red-700' :
                                        isActive                  ? 'text-violet-700' :
                                        'text-slate-500'
                                    }`}>
                                        Sample {i + 1}
                                    </div>
                                    <div className="text-xs text-slate-400 font-medium">
                                        {sample.status === 'DONE'       ? 'Voice sample enrolled' :
                                         sample.status === 'RECORDING'  ? 'Recording… speak now' :
                                         sample.status === 'PROCESSING' ? 'Uploading to biometric engine…' :
                                         sample.error                   ? sample.error :
                                         isFuture                       ? 'Waiting…' :
                                         'Ready to record'}
                                    </div>
                                </div>
                            </div>

                            {/* Action */}
                            <div className="flex-shrink-0">
                                {sample.status === 'IDLE' && isActive && (
                                    <button
                                        type="button"
                                        id={`btn-record-sample-${i}`}
                                        onClick={() => recordSample(i)}
                                        className="flex items-center space-x-2 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-violet-500/20"
                                    >
                                        <Mic className="w-3.5 h-3.5" />
                                        <span>Record</span>
                                    </button>
                                )}
                                {sample.status === 'ERROR' && i === currentSample && (
                                    <button
                                        type="button"
                                        onClick={() => handleRetry(i)}
                                        className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-2 rounded-xl transition-all border border-slate-200"
                                    >
                                        <RefreshCw className="w-3 h-3" />
                                        <span>Retry</span>
                                    </button>
                                )}
                                {sample.status === 'RECORDING' && (
                                    <div className="flex items-center space-x-1.5 text-violet-600 text-xs font-bold">
                                        <AudioWaveform className="w-4 h-4 animate-pulse" />
                                        <span>Recording…</span>
                                    </div>
                                )}
                                {sample.status === 'DONE' && (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Global error */}
            {globalError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-2xl font-medium flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{globalError}</span>
                </div>
            )}

            {/* Complete / controls */}
            <div className="mt-6 pt-5 border-t border-slate-200">
                {enrollComplete ? (
                    <div className="space-y-4 animate-fade-in">
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center space-y-1">
                            <div className="flex items-center justify-center space-x-2 text-emerald-700 font-extrabold text-sm">
                                <CheckCircle2 className="w-5 h-5" />
                                <span>VOICE ENROLLMENT COMPLETE</span>
                            </div>
                            <p className="text-xs text-emerald-600 font-medium">
                                {REQUIRED_SAMPLES} samples averaged into protected voice reference.
                            </p>
                        </div>
                        <button
                            id="btn-voice-enroll-complete"
                            type="button"
                            onClick={onEnrollSuccess}
                            className="w-full flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-4 rounded-2xl text-sm shadow-lg shadow-emerald-600/20 transition-all"
                        >
                            <Lock className="w-4 h-4" />
                            <span>Continue to Voice Verification</span>
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors border border-slate-200"
                        >
                            Cancel
                        </button>
                        {samples.some(s => s.status === 'DONE') && (
                            <button
                                type="button"
                                onClick={handleRetryAll}
                                className="flex items-center space-x-1.5 px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Restart Enrollment</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="mt-5 text-center text-[11px] font-mono text-slate-400">
                Your voice reference is stored only in the local BioShield biometric engine. It never leaves this device.
            </div>
        </div>
    );
};
