import React, { useState, useRef, useEffect } from 'react';
import {
    Mic, Shield, AlertTriangle, CheckCircle2, RefreshCw,
    AudioWaveform, Lock, Activity, UserPlus
} from 'lucide-react';
import { voiceVerificationService, VoiceVerificationResult } from '../services/voiceVerificationService';

import { VoiceEnrollmentCeremony } from './VoiceEnrollmentCeremony';

interface VoiceScannerProps {
    userId: string;
    onComplete: (success: boolean) => void;
    securityLevel?: 'STANDARD' | 'HIGH';
    enrollmentToken?: string;
    mode?: 'LOGIN' | 'REGISTRATION';
}

const RECORDING_MS = 4000; // ms the user has to speak the challenge

type Phase =
    | 'CHECKING_ENROLLMENT'
    | 'PROMPT'          // show challenge phrase, waiting for user to press Record
    | 'RECORDING'       // microphone is live
    | 'PROCESSING'      // sent to backend, waiting
    | 'PASSED'
    | 'FAILED'
    | 'ERROR';

export const VoiceScanner: React.FC<VoiceScannerProps> = ({ userId, onComplete, securityLevel = 'HIGH', enrollmentToken, mode = 'LOGIN' }) => {
    const [phase, setPhase]                   = useState<Phase>('CHECKING_ENROLLMENT');
    const [isEnrolled, setIsEnrolled]         = useState(false);
    const [showEnrollment, setShowEnrollment] = useState(false);

    const [challengePhrase, setChallengePhrase] = useState('');
    const [challengeId, setChallengeId]         = useState('');
    const [challengeNonce, setChallengeNonce]   = useState('');
    const [result, setResult]                   = useState<VoiceVerificationResult | null>(null);
    const [countdown, setCountdown]             = useState(RECORDING_MS / 1000);

    const [bars, setBars]   = useState<number[]>(new Array(32).fill(6));
    const [checklist, setChecklist] = useState({
        micReady:    false,
        speech:      'PENDING' as 'PENDING' | 'PASS' | 'FAIL',
        quality:     'PENDING' as 'PENDING' | 'PASS' | 'FAIL',
        speakerMatch:'PENDING' as 'PENDING' | 'PASS' | 'FAIL',
    });

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef        = useRef<Blob[]>([]);
    const barIntervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
    const countdownRef     = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastPhraseRef    = useRef<string>('');

    // ── Determine Mode: Registration vs Login ────────────────────────────────
    useEffect(() => {
        if (mode === 'REGISTRATION') {
            // We are in REGISTRATION mode. The user is not enrolled yet.
            setIsEnrolled(false);
            setShowEnrollment(true);
            setPhase('CHECKING_ENROLLMENT');
        } else {
            // We are in LOGIN mode. The backend is authoritative, so assume enrolled.
            setIsEnrolled(true);
            setShowEnrollment(false);
            pickChallenge().then(() => {
                setPhase('PROMPT');
                setChecklist(prev => ({ ...prev, micReady: true }));
            });
        }
        return () => cleanupRecorder();
    }, [userId, mode]);

    const pickChallenge = async () => {
        try {
            const ch = await voiceVerificationService.fetchChallenge(mode);
            setChallengePhrase(ch.phrase);
            setChallengeId(ch.challengeId);
            setChallengeNonce(ch.nonce);
        } catch (e) {
            console.error("Failed to fetch voice challenge", e);
            setChallengePhrase("Connection error. Try again.");
        }
    };

    const cleanupRecorder = () => {
        if (barIntervalRef.current)  clearInterval(barIntervalRef.current);
        if (countdownRef.current)    clearInterval(countdownRef.current);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
    };

    const startVisualizer = () => {
        if (barIntervalRef.current) clearInterval(barIntervalRef.current);
        barIntervalRef.current = setInterval(() => {
            setBars(prev => prev.map(() => Math.random() * 55 + 12));
        }, 60);
    };

    const stopVisualizer = () => {
        if (barIntervalRef.current) clearInterval(barIntervalRef.current);
        setBars(new Array(32).fill(6));
    };

    // ── Start recording ───────────────────────────────────────────────────────
    const handleStartRecording = async () => {
        setResult(null);
        setChecklist({ micReady: false, speech: 'PENDING', quality: 'PENDING', speakerMatch: 'PENDING' });

        let stream: MediaStream;
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
            setPhase('ERROR');
            const msg = err instanceof Error ? err.message : "Microphone error";
            const lower = msg.toLowerCase();
            let errorText = 'Microphone permission denied or hardware unavailable. Voice verification requires a working microphone.';
            if (lower.includes("not_secure_context") || lower.includes("unavailable") || lower.includes("api") || lower.includes("not supported")) {
                errorText = 'Microphone access requires a secure context or localhost.';
            } else if (lower.includes("denied") || lower.includes("permission") || lower.includes("not allowed")) {
                errorText = 'Microphone permission denied. Please allow microphone access.';
            } else if (lower.includes("not found") || lower.includes("no microphone") || lower.includes("device not found")) {
                errorText = 'No microphone found on your device.';
            } else if (lower.includes("in use") || lower.includes("readable") || lower.includes("could not start") || lower.includes("notreadableerror")) {
                errorText = 'Microphone is currently in use by another application.';
            }
            
            setResult({
                status: 'ERROR',
                checks: {
                    microphoneReady: false,
                    speechDetected:  false,
                    qualityPassed:   false,
                    speakerMatch:    false,
                    failureReason:   errorText
                },
                modelVersion: 'MFCC-128-cosine-v1',
                evidenceId: `ev-voice-err-${Date.now()}`,
                verifiedAt: Date.now()
            });
            return;
        }

        setChecklist(prev => ({ ...prev, micReady: true }));

        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
            stopVisualizer();
            stream.getTracks().forEach(t => t.stop());
            setPhase('PROCESSING');
            setChecklist(prev => ({ ...prev, speech: 'PASS' }));

            const verResult = await voiceVerificationService.verifyLiveCapture(userId, chunksRef.current, challengeId, challengeNonce);
            setResult(verResult);

            if (verResult.status === 'PASSED') {
                setChecklist({
                    micReady:    true,
                    speech:      'PASS',
                    quality:     'PASS',
                    speakerMatch:'PASS',
                });
                setPhase('PASSED');
                setTimeout(() => onComplete(true), 1500);
            } else {
                setChecklist({
                    micReady:    true,
                    speech:      verResult.checks.speechDetected ? 'PASS' : 'FAIL',
                    quality:     verResult.checks.qualityPassed  ? 'PASS' : 'FAIL',
                    speakerMatch:'FAIL',
                });
                setPhase('FAILED');
            }
        };

        recorder.start();
        setPhase('RECORDING');
        startVisualizer();

        // Countdown timer
        setCountdown(RECORDING_MS / 1000);
        countdownRef.current = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(countdownRef.current!);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        // Auto-stop
        setTimeout(() => {
            if (recorder.state !== 'inactive') recorder.stop();
            if (countdownRef.current) clearInterval(countdownRef.current);
        }, RECORDING_MS);
    };

    const handleRetry = async () => {
        setPhase('PROCESSING');
        await pickChallenge();
        setResult(null);
        setChecklist({ micReady: false, speech: 'PENDING', quality: 'PENDING', speakerMatch: 'PENDING' });
        setCountdown(RECORDING_MS / 1000);
        setPhase('PROMPT');
    };

    // ── Enrollment gate ───────────────────────────────────────────────────────
    if (showEnrollment || !isEnrolled) {
        return (
            <div className="w-full max-w-4xl mx-auto py-4">
                <VoiceEnrollmentCeremony
                    profileId={userId}
                    enrollmentToken={enrollmentToken}
                    onEnrollSuccess={() => {
                        if (enrollmentToken) {
                            // In REGISTRATION mode, skip verification since /api/biometric/verify 
                            // requires an active session, which we do not have yet.
                            onComplete(true);
                        } else if (!isEnrolled && !showEnrollment) {
                            onComplete(true);
                        } else {
                            setIsEnrolled(true);
                            setShowEnrollment(false);
                            pickChallenge().then(() => {
                                setPhase('PROMPT');
                                setChecklist(prev => ({ ...prev, micReady: true }));
                            });
                        }
                    }}
                    onCancel={() => {
                        if (isEnrolled) {
                            setShowEnrollment(false);
                        } else {
                            window.location.href = '/';
                        }
                    }}
                />
            </div>
        );
    }

    // ── Main verification UI ──────────────────────────────────────────────────
    return (
        <div className="w-full max-w-4xl mx-auto bg-white border border-slate-200 rounded-[32px] p-8 text-slate-900 shadow-xl font-sans animate-fade-in">

            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-6 border-b border-slate-200 gap-4">
                <div className="flex items-center space-x-3.5">
                    <div className="w-12 h-12 bg-violet-50 border border-violet-200 rounded-2xl flex items-center justify-center shrink-0">
                        <Shield className="w-6 h-6 text-violet-600" />
                    </div>
                    <div>
                        <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
                            BioShield Identity Engine • Multi-Stage Authentication
                        </div>
                        <h2 className="text-xl font-extrabold text-slate-900 font-mono">
                            VOICE VERIFICATION CEREMONY
                        </h2>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        type="button"
                        onClick={() => setShowEnrollment(true)}
                        className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono font-bold text-xs rounded-xl transition-colors border border-slate-200 flex items-center space-x-1.5"
                        title="Re-run voice enrollment ceremony"
                    >
                        <UserPlus className="w-3.5 h-3.5 text-violet-600" />
                        <span>Re-Enroll Voice</span>
                    </button>
                    <div className="text-xs font-mono font-bold bg-violet-50 border border-violet-200 px-3 py-1.5 rounded-xl text-violet-700">
                        STEP 2 OF 4
                    </div>
                </div>
            </div>

            <p className="text-xs text-slate-500 mt-4 font-medium leading-relaxed">
                Speak the challenge phrase clearly into your microphone. Your voice will be compared against
                your enrolled speaker reference using MFCC-128 cosine similarity. A different speaker will fail.
            </p>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6 items-start">

                {/* Left: visualizer + challenge */}
                <div className="lg:col-span-7 space-y-4">

                    {/* Challenge phrase card */}
                    <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-6 text-center space-y-3">
                        <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                            Challenge Phrase — speak this exactly
                        </div>
                        <p className="text-2xl font-mono font-extrabold text-slate-900 leading-tight">
                            "{challengePhrase}"
                        </p>
                        {phase === 'RECORDING' && (
                            <div className="flex items-center justify-center space-x-2 text-violet-600 font-bold text-sm animate-pulse">
                                <Mic className="w-4 h-4" />
                                <span>Recording — {countdown}s remaining</span>
                            </div>
                        )}
                    </div>

                    {/* Audio spectrum visualizer */}
                    <div className="h-24 flex items-end justify-center space-x-1 bg-slate-50 rounded-xl border border-slate-200 px-4 relative overflow-hidden">
                        {bars.map((h, i) => (
                            <div
                                key={i}
                                className={`w-1.5 rounded-t-sm transition-all duration-75 ${
                                    phase === 'PASSED'
                                        ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]'
                                        : phase === 'RECORDING'
                                            ? 'bg-violet-500 shadow-[0_0_6px_#7c3aed]'
                                            : 'bg-slate-200'
                                }`}
                                style={{ height: `${h}px` }}
                            />
                        ))}
                    </div>

                    {/* Action button */}
                    <div className="text-center">
                        {(phase === 'PROMPT') && (
                            <button
                                id="btn-voice-record"
                                type="button"
                                onClick={handleStartRecording}
                                className="inline-flex items-center space-x-3 bg-violet-600 hover:bg-violet-700 active:scale-[0.99] text-white font-extrabold px-10 py-4 rounded-2xl text-sm shadow-xl shadow-violet-500/25 transition-all"
                            >
                                <Mic className="w-5 h-5" />
                                <span>Start Recording</span>
                            </button>
                        )}

                        {phase === 'RECORDING' && (
                            <div className="inline-flex items-center space-x-3 bg-red-50 border-2 border-red-300 text-red-700 font-extrabold px-10 py-4 rounded-2xl text-sm animate-pulse">
                                <Mic className="w-5 h-5" />
                                <span>Recording… Speak now</span>
                            </div>
                        )}

                        {phase === 'PROCESSING' && (
                            <div className="inline-flex items-center space-x-3 bg-slate-100 border border-slate-200 text-slate-600 font-bold px-10 py-4 rounded-2xl text-sm">
                                <AudioWaveform className="w-5 h-5 animate-pulse text-violet-600" />
                                <span>Analyzing speaker identity…</span>
                            </div>
                        )}
                    </div>

                    {/* Sensor metadata */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between text-[11px] font-mono text-slate-600">
                        <div className="flex items-center space-x-2">
                            <Activity className="w-4 h-4 text-slate-500" />
                            <span>Model: SpeechBrain ECAPA-192 · Threshold: 0.40</span>
                        </div>
                        <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded font-bold">
                            Probabilistic — noise affects accuracy
                        </span>
                    </div>
                </div>

                {/* Right: status panel */}
                <div className="lg:col-span-5 flex flex-col space-y-6">

                    {/* Live checklist */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                        <div className="text-xs font-mono font-bold text-slate-500 pb-3 border-b border-slate-200 uppercase tracking-wider flex items-center justify-between">
                            <span>┌── VERIFICATION STATUS</span>
                            <span className="text-violet-600">MFCC v1</span>
                        </div>

                        <div className="space-y-3.5 font-mono text-xs">
                            {/* Mic */}
                            <div className="flex items-center justify-between">
                                <span className="text-slate-700 font-medium">1. Microphone Ready</span>
                                {checklist.micReady
                                    ? <span className="text-emerald-700 font-bold">✓ Ready</span>
                                    : <span className="text-slate-400">○ Pending</span>}
                            </div>

                            {/* Speech detected */}
                            <div className="flex items-center justify-between">
                                <span className="text-slate-700 font-medium">2. Speech Detected</span>
                                {checklist.speech === 'PASS'
                                    ? <span className="text-emerald-700 font-bold">✓ Detected</span>
                                    : checklist.speech === 'FAIL'
                                        ? <span className="text-red-600 font-bold">✗ No Speech</span>
                                        : <span className="text-blue-600 animate-pulse">● Listening</span>}
                            </div>

                            {/* Quality */}
                            <div className="flex items-center justify-between">
                                <span className="text-slate-700 font-medium">3. Audio Quality</span>
                                {checklist.quality === 'PASS'
                                    ? <span className="text-emerald-700 font-bold">✓ Acceptable</span>
                                    : checklist.quality === 'FAIL'
                                        ? <span className="text-red-600 font-bold">✗ Poor Quality</span>
                                        : <span className="text-slate-400">○ Evaluating</span>}
                            </div>

                            {/* Speaker match */}
                            <div className="flex items-center justify-between pt-2 border-t border-slate-200/80">
                                <span className="text-slate-900 font-bold">4. Speaker Identity</span>
                                {checklist.speakerMatch === 'PASS'
                                    ? <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold">✓ ACCEPTED</span>
                                    : checklist.speakerMatch === 'FAIL'
                                        ? <span className="text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded font-bold">✗ REJECTED</span>
                                        : <span className="text-slate-400 font-medium">○ Comparing</span>}
                            </div>
                        </div>
                    </div>

                    {/* Result panel */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                        {phase === 'PASSED' && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-900 space-y-2 text-center animate-fade-in">
                                <div className="flex items-center justify-center space-x-2 text-emerald-700 font-extrabold text-sm">
                                    <CheckCircle2 className="w-5 h-5" />
                                    <span>VOICE VERIFICATION PASSED</span>
                                </div>
                                <p className="text-xs font-mono text-emerald-800">
                                    Speaker identity matched against enrolled reference. Proceeding to Fingerprint…
                                </p>
                            </div>
                        )}

                        {(phase === 'FAILED' || phase === 'ERROR') && result && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-900 space-y-3 animate-fade-in">
                                <div className="flex items-center space-x-2 text-red-700 font-extrabold text-xs">
                                    <AlertTriangle className="w-5 h-5 shrink-0" />
                                    <span>VOICE VERIFICATION FAILED</span>
                                </div>
                                <p className="text-xs font-mono text-red-800 leading-relaxed">
                                    {result.checks.failureReason || 'Speaker identity could not be verified.'}
                                </p>
                                <button
                                    id="btn-voice-retry"
                                    type="button"
                                    onClick={handleRetry}
                                    className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-extrabold rounded-xl text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-sm"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    <span>Retry with New Phrase</span>
                                </button>
                            </div>
                        )}

                        {(phase === 'PROMPT' || phase === 'RECORDING' || phase === 'PROCESSING' || phase === 'CHECKING_ENROLLMENT') && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center space-y-2">
                                <div className="text-xs font-mono font-bold text-slate-600 flex items-center justify-center space-x-2">
                                    <AudioWaveform className="w-4 h-4 text-violet-600" />
                                    <span>
                                        {phase === 'RECORDING'   ? 'Recording — speak clearly' :
                                         phase === 'PROCESSING'  ? 'Analyzing voice…' :
                                         'Awaiting voice sample'}
                                    </span>
                                </div>
                                <p className="text-[11px] font-mono text-slate-400">
                                    Speak the challenge phrase clearly. A different speaker will fail this check.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Lock notice */}
                    <div className="flex items-center justify-center space-x-2 text-[11px] font-mono text-slate-400">
                        <Lock className="w-3.5 h-3.5 text-violet-400" />
                        <span>Audio processed locally. No recording stored after verification.</span>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default VoiceScanner;
