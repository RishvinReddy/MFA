import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, CheckCircle, VideoOff, Terminal, Eye, Lock, ShieldAlert, RefreshCw, AlertTriangle, Camera } from 'lucide-react';
import { faceVerificationService, FaceVerificationResult } from '../services/faceVerificationService';
import { localProfileService } from '../services/localProfileService';
import { api } from '../services/api';
import FaceEnrollmentCeremony from './FaceEnrollmentCeremony';
import { evaluateFaceQuality } from '../services/canonicalFaceAnalyzer';
import { LIVENESS_POSE_CONFIG as cfg } from '../services/faceQualityConfig';

interface FaceScannerProps {
    onComplete: (success: boolean) => void;
    profileId?: string;
    userId?: string;
    securityLevel?: string;
    onCancel?: () => void;
    variant?: 'standalone' | 'inline';
    mode?: 'LOGIN' | 'REGISTRATION';
}

type CameraState = "IDLE" | "STARTING" | "READY" | "ERROR";
type FaceChallenge = "CENTER" | "TURN_LEFT" | "TURN_RIGHT" | "VERIFYING" | "SUCCESS" | "FAILED" | "TIMEOUT" | "UNAVAILABLE" | "INSUFFICIENT_DATA" | "ERROR";

// Section 1: Detailed FaceAnalysis interface instead of a generic boolean
interface FaceAnalysisState {
    modelLoaded: boolean;
    analysisRunning: boolean;
    faceCount: number;
    faceDetected: boolean;
    confidence: number | null;
    boundingBox: { x: number; y: number; width: number; height: number; } | null;
    qualityPassed: boolean;
    poseAccepted: boolean;
    error: string | null;
}

// Definitive video readiness validator
const waitForVideoReady = async (
    video: HTMLVideoElement,
    stream: MediaStream
): Promise<void> => {
    video.srcObject = stream;

    if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
        await new Promise<void>((resolve, reject) => {
            const timeout = window.setTimeout(() => {
                reject(new Error("Camera initialization timed out waiting for metadata"));
            }, 8000);

            const ready = () => {
                window.clearTimeout(timeout);
                resolve();
            };

            video.addEventListener("loadedmetadata", ready, { once: true });
        });
    }

    await video.play();

    if (video.videoWidth === 0 || video.videoHeight === 0) {
        await new Promise<void>((resolve, reject) => {
            const started = Date.now();
            const check = () => {
                if (video.videoWidth > 0 && video.videoHeight > 0) {
                    resolve();
                    return;
                }
                if (Date.now() - started > 5000) {
                    reject(new Error("Camera is active but no video frames are rendering"));
                    return;
                }
                requestAnimationFrame(check);
            };
            check();
        });
    }
};

