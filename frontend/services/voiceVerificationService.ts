/**
 * voiceVerificationService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Real speaker verification via MFCC-128 embeddings.
 * Mirrors the design of faceVerificationService.ts.
 *
 * PIPELINE:
 *   ENROLL:  mic audio → POST /enroll-voice → backend stores MFCC reference
 *   VERIFY:  mic audio → POST /compare-voice → backend compares → PASSED/FAILED
 *
 * RULES (from BioShield integrity policy):
 *   - No timer-based pass. "microphoneRecorded === true" is NOT verification.
 *   - No offline fallback. Backend unreachable → FAILED.
 *   - No auto-enroll on failed verify. Enrollment is a separate ceremony.
 *   - PASSED is only returned when cosine similarity >= VOICE_MATCH_THRESHOLD.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { biometricVault } from './biometricVault';
import { api } from './api';

const BIOMETRIC_ENGINE_URL = (import.meta as any).env?.VITE_BIOMETRIC_ENGINE_URL || 'http://127.0.0.1:5000';
const MODEL_VERSION        = 'MFCC-128-cosine-v1';

// Challenge phrases — randomised each session, never the same phrase twice in a row.
export const VOICE_CHALLENGE_PHRASES = [
    "BioShield verifies my identity",
    "Security vector seven",
    "My voice confirms who I am",
    "Access granted by biometric proof",
    "Identity confirmed on this device",
    "BioShield protects this system",
];

export interface VoiceVerificationResult {
    status: 'PASSED' | 'FAILED' | 'ERROR';
    checks: {
        microphoneReady:  boolean;
        speechDetected:   boolean;
        qualityPassed:    boolean;
        speakerMatch:     boolean;
        failureReason?:   string;
    };
    modelVersion: string;
    evidenceId:   string;
    verifiedAt:   number;
}

export interface VoiceEnrollmentResult {
    success:      boolean;
    sampleCount:  number;
    error?:       string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateEvidenceId(): string {
    return `ev-voice-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}

async function audioToWav(chunks: Blob[]): Promise<Blob> {
    const webmBlob = new Blob(chunks, { type: 'audio/webm' });
    const arrayBuffer = await webmBlob.arrayBuffer();
    
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    const numOfChan = audioBuffer.numberOfChannels;
    // We are downmixing to mono, so data size is length * 1 channel * 2 bytes/sample
    const length = audioBuffer.length * 1 * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let sample = 0;
    let offset = 0;
    let pos = 0;
    
    // Write WAV header
    const setUint16 = (data: number) => { view.setUint16(pos, data, true); pos += 2; };
    const setUint32 = (data: number) => { view.setUint32(pos, data, true); pos += 4; };
    
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"
    
    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(1); // MONO
    setUint32(audioBuffer.sampleRate);
    setUint32(audioBuffer.sampleRate * 2 * 1); // avg. bytes/sec
    setUint16(2); // block-align (1 channel * 2 bytes)
    setUint16(16); // 16-bit
    
    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length
    
    // Write interleaved data (downmix to mono)
    for(let i = 0; i < audioBuffer.numberOfChannels; i++) {
        channels.push(audioBuffer.getChannelData(i));
    }
    
    while(pos < length) {
        let monoSample = 0;
        for(let i = 0; i < audioBuffer.numberOfChannels; i++) {
            monoSample += channels[i][offset];
        }
        monoSample = monoSample / audioBuffer.numberOfChannels; // average channels
        
        monoSample = Math.max(-1, Math.min(1, monoSample)); // clamp
        monoSample = (0.5 + monoSample < 0 ? monoSample * 32768 : monoSample * 32767) | 0; // scale to 16-bit int
        view.setInt16(pos, monoSample, true); // write 16-bit int
        pos += 2;
        offset++;
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const voiceVerificationService = {

    /**
     * Fetches a server-authored challenge phrase.
     */
    async fetchChallenge(mode: 'REGISTRATION' | 'LOGIN' = 'LOGIN'): Promise<{challengeId: string, nonce: string, phrase: string}> {
        const res = await api.generateChallenge(mode, 'VOICE');
        // Map the backend Face/Voice unified challenge response to what VoiceScanner expects
        return {
            challengeId: res.challengeId,
            nonce: res.nonce,
            phrase: res.phrase || res.sequence?.[0] || "Default phrase"
        };
    },

    /**
     * Enrolls one audio sample for a given profileId.
     * Call this 3 times (with different recordings) to build a robust reference.
     * The backend averages all samples into a single reference vector.
     *
     * Marks biometricVault VOICE enrolled after the minimum required sample count.
     */
    async validateSample(
        profileId: string,
        audioChunks: Blob[],
        enrollmentToken?: string,
        challengeId?: string,
        nonce?: string
    ): Promise<{ success: boolean; sample?: string; error?: string }> {
        let audioBlob: Blob;
        try {
            audioBlob = await audioToWav(audioChunks);
            if (audioBlob.size < 1000) {
                return { success: false, error: 'Audio recording is too short. Please try again.' };
            }
        } catch {
            return { success: false, error: 'Failed to process audio recording.' };
        }

        try {
            const formData = new FormData();
            formData.append('voice', audioBlob, 'voice_sample.wav');
            if (challengeId) formData.append('challengeId', challengeId);
            if (nonce) formData.append('nonce', nonce);

            const token = sessionStorage.getItem("accessToken");
            const headers: any = {};
            if (token) headers["Authorization"] = `Bearer ${token}`;
            if (enrollmentToken) headers["x-enrollment-token"] = enrollmentToken;

            const res = await fetch(`http://localhost:8080/api/biometric/validate-voice-sample`, {
                method: 'POST',
                headers,
                body: formData
            });

            const data = await res.json();
            
            if (!res.ok) {
                return { success: false, error: data.message || data.detail || `Server error ${res.status}` };
            }

            return { success: true, sample: data.sample };
        } catch (error: any) {
            return {
                success: false,
                error: `Node backend unreachable: ${error?.message || 'Connection refused'}.`
            };
        }
    },

    async finalizeEnrollment(
        profileId: string,
        samples: string[],
        enrollmentToken?: string
    ): Promise<{ success: boolean; error?: string; outlierIndex?: number }> {
        try {
            const token = sessionStorage.getItem("accessToken");
            const headers: any = { 'Content-Type': 'application/json' };
            if (token) headers["Authorization"] = `Bearer ${token}`;
            if (enrollmentToken) headers["x-enrollment-token"] = enrollmentToken;

            const res = await fetch(`http://localhost:8080/api/biometric/finalize-voice-enrollment`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ samples })
            });

            const data = await res.json();
            
            if (!res.ok) {
                return { success: false, error: data.message || `Server error ${res.status}`, outlierIndex: data.outlierIndex };
            }

            return { success: true };
        } catch (error: any) {
            return {
                success: false,
                error: `Node backend unreachable: ${error?.message || 'Connection refused'}.`
            };
        }
    },

    /**
     * Verifies a live recording against the enrolled reference for profileId.
     *
     * Returns PASSED only when:
     *   1. An enrolled reference exists for this profileId
     *   2. The backend is reachable
     *   3. cosine_similarity(live, reference) >= VOICE_MATCH_THRESHOLD
     *
     * Returns FAILED for any other outcome — including missing reference,
     * backend unavailability, or below-threshold similarity.
     */
    async verifyLiveCapture(
        profileId: string,
        audioChunks: Blob[],
        challengeId?: string,
        nonce?: string
    ): Promise<VoiceVerificationResult> {
        const evidenceId = generateEvidenceId();
        const verifiedAt = Date.now();

        // 2. Prepare audio
        let audioBlob: Blob;
        try {
            audioBlob = await audioToWav(audioChunks);
            if (audioBlob.size < 1000) {
                return {
                    status: 'FAILED',
                    checks: {
                        microphoneReady: true,
                        speechDetected:  false,
                        qualityPassed:   false,
                        speakerMatch:    false,
                        failureReason:   'Recording is too short. Please speak clearly and hold the button for at least 2 seconds.'
                    },
                    modelVersion: MODEL_VERSION,
                    evidenceId,
                    verifiedAt
                };
            }
        } catch {
            return {
                status: 'ERROR',
                checks: {
                    microphoneReady: false,
                    speechDetected:  false,
                    qualityPassed:   false,
                    speakerMatch:    false,
                    failureReason:   'Failed to process microphone recording.'
                },
                modelVersion: MODEL_VERSION,
                evidenceId,
                verifiedAt
            };
        }

        // 3. Send to Node backend for real speaker verification & state orchestration
        try {
            const formData = new FormData();
            formData.append('voice', audioBlob, 'voice.wav');
            if (challengeId) formData.append('challengeId', challengeId);
            if (nonce) formData.append('nonce', nonce);

            const token = sessionStorage.getItem("accessToken");
            const sessionId = sessionStorage.getItem("sessionId");
            const headers: any = {};
            if (token) headers["Authorization"] = `Bearer ${token}`;
            if (sessionId) headers["x-session-id"] = sessionId;

            const res = await fetch(`http://localhost:8080/api/biometric/verify`, {
                method: 'POST',
                headers,
                body: formData
            });

            if (res.status === 404) {
                return {
                    status: 'FAILED',
                    checks: {
                        microphoneReady: true,
                        speechDetected:  true,
                        qualityPassed:   false,
                        speakerMatch:    false,
                        failureReason:   'No enrolled voice reference found on the biometric engine. Re-enrollment required.'
                    },
                    modelVersion: MODEL_VERSION,
                    evidenceId,
                    verifiedAt
                };
            }

            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
                return {
                    status: 'FAILED',
                    checks: {
                        microphoneReady: true,
                        speechDetected:  true,
                        qualityPassed:   false,
                        speakerMatch:    false,
                        failureReason:   err.message || err.detail || `Node backend returned error ${res.status}`
                    },
                    modelVersion: MODEL_VERSION,
                    evidenceId,
                    verifiedAt
                };
            }

            const result = await res.json();
            const passed = result.success === true;

            return {
                status: passed ? 'PASSED' : 'FAILED',
                checks: {
                    microphoneReady: true,
                    speechDetected:  true,
                    qualityPassed:   true,
                    speakerMatch:    passed,
                    failureReason:   passed
                        ? undefined
                        : 'Speaker identity could not be verified against the enrolled reference. Ensure you are speaking clearly in a quiet environment.'
                },
                modelVersion: MODEL_VERSION,
                evidenceId,
                verifiedAt
            };

        } catch (e: any) {
            // FAIL-CLOSED: backend unreachable → FAILED, not auto-pass
            return {
                status: 'FAILED',
                checks: {
                    microphoneReady: true,
                    speechDetected:  true,
                    qualityPassed:   false,
                    speakerMatch:    false,
                    failureReason:   `Backend unreachable: ${e?.message || 'Connection refused'}. Ensure the Node backend is running.`
                },
                modelVersion: MODEL_VERSION,
                evidenceId,
                verifiedAt
            };
        }
    },

    /**
     * Revokes the voice reference for a profile (e.g. to force re-enrollment).
     */
    async revokeEnrollment(profileId: string): Promise<boolean> {
        try {
            const res = await fetch(
                `${BIOMETRIC_ENGINE_URL}/voice-reference/${encodeURIComponent(profileId)}`,
                { method: 'DELETE' }
            );
            biometricVault.revokeTemplate(profileId, 'VOICE');
            return res.ok;
        } catch {
            biometricVault.revokeTemplate(profileId, 'VOICE');
            return false;
        }
    }
};