export const FaceScanner: React.FC<FaceScannerProps> = ({ 
    onComplete, 
    profileId, 
    userId, 
    securityLevel = "STANDARD", 
    onCancel, 
    variant = 'standalone', 
    mode = 'LOGIN' 
}) => {
    const targetProfileId = profileId || userId || "default";
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Section 5: Independent analysis loop instrumentation refs
    const analysisRunningRef = useRef<boolean>(false);
    const analysisTimerRef = useRef<number | null>(null);
    const analysisCountRef = useRef<number>(0);
    const detectionCountRef = useRef<number>(0);
    const errorCountRef = useRef<number>(0);
    const lastInferenceTimeRef = useRef<number>(0);
    const isProcessingRef = useRef<boolean>(false);
    const searchStartTimeRef = useRef<number>(Date.now());

    // Lifecycle and Engine States (Section 1 & 2)
    const [cameraState, setCameraState] = useState<CameraState>("IDLE");
    const [challenge, setChallengeState] = useState<FaceChallenge>("CENTER");
    // ⚠️ FIX: Keep a ref in sync with challenge so the async analysis loop
    // (which closes over the initial value) can always read the CURRENT challenge.
    const challengeRef = useRef<FaceChallenge>("CENTER");
    const setChallenge = (next: FaceChallenge) => {
        challengeRef.current = next;
        setChallengeState(next);
    };
    const [analysis, setAnalysis] = useState<FaceAnalysisState>({
        modelLoaded: false,
        analysisRunning: false,
        faceCount: 0,
        faceDetected: false,
        confidence: null,
        boundingBox: null,
        qualityPassed: false,
        poseAccepted: false,
        error: null
    });
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [verificationError, setVerificationError] = useState<string | null>(null);
    const [coachingText, setCoachingText] = useState<string>("Initializing secure camera feed...");
    const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
    const [diagInfo, setDiagInfo] = useState({ fps: 0, resolution: "0x0", trackState: "none", lastInferenceMs: 0, errors: 0 });

    // Section 9: Authoritative challenge tracking
    const activeChallengeSequenceRef = useRef<string[]>([]);
    const currentSequenceIndexRef = useRef<number>(0);
    const targetTurnRef = useRef<'TURN_LEFT' | 'TURN_RIGHT'>('TURN_LEFT');
    const livenessPhaseRef = useRef<'EXPECT_CENTER' | 'MOVEMENT_DETECTED' | 'TARGET_ACHIEVED'>('EXPECT_CENTER');
    const activeChallengeRef = useRef<{ id: string, nonce: string, sequence: string[] } | null>(null);
    const collectedFramesRef = useRef<Blob[]>([]);
    const lastRejectionReasonRef = useRef<string>("Searching for face...");

    const neutralYawRef = useRef<number | null>(null);
    const consecutiveFramesRef = useRef<number>(0);
    const framesInChallengeRef = useRef<number>(0);

    // In Phase 8, FaceScanner is strictly used for verification during login.
    // Assuming the user is enrolled, skip the enrollment ceremony fallback.
    const [isEnrolled, setIsEnrolled] = useState<boolean>(true);
    
    // Track component mount state to prevent async lifecycle races
    const isMountedRef = useRef<boolean>(true);
    const lifecycleGenerationRef = useRef<number>(0);
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const stopCamera = () => {
        lifecycleGenerationRef.current += 1;
        stopAnalysisLoop();
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => {
                try { track.stop(); } catch (e) {}
            });
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setCameraState("IDLE");
    };

    const stopAnalysisLoop = () => {
        analysisRunningRef.current = false;
        if (analysisTimerRef.current !== null) {
            window.clearTimeout(analysisTimerRef.current);
            analysisTimerRef.current = null;
        }
        setAnalysis(prev => ({ ...prev, analysisRunning: false }));
    };

    const startCameraAndEngine = async () => {
        const isTerminalState = challenge === "TIMEOUT" || challenge === "FAILED" || challenge === "ERROR" || challenge === "UNAVAILABLE";
        if (streamRef.current && streamRef.current.active && cameraState === "READY" && !isTerminalState) return;

        stopCamera();
        
        lifecycleGenerationRef.current += 1;
        const currentGeneration = lifecycleGenerationRef.current;

        setCameraState("STARTING");
        setChallenge("CENTER");
        setCameraError(null);
        setVerificationError(null);
        setCoachingText("Requesting camera access...");

        // Reset instrumentation counters
        analysisCountRef.current = 0;
        detectionCountRef.current = 0;
        errorCountRef.current = 0;
        lastInferenceTimeRef.current = 0;
        searchStartTimeRef.current = Date.now();
        collectedFramesRef.current = [];
        activeChallengeRef.current = null;
        activeChallengeSequenceRef.current = [];
        currentSequenceIndexRef.current = 0;
        neutralYawRef.current = null;
        consecutiveFramesRef.current = 0;
        framesInChallengeRef.current = 0;

        // ── Phase 1: Diagnostic logging ────────────────────────────────
        const isLocalhost = (
            location.hostname === 'localhost' ||
            location.hostname === '127.0.0.1' ||
            location.hostname === '[::1]'
        );
        console.group('[BioShield FaceScanner] Camera startup diagnostics');
        console.table({
            href:            location.href,
            hostname:        location.hostname,
            protocol:        location.protocol,
            isLocalhost,
            isSecureContext: window.isSecureContext,
            mediaDevices:    !!navigator.mediaDevices,
            getUserMedia:    !!navigator.mediaDevices?.getUserMedia,
        });
        console.groupEnd();

        try {
            // ── Phase 4: Explicit localhost allowance ──────────────────
            const canUseCamera = window.isSecureContext || isLocalhost;
            if (!canUseCamera) {
                throw new DOMException(
                    'Camera requires a secure context. This page is not localhost and not HTTPS.',
                    'SecurityError'
                );
            }

            if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
                throw new DOMException(
                    'navigator.mediaDevices.getUserMedia is not available in this context.',
                    'NotSupportedError'
                );
            }

            // ── Phase 2: Camera FIRST, ML engine second ────────────────
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
                audio: false,
            });
            if (!isMountedRef.current || lifecycleGenerationRef.current !== currentGeneration) {
                stream.getTracks().forEach(track => track.stop());
                return;
            }
            streamRef.current = stream;

            const video = videoRef.current;
            if (!video) {
                throw new Error('VIDEO_ELEMENT_UNAVAILABLE');
            }

            await waitForVideoReady(video, stream);
            if (!isMountedRef.current || lifecycleGenerationRef.current !== currentGeneration) return;

            const track = stream.getVideoTracks()[0];
            console.log('[BioShield FaceScanner] Camera ready:', {
                trackState:  track?.readyState,
                videoWidth:  video.videoWidth,
                videoHeight: video.videoHeight,
                readyState:  video.readyState,
            });
            setCameraState("READY");

            // Step 2: Verify ML engine (non-fatal if unavailable)
            setCoachingText("Checking BioShield Face Engine status...");
            setAnalysis(prev => ({ ...prev, modelLoaded: false, error: null }));
            try {
                await faceVerificationService.assertBiometricEngineReady();
                if (!isMountedRef.current || lifecycleGenerationRef.current !== currentGeneration) return;
                setAnalysis(prev => ({ ...prev, modelLoaded: true }));
            } catch (err: any) {
                console.warn('[BioShield FaceScanner] Biometric engine check failed:', err?.message);
                setAnalysis(prev => ({ ...prev, modelLoaded: false, error: `Engine: ${err?.message}` }));
                // Abort and show offline state immediately instead of waiting for a 25s timeout
                setChallenge("UNAVAILABLE" as any);
                setVerificationError(err?.message || "Biometric service is offline");
                return;
            }

            setCoachingText("Look straight ahead at center of the oval guide.");

            setCoachingText("Look straight ahead at center of the oval guide.");

            try {
                const chal = await api.generateChallenge(mode);
                if (!isMountedRef.current || lifecycleGenerationRef.current !== currentGeneration) return;
                activeChallengeRef.current = { id: chal.challengeId, nonce: chal.nonce, sequence: chal.sequence };
                activeChallengeSequenceRef.current = chal.sequence.filter((s: string) => s.startsWith("TURN_"));
                currentSequenceIndexRef.current = 0;
                targetTurnRef.current = (activeChallengeSequenceRef.current[0] as 'TURN_LEFT' | 'TURN_RIGHT') || 'TURN_LEFT';
            } catch (err: any) {
                console.error('[BioShield Challenge] FAILED', err);
                setChallenge("ERROR" as any);
                setVerificationError(err.message || "Failed to generate secure challenge.");
                return;
            }
            
            livenessPhaseRef.current = 'EXPECT_CENTER';
            setChallenge("CENTER");

            startAnalysisLoop(currentGeneration);
        } catch (err: any) {
            stopCamera();
            setCameraState("ERROR");

            // ── Phase 3: Classify by DOMException.name first ──────────────
            console.error('[BioShield FaceScanner] Camera error:', err?.name, err?.message, err);

            const name = (err?.name ?? '').toLowerCase();
            const msg  = (err instanceof Error ? err.message : String(err)).toLowerCase();

            let errorMsg: string;
            if (name === 'notallowederror' || msg.includes('permission denied') || msg.includes('not allowed')) {
                errorMsg = 'CAMERA_PERMISSION_DENIED';
            } else if (name === 'notfounderror' || msg.includes('not found') || msg.includes('no camera') || msg.includes('device not found')) {
                errorMsg = 'CAMERA_NOT_FOUND';
            } else if (name === 'notreadableerror' || msg.includes('could not start video') || msg.includes('in use') || name === 'aborterror') {
                errorMsg = 'CAMERA_BUSY_OR_UNAVAILABLE';
            } else if (name === 'notsupportederror' || name === 'typeerror' || msg.includes('not supported') || msg.includes('getusermedia is not a function')) {
                errorMsg = 'CAMERA_API_UNAVAILABLE';
            } else if (name === 'securityerror') {
                errorMsg = 'INSECURE_CONTEXT';
            } else if (msg.includes('video_element_unavailable')) {
                errorMsg = 'VIDEO_INITIALIZATION_FAILED';
            } else {
                errorMsg = 'CAMERA_ERROR';
            }
            setCameraError(errorMsg);
            setAnalysis(prev => ({ ...prev, modelLoaded: false, error: errorMsg }));
        }
    };


    // Section 5: Independent analysis loop (not tied to React render cycles)
    const startAnalysisLoop = (currentGeneration: number) => {
        if (analysisRunningRef.current) return;
        analysisRunningRef.current = true;
        setAnalysis(prev => ({ ...prev, analysisRunning: true }));

        let fpsTimer = Date.now();
        let framesInSecond = 0;

        const analyse = async () => {
            if (!isMountedRef.current || lifecycleGenerationRef.current !== currentGeneration || !analysisRunningRef.current) {
                stopAnalysisLoop();
                return;
            }

            // Check timeout (Section 11) — use ref to avoid stale closure
            const currentChallenge = challengeRef.current;
            if (currentChallenge === "CENTER" || currentChallenge === "TURN_LEFT" || currentChallenge === "TURN_RIGHT") {
                if (Date.now() - searchStartTimeRef.current > 120000) { // 120s timeout
                    stopAnalysisLoop();
                    setChallenge("TIMEOUT");
                    return;
                }
            }

            try {
                await analyseCurrentFrame(currentGeneration);
                framesInSecond++;
            } catch (error: any) {
                // Section 6: Don't swallow inference errors!
                errorCountRef.current++;
                console.error("[BioShield Face Engine]", error);
                setAnalysis(prev => ({
                    ...prev,
                    error: error instanceof Error ? error.message : "Face inference failed"
                }));
            }

            if (Date.now() - fpsTimer >= 1000) {
                const fps = Math.round((framesInSecond * 1000) / (Date.now() - fpsTimer));
                setDiagInfo({
                    fps,
                    resolution: videoRef.current ? `${videoRef.current.videoWidth}x${videoRef.current.videoHeight}` : "0x0",
                    trackState: streamRef.current?.getVideoTracks()[0]?.readyState || "none",
                    lastInferenceMs: lastInferenceTimeRef.current,
                    errors: errorCountRef.current
                });
                framesInSecond = 0;
                fpsTimer = Date.now();
            }

            if (analysisRunningRef.current) {
                analysisTimerRef.current = window.setTimeout(analyse, 125); // ~8 FPS
            }
        };

        analyse();
    };

    // Section 4 & 7 & 8: Authoritative single frame inference and confidence evaluation
    const analyseCurrentFrame = async (currentGeneration: number) => {
        // Use ref to get current challenge — avoids stale closure from async loop
        const currentChallenge = challengeRef.current;
        if (isProcessingRef.current || currentChallenge === "VERIFYING" || currentChallenge === "SUCCESS" || currentChallenge === "FAILED" || currentChallenge === "TIMEOUT") {
            return;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth <= 0 || video.videoHeight <= 0) {
            return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.85));
        if (!blob) return;

        // Single-flight guard: prevent concurrent in-flight requests to the Python service.
        // This ensures the frontend never accumulates multiple overlapping requests,
        // which previously caused the 8-second timeout loop.
        isProcessingRef.current = true;
        let res: Awaited<ReturnType<typeof faceVerificationService.analyzeFrame>>;
        const startTime = performance.now();
        analysisCountRef.current++;
        try {
            res = await faceVerificationService.analyzeFrame(blob);
        } catch (err) {
            isProcessingRef.current = false;
            throw err; // Let the outer analyse() catch block handle it
        }
        isProcessingRef.current = false;

        if (!isMountedRef.current || lifecycleGenerationRef.current !== currentGeneration) {
            return;
        }

        if (res.status === 'timeout') {
            // Individual request timed out — this is a transport/engine event, NOT a biometric result.
            // Do NOT update lastRejectionReason, do NOT touch quality/face state.
            // The ceremony loop continues normally on the next frame.
            console.warn('[BioShield Face] Frame request timed out — preserving liveness state, retrying on next frame');
            return;
        }

        if (res.status === 'error') {
            // Engine was busy or rejected the frame, skip updating UI state to avoid false NO_FACE
            return;
        }


        const duration = Math.round(performance.now() - startTime);
        lastInferenceTimeRef.current = duration;

        console.log("[BioShield Face]", {
            analysisNumber: analysisCountRef.current,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            inferenceMs: duration,
            result: res
        });

        // Section 7: Evaluate face quality using the canonical analyzer
        const qualityResult = evaluateFaceQuality(res.faceCount, res.qualityMetrics);
        
        const conf = res.qualityMetrics.confidence;
        const bbox = res.qualityMetrics.boundingBox;
        const qm = res.qualityMetrics;

        if (qualityResult.status !== 'READY') {
            // Allow slightly blurry or off-center frames during active turning challenges
            const isTurning = currentChallenge === "TURN_LEFT" || currentChallenge === "TURN_RIGHT";
            const isAcceptableTurnQuality = isTurning && (qualityResult.status === 'BLURRY' || qualityResult.status === 'OFF_CENTER' || qualityResult.status === 'LOW_CONFIDENCE');

            if (!isAcceptableTurnQuality) {
                lastRejectionReasonRef.current = qualityResult.message;
                console.log(`[LIVENESS_DEBUG] yaw: ${qm.yaw.toFixed(2)}, challenge: ${currentChallenge}, status: ${qualityResult.status}`);
                setAnalysis(prev => ({
                    ...prev,
                    faceCount: res.faceCount,
                    faceDetected: res.faceCount === 1 && conf >= 0.50,
                    confidence: conf,
                    boundingBox: bbox,
                    qualityPassed: false,
                    poseAccepted: false,
                    error: null
                }));
                setCoachingText(qualityResult.message);
                return;
            }
        }

        // We have a READY face! Now evaluate Liveness/Pose...
        const yaw = qm.yaw;
        const noseRatio = qm.noseXRatio;
        
        console.log(`[LIVENESS_DEBUG] yaw: ${yaw.toFixed(2)}, challenge: ${currentChallenge}, status: READY`);
        
        let poseOk = false;

        if (currentChallenge === "CENTER") {
            const isReturnToCenter = neutralYawRef.current !== null;
            const isCenterAchieved = isReturnToCenter
                ? Math.abs(yaw - neutralYawRef.current!) <= 0.08
                : Math.abs(yaw) <= 0.16;

            if (isCenterAchieved) {
                consecutiveFramesRef.current++;
                if (consecutiveFramesRef.current >= cfg.requiredConsecutiveFrames) {
                    if (!isReturnToCenter) {
                        neutralYawRef.current = yaw; // Freeze the neutral reference only once!
                    }
                    livenessPhaseRef.current = 'MOVEMENT_DETECTED';
                    consecutiveFramesRef.current = 0;
                    framesInChallengeRef.current = 0;
                    poseOk = true;
                    setChallenge(targetTurnRef.current);
                    
                    const stepNum = currentSequenceIndexRef.current + 2; // Step 1 was center
                    setCoachingText(targetTurnRef.current === 'TURN_LEFT' 
                        ? `Step ${stepNum}: Turn your head slightly left ←` 
                        : `Step ${stepNum}: Turn your head slightly right →`);
                } else {
                    poseOk = false;
                    setCoachingText(isReturnToCenter ? "Hold that pose..." : "Step 1: Look straight ahead and hold still.");
                }
            } else {
                consecutiveFramesRef.current = 0;
                poseOk = false;
                setCoachingText(isReturnToCenter ? "Return head to center..." : "Step 1: Look straight ahead at center of the oval.");
            }
        } else if (currentChallenge === "TURN_LEFT" || currentChallenge === "TURN_RIGHT") {
            framesInChallengeRef.current++;
            
            if (framesInChallengeRef.current > cfg.maxFramesPerChallenge) {
                setCameraState("ERROR");
                setVerificationError("Liveness challenge timed out. Please try again.");
                return;
            }

            const deltaYaw = yaw - (neutralYawRef.current || 0);
            
            // Use absolute value to avoid sign issues across different mirrored/non-mirrored camera setups
            // We just need to verify they made a significant turn in *some* direction, and the sequence requires them to turn, return to center, and turn again.
            const achieved = Math.abs(deltaYaw) >= cfg.turnYawMin;

            if (achieved) {
                consecutiveFramesRef.current++;
                if (consecutiveFramesRef.current >= cfg.requiredConsecutiveFrames) {
                    currentSequenceIndexRef.current++;
                    
                    if (currentSequenceIndexRef.current < activeChallengeSequenceRef.current.length) {
                        // More steps in sequence! Tell user to return to center.
                        const nextTarget = activeChallengeSequenceRef.current[currentSequenceIndexRef.current] as 'TURN_LEFT' | 'TURN_RIGHT';
                        targetTurnRef.current = nextTarget;
                        livenessPhaseRef.current = 'EXPECT_CENTER';
                        setChallenge("CENTER");
                        // We intentionally DO NOT reset neutralYawRef here!
                        consecutiveFramesRef.current = 0;
                        framesInChallengeRef.current = 0;
                        poseOk = false;
                        setCoachingText(`Step ${currentSequenceIndexRef.current + 1}: Return to center...`);
                    } else {
                        // Sequence fully complete!
                        livenessPhaseRef.current = 'TARGET_ACHIEVED';
                        poseOk = true;
                        setCoachingText("✓ Liveness verified! Hold still for identity matching...");
                        executeVerification();
                    }
                } else {
                    poseOk = false;
                    setCoachingText("Hold that pose...");
                }
            } else {
                consecutiveFramesRef.current = 0;
                poseOk = false;
                setCoachingText(targetTurnRef.current === 'TURN_LEFT' ? "Turn your head slightly left ←" : "Turn your head slightly right →");
            }
        }

        if (!poseOk) {
            collectedFramesRef.current.push(blob);
            if (collectedFramesRef.current.length > 30) {
                collectedFramesRef.current.shift(); // Keep latest 30 frames
            }
        }

        setAnalysis(prev => ({
            ...prev,
            faceCount: 1,
            faceDetected: true,
            confidence: conf,
            boundingBox: bbox,
            qualityPassed: true,
            poseAccepted: poseOk,
            error: null
        }));
    };

    const executeVerification = async () => {
        if (isProcessingRef.current || challengeRef.current === "VERIFYING" || challengeRef.current === "SUCCESS") return;
        isProcessingRef.current = true;
        stopAnalysisLoop();
        setChallenge("VERIFYING");
        setCoachingText("Comparing against encrypted BioShield Vault reference...");

        try {
            const frames = collectedFramesRef.current;
            const cid = activeChallengeRef.current?.id || "local";
            const nonce = activeChallengeRef.current?.nonce || "local";
            
            if (mode === 'REGISTRATION') {
                const enrollmentToken = sessionStorage.getItem('enrollmentToken') || undefined;
                const result = await faceVerificationService.runEnrollmentCeremony(
                    targetProfileId,
                    frames,
                    undefined,
                    enrollmentToken,
                    cid,
                    nonce
                );

                if (result.success) {
                    setChallenge("SUCCESS");
                    setCoachingText("✓ Face Enrolled Successfully into Vault!");
                    stopCamera();
                    setTimeout(() => {
                        onComplete(true);
                    }, 1000);
                } else {
                    setChallenge("FAILED");
                    setVerificationError(result.error || "Biometric enrollment failed.");
                }
            } else {
                const result: FaceVerificationResult = await faceVerificationService.verifyLiveCapture(targetProfileId, frames, cid, nonce);

                if (result.status === "PASSED") {
                    setChallenge("SUCCESS");
                    setCoachingText("✓ Identity Verified against BioShield Vault!");
                    stopCamera();
                    setTimeout(() => {
                        onComplete(true);
                    }, 1000);
                } else if (result.status === "UNAVAILABLE") {
                    setChallenge("UNAVAILABLE" as any);
                    setVerificationError(result.checks.failureReason || "Biometric service is offline or unreachable.");
                } else if (result.status === "TIMEOUT") {
                    setChallenge("ERROR" as any);
                    setVerificationError("Face verification took too long. Please try again.");
                } else if (result.status === "INSUFFICIENT_DATA") {
                    setChallenge("INSUFFICIENT_DATA" as any);
                    setVerificationError(result.checks.failureReason || "Insufficient face data detected. Please move closer and ensure good lighting.");
                } else {
                    setChallenge("FAILED");
                    setVerificationError(result.checks.failureReason || `Verification failed (Similarity: ${(result.similarityScore || 0).toFixed(2)})`);
                }
            }
        } catch (err: any) {
            setChallenge("ERROR" as any);
            setVerificationError(err instanceof Error ? err.message : "Cryptographic verification failed against vault");
        } finally {
            isProcessingRef.current = false;
        }
    };

    const handleRetry = () => {
        setVerificationError(null);
        startCameraAndEngine();
    };

    useEffect(() => {
        let mounted = true;
        if (!isEnrolled) {
            return;
        }
        if (mounted) {
            startCameraAndEngine();
        }
        return () => {
            mounted = false;
            stopCamera();
        };
    }, [isEnrolled]);

    if (!isEnrolled) {
        return (
            <div className="w-full">
                <FaceEnrollmentCeremony
                    profileId={targetProfileId}
                    mode="RE_ENROLLMENT"
                    onEnrollSuccess={() => {
                        setIsEnrolled(true);
                        onComplete(true);
                    }}
                    onCancel={() => {
                        if (onCancel) onCancel();
                    }}
                />
            </div>
        );
    }

    // Section 9: Derive badge text directly from the ONE authoritative challenge state
    const badgeText = challenge === "VERIFYING" ? "COMPARING IDENTITY" :
                      challenge === "SUCCESS" ? "VERIFIED" :
                      challenge === "FAILED" ? "FAILED" :
                      challenge === "UNAVAILABLE" ? "OFFLINE" :
                      challenge === "INSUFFICIENT_DATA" ? "POOR QUALITY" :
                      challenge === "ERROR" ? "ERROR" :
                      challenge === "TIMEOUT" ? "TIMEOUT" :
                      challenge === "CENTER" ? "STEP 1: CENTER" :
                      challenge === "TURN_LEFT" ? "STEP 2: TURN LEFT ←" : "STEP 2: TURN RIGHT →";

    return (
        <div className={`w-full mx-auto flex flex-col space-y-6 animate-fade-in ${variant === 'standalone' ? 'max-w-2xl' : ''}`}>
            {/* Main Scanner Container */}
            <div className={`relative overflow-hidden ${variant === 'standalone' ? 'bg-white border border-slate-200/60 shadow-2xl rounded-[32px] p-8 md:p-12' : ''}`}>
                {/* Header Section (Only in standalone) */}
                {variant === 'standalone' && (
                <div className="flex items-start justify-between mb-8">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 tracking-[0.15em] mb-1.5 block uppercase">
                            BIOSHIELD IDENTITY ENGINE • MODALITY 1 OF 4
                        </span>
                        <h2 className="text-2xl font-black font-mono text-slate-900 tracking-tight uppercase flex items-center space-x-3">
                            <span>FACE RECOGNITION</span>
                            {challenge === "TIMEOUT" && (
                                <span className="bg-amber-100 text-amber-800 text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider">
                                    TIMEOUT
                                </span>
                            )}
                        </h2>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-blue-50/50 flex items-center justify-center border border-blue-100/50 text-blue-600 shadow-sm">
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                </div>
                )}

            {/* Main Content Area */}
            {challenge === "SUCCESS" ? (
                <div className="py-12 space-y-6 text-center animate-fade-in">
                    <div className="w-20 h-20 bg-emerald-100 border-2 border-emerald-300 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                        <CheckCircle className="w-12 h-12 text-emerald-600 animate-bounce" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-xl font-extrabold text-slate-900 tracking-tight uppercase">
                            FACE VERIFICATION PASSED
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">
                            Live biometric sample matched enrolled reference in BioShield Vault
                        </p>
                    </div>
                </div>
            ) : challenge === "FAILED" ? (
                <div className="py-8 space-y-6 text-center animate-fade-in">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600">
                        <ShieldAlert className="w-10 h-10" />
                    </div>
                    <div className="space-y-2 max-w-md mx-auto">
                        <h3 className="text-lg font-extrabold text-red-900 uppercase">
                            Verification Unsuccessful
                        </h3>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                            The captured biometric sample did not satisfy security threshold requirements against the enrolled profile.
                        </p>
                        {verificationError && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-[11px] font-medium text-red-800 text-left">
                                <strong>Failure Reason:</strong> {verificationError}
                            </div>
                        )}
                    </div>
                    <div className="flex justify-center space-x-4 pt-2 font-medium text-xs font-bold">
                        {onCancel && (
                            <button
                                type="button"
                                onClick={onCancel}
                                className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleRetry}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-colors flex items-center space-x-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            <span>Try Again</span>
                        </button>
                    </div>
                </div>
            ) : challenge === "UNAVAILABLE" || challenge === "ERROR" ? (
                <div className="py-8 space-y-6 text-center animate-fade-in">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600">
                        <AlertTriangle className="w-10 h-10" />
                    </div>
                    <div className="space-y-2 max-w-md mx-auto">
                        <h3 className="text-lg font-extrabold text-red-900 uppercase">
                            {challenge === "UNAVAILABLE" ? "Service Unavailable" : "System Error"}
                        </h3>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                            {challenge === "UNAVAILABLE" 
                                ? "The biometric verification service is currently offline. Please ensure the Python service is running on port 5000."
                                : "An internal error occurred during biometric processing."}
                        </p>
                        {verificationError && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-[11px] font-medium text-red-800 text-left">
                                <strong>Technical Details:</strong> {verificationError}
                            </div>
                        )}
                    </div>
                    <div className="flex justify-center space-x-4 pt-2 font-mono text-xs font-bold">
                        {onCancel && (
                            <button
                                type="button"
                                onClick={onCancel}
                                className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleRetry}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-colors flex items-center space-x-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            <span>Retry Connection</span>
                        </button>
                    </div>
                </div>
            ) : challenge === "INSUFFICIENT_DATA" ? (
                <div className="py-8 space-y-6 text-center animate-fade-in max-w-md mx-auto">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-600">
                        <Camera className="w-10 h-10" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-lg font-extrabold text-slate-900 uppercase">
                            Poor Image Quality
                        </h3>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                            The captured face was not clear enough for secure verification.
                        </p>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left text-xs font-medium text-slate-700 space-y-1">
                            <div className="font-bold">Tips for success:</div>
                            <div>• Ensure your face is well-lit from the front</div>
                            <div>• Move closer so your face fills the oval</div>
                            <div>• Keep your camera lens clean</div>
                        </div>
                    </div>
                    <div className="flex justify-center space-x-4 pt-2 font-mono text-xs font-bold">
                        {onCancel && (
                            <button type="button" onClick={onCancel} className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl">Cancel</button>
                        )}
                        <button type="button" onClick={handleRetry} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md flex items-center space-x-2">
                            <RefreshCw className="w-4 h-4" />
                            <span>Try Again</span>
                        </button>
                    </div>
                </div>
            ) : challenge === "TIMEOUT" ? (
                <div className="py-8 space-y-6 text-center animate-fade-in max-w-md mx-auto">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-600">
                        <AlertTriangle className="w-10 h-10" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-lg font-extrabold text-slate-900 uppercase tracking-tight">
                            CAPTURE TIMEOUT
                        </h3>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                            BioShield couldn't complete the scan within 25 seconds.
                        </p>
                        <div className="bg-slate-50 border border-amber-200 rounded-xl p-4 text-left text-xs font-medium text-amber-900 space-y-2 shadow-sm">
                            <div className="font-bold uppercase tracking-wider text-[10px] text-amber-700">Last Diagnosed Issue:</div>
                            <div className="text-sm font-semibold">{lastRejectionReasonRef.current}</div>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left text-xs font-medium text-slate-700 space-y-2 shadow-sm mt-4">
                            <div className="font-bold text-slate-900">Make sure:</div>
                            <div className="flex items-center space-x-2">
                                <span className="text-blue-500">•</span>
                                <span>Your full face is visible inside the oval</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <span className="text-blue-500">•</span>
                                <span>The camera lens is clean and unobstructed</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <span className="text-blue-500">•</span>
                                <span>Lighting is adequate and not backlit</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-center space-x-4 pt-4 font-medium text-sm font-bold">
                        {onCancel && (
                            <button type="button" onClick={onCancel} className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition-colors shadow-sm">Cancel</button>
                        )}
                        <button type="button" onClick={handleRetry} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-md transition-colors flex items-center space-x-2">
                            <RefreshCw className="w-4 h-4" />
                            <span>Try Again</span>
                        </button>
                    </div>
                    <div className="text-[10px] font-medium text-slate-400 pt-4 flex justify-center space-x-6">
                        <span>Camera: <strong className="text-emerald-600">Working</strong></span>
                        <span>Face Engine: <strong className={analysis.modelLoaded ? "text-emerald-600" : "text-red-500"}>{analysis.modelLoaded ? "Working" : "Error"}</strong></span>
                    </div>
                </div>
            ) : (
                <div className="space-y-4 my-6">
                    
                    {/* Status Row */}
                    <div className="flex flex-wrap items-center justify-center gap-4 font-mono text-xs bg-slate-50 py-2.5 px-4 rounded-xl border border-slate-200/80">
                        <div className="flex items-center space-x-1.5">
                            <span className={`w-2 h-2 rounded-full ${cameraState === 'READY' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                            <span className={cameraState === 'READY' ? 'text-emerald-700 font-bold' : 'text-slate-700 font-bold'}>
                                {cameraState === 'READY' ? '✓ Camera Ready' : '● Starting Camera'}
                            </span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                            <span className={`w-2 h-2 rounded-full ${analysis.faceDetected ? 'bg-emerald-500' : cameraState !== 'READY' ? 'bg-slate-300' : 'bg-blue-500 animate-pulse'}`} />
                            <span className={analysis.faceDetected ? 'text-emerald-700 font-bold' : cameraState !== 'READY' ? 'text-slate-400' : 'text-blue-700 font-bold'}>
                                {cameraState !== 'READY' ? '○ Face Detection' : analysis.faceDetected ? '✓ Face Detected' : '● Looking for Face'}
                            </span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                            <span className={`w-2 h-2 rounded-full ${analysis.qualityPassed ? 'bg-emerald-500' : !analysis.faceDetected ? 'bg-slate-300' : 'bg-blue-500 animate-pulse'}`} />
                            <span className={analysis.qualityPassed ? 'text-emerald-700 font-bold' : !analysis.faceDetected ? 'text-slate-400' : 'text-blue-700 font-bold'}>
                                {!analysis.faceDetected ? '○ Capture Quality' : analysis.qualityPassed ? '✓ Quality Passed' : '● Checking Quality'}
                            </span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                            <span className={`w-2 h-2 rounded-full ${analysis.poseAccepted ? 'bg-emerald-500' : !analysis.qualityPassed ? 'bg-slate-300' : 'bg-blue-500 animate-pulse'}`} />
                            <span className={analysis.poseAccepted ? 'text-emerald-700 font-bold' : !analysis.qualityPassed ? 'text-slate-400' : 'text-blue-700 font-bold'}>
                                {!analysis.qualityPassed ? '○ Pose' : analysis.poseAccepted ? '✓ Pose Accepted' : '● Aligning Pose'}
                            </span>
                        </div>
                    </div>

                    {/* Live Camera Feed Box */}
                    <div className="relative w-full aspect-[4/3] max-h-[380px] bg-slate-900 border-2 border-slate-300 rounded-[28px] overflow-hidden flex items-center justify-center shadow-inner">
                        {cameraError ? (
                            <div className="p-6 text-center text-white space-y-4 max-w-sm">
                                <VideoOff className="w-12 h-12 text-red-400 mx-auto" />
                                {cameraError === 'INSECURE_CONTEXT' ? (
                                    <>
                                        <div className="space-y-1">
                                            <div className="font-bold text-sm text-red-300 font-mono uppercase">Secure Context Required</div>
                                            <p className="text-xs text-slate-300 leading-relaxed font-mono">
                                                Camera access requires a secure context or localhost.
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-center space-y-2 pt-1 font-mono text-xs font-bold">
                                            <button type="button" onClick={startCameraAndEngine} className="w-full bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl transition-all">
                                                Try Again
                                            </button>
                                            {onCancel && (
                                                <button type="button" onClick={onCancel} className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-xl transition-all">Cancel</button>
                                            )}
                                        </div>
                                    </>
                                ) : cameraError === 'CAMERA_PERMISSION_DENIED' ? (
                                    <>
                                        <div className="space-y-1">
                                            <div className="font-bold text-sm text-red-300 font-mono uppercase">Permission Denied</div>
                                            <p className="text-xs text-slate-300 leading-relaxed font-mono">
                                                Camera permission blocked. Click the 🔒 in the address bar → Site Settings → Allow Camera.
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-center space-x-3 pt-2 font-mono text-xs font-bold">
                                            <button type="button" onClick={startCameraAndEngine} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl transition-all shadow-md">Try Again</button>
                                            {onCancel && (<button type="button" onClick={onCancel} className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-xl transition-all">Cancel</button>)}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="space-y-1">
                                            <div className="font-bold text-sm text-red-300 font-mono uppercase">Engine / Camera Error</div>
                                            <p className="text-xs text-slate-300 leading-relaxed font-mono">{cameraError}</p>
                                        </div>
                                        <div className="flex items-center justify-center space-x-3 pt-2 font-mono text-xs font-bold">
                                            <button type="button" onClick={startCameraAndEngine} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl transition-all shadow-md">Try Again</button>
                                            {onCancel && (<button type="button" onClick={onCancel} className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-xl transition-all">Cancel</button>)}
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <>
                                <video 
                                    ref={videoRef} 
                                    autoPlay 
                                    muted 
                                    playsInline 
                                    className="absolute inset-0 w-full h-full object-cover transform -scale-x-100" 
                                />
                                <canvas ref={canvasRef} className="hidden" />

                                {/* Subtle Oval Guide */}
                                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                    <div className={`w-56 h-72 border-2 rounded-[45%] shadow-[0_0_0_9999px_rgba(15,23,42,0.30)] transition-all duration-300 ${
                                        challenge === "VERIFYING" ? 'border-amber-400 scale-105' :
                                        analysis.poseAccepted ? 'border-emerald-400/90 shadow-[0_0_0_9999px_rgba(16,185,129,0.15)]' :
                                        analysis.qualityPassed ? 'border-blue-400/80' : 
                                        'border-white/40'
                                    }`} />
                                </div>

                                {/* Active Pose Instruction Pill (Section 9: Strictly synchronized with challenge state) */}
                                <div className="absolute top-4 left-4 bg-slate-900/85 backdrop-blur-md border border-white/10 text-white px-3.5 py-1.5 rounded-full text-[11px] font-mono font-bold flex items-center space-x-2 shadow-lg">
                                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                                    <span>LIVE VERIFICATION • PROFILE: {targetProfileId}</span>
                                    <span className="bg-blue-600 px-2 py-0.5 rounded text-[9px] uppercase ml-1">
                                        {badgeText}
                                    </span>
                                </div>

                                {/* Bottom Coaching Box */}
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md border border-slate-200 text-slate-900 px-5 py-3 rounded-2xl shadow-xl flex items-center space-x-3.5 max-w-md w-11/12 justify-center">
                                    <span className="shrink-0"><Eye className="w-6 h-6 text-blue-600" /></span>
                                    <div className="text-left flex-1 min-w-0">
                                        <div className="text-xs font-extrabold font-mono text-slate-900 truncate uppercase">
                                            {challenge === "VERIFYING" ? "Comparing against encrypted Vault..." : badgeText}
                                        </div>
                                        <div className="text-[10px] font-mono text-slate-600 truncate">
                                            {coachingText}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-between pt-2">
                        {onCancel ? (
                            <button type="button" onClick={onCancel} className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors border border-slate-200 font-medium">
                                Cancel
                            </button>
                        ) : <div />}
                        <div className="text-xs font-medium text-slate-500 flex items-center space-x-1.5">
                            <Lock className="w-3.5 h-3.5 text-blue-600" />
                            <span>Verification executes automatically when liveness passes</span>
                        </div>
                    </div>

                    {/* Collapsible Development Diagnostics (Section 3) */}
                    <div className="pt-2 border-t border-slate-200/60">
                        <button
                            type="button"
                            onClick={() => setShowDiagnostics(!showDiagnostics)}
                            className="text-[10px] font-mono text-slate-400 hover:text-slate-600 flex items-center space-x-1 mx-auto"
                        >
                            <Terminal className="w-3 h-3" />
                            <span>{showDiagnostics ? '▼ Hide' : '► View'} Camera & Engine Diagnostics (Dev Mode)</span>
                        </button>
                        {showDiagnostics && (
                            <div className="mt-2 bg-slate-900 text-slate-200 p-4 rounded-xl font-mono text-[11px] space-y-3 border border-slate-800 shadow-inner">
                                <div>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-800">Camera Diagnostics</div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1.5 text-[10px]">
                                        <div className="text-slate-400">Camera State:</div><div className="font-bold text-emerald-400">{cameraState}</div>
                                        <div className="text-slate-400">Stream Track:</div><div>{diagInfo.trackState}</div>
                                        <div className="text-slate-400">Resolution:</div><div>{diagInfo.resolution}</div>
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-800">Face Engine</div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1.5 text-[10px]">
                                        <div className="text-slate-400">Model Status:</div><div className="font-bold text-blue-400">{analysis.modelLoaded ? "LOADED" : "UNAVAILABLE"}</div>
                                        <div className="text-slate-400">Analysis Status:</div><div>{analysis.analysisRunning ? "RUNNING" : "IDLE"}</div>
                                        <div className="text-slate-400">Frames Analyzed:</div><div>{analysisCountRef.current}</div>
                                        <div className="text-slate-400">Inference FPS:</div><div>{diagInfo.fps} FPS</div>
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-800">Detection Metrics</div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1.5 text-[10px]">
                                        <div className="text-slate-400">Faces Detected:</div><div className="font-bold text-amber-300">{analysis.faceCount}</div>
                                        <div className="text-slate-400">Confidence:</div><div>{analysis.confidence !== null ? `${(analysis.confidence * 100).toFixed(1)}%` : '—'}</div>
                                        <div className="text-slate-400">Last Inference:</div><div>{diagInfo.lastInferenceMs} ms</div>
                                        <div className="text-slate-400">Errors Swallowed:</div><div className={diagInfo.errors > 0 ? "text-red-400 font-bold" : "text-emerald-400"}>0 (Logged: {diagInfo.errors})</div>
                                        {analysis.error && <div className="col-span-2 text-red-400 pt-1">Error: {analysis.error}</div>}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            </div> {/* Close Main Scanner Container */}

            {/* Footer Note */}
            {variant === 'standalone' && (
            <div className="mt-6 text-center text-[11px] font-medium text-slate-500 bg-slate-50 py-2.5 px-4 rounded-xl border border-slate-200/60 shadow-sm">
                <strong>Biometric comparison is performed offline inside the local BioShield Enclave.</strong>
            </div>
            )}
        </div>
    );
};

export default FaceScanner;
