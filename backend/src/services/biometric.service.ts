import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import { logger } from '../utils/logger';

const BIOMETRIC_URL = process.env.BIOMETRIC_SERVICE_URL || "http://127.0.0.1:5000";
const TIMEOUT_MS = 60000; // Increased to 60s for Whisper/ECAPA and Face processing

import { NormalizedEvidence, EvidenceStatus, IdentityEvidence } from '../types/evidence';

export interface FaceQualityMetrics {
    blur_score: number;
    bbox_size: number;
    yaw: number;
    nose_x_ratio: number;
    brightness: number;
    contrast: number;
    center_x: number;
    center_y: number;
    confidence: number;
}

export class BiometricService {

    private static async executeWithBackoff(
        method: 'POST',
        endpoint: string,
        filePath: string,
        allowRetries: boolean,
        modality: 'FACE' | 'VOICE'
    ): Promise<any> {
        const maxAttempts = allowRetries ? 3 : 1;
        let attempt = 1;

        while (attempt <= maxAttempts) {
            const form = new FormData();
            form.append("file", fs.createReadStream(filePath));

            try {
                const response = await axios.request({
                    method,
                    url: `${BIOMETRIC_URL}${endpoint}`,
                    data: form,
                    headers: {
                        ...form.getHeaders(),
                        'x-biometric-api-key': process.env.BIOMETRIC_API_KEY || ''
                    },
                    timeout: TIMEOUT_MS
                });
                return response.data;
            } catch (error: any) {
                const isTransient = this.isTransientError(error);
                if (isTransient && attempt < maxAttempts) {
                    const delayMs = 500 * Math.pow(2, attempt - 1);
                    logger.warn(`[BiometricService] ${modality} request failed (attempt ${attempt}/${maxAttempts}). Retrying in ${delayMs}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                    attempt++;
                } else {
                    throw error;
                }
            }
        }
    }

    private static isTransientError(error: any): boolean {
        if (!error.response) {
            // Network errors
            return error.code === 'ECONNABORTED' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT';
        }
        // Server errors that might be transient
        const status = error.response.status;
        return status === 502 || status === 503 || status === 504;
    }

    /**
     * Extracts a Face embedding and wraps it in a IdentityEvidence contract.
     * Note: Typically used during Enrollment, or Verification if local DB matching is preferred.
     */
    static async extractFace(filePath: string, isEnrollment: boolean = false): Promise<NormalizedEvidence> {
        try {
            const data = await this.executeWithBackoff('POST', '/extract-face', filePath, !isEnrollment, 'FACE');
            
            return {
                source: 'BiometricService',
                category: 'HUMAN',
                modality: 'FACE',
                status: 'PASS',
                confidence: data.quality_metrics?.confidence || 0,
                quality: data.quality?.score || 0,
                timestamp: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 5 * 60000).toISOString(),
                isContradictory: false,
                isSpoofed: false,
                modelVersion: data.model?.version || '1.2.0',
                metadata: {
                    liveness: true,
                    antiSpoof: true,
                    challengePassed: true,
                    rawEmbedding: data.embedding
                }
            };
        } catch (error: any) {
            logger.error(`[BiometricService] Extract face failed: ${error.message}`);
            
            if (error.response && error.response.data && error.response.data.error) {
                const code = error.response.data.error.code;
                if (code === 'SPOOF_DETECTED') {
                    return {
                        source: 'BiometricService',
                        category: 'HUMAN',
                        modality: 'FACE',
                        status: 'FAIL',
                        confidence: 0,
                        quality: 0,
                        timestamp: new Date().toISOString(),
                        expiresAt: new Date().toISOString(),
                        isContradictory: false,
                        isSpoofed: true,
                        modelVersion: '1.2.0',
                        metadata: { liveness: false }
                    };
                }
                if (code === 'NO_FACE_DETECTED') {
                    return {
                        source: 'BiometricService',
                        category: 'HUMAN',
                        modality: 'FACE',
                        status: 'INSUFFICIENT_DATA',
                        confidence: 0,
                        quality: 0,
                        timestamp: new Date().toISOString(),
                        expiresAt: new Date().toISOString(),
                        isContradictory: false,
                        isSpoofed: false,
                        modelVersion: '1.2.0',
                        metadata: {}
                    };
                }
            }
            throw error;
        }
    }

    /**
     * Extracts Face embedding and checks Liveness over a sequence of frames.
     */
    static async analyzeLivenessSequence(filePaths: string[], expectedSequence: string[], requestId: string = ''): Promise<NormalizedEvidence> {
        let attempt = 1;
        const maxAttempts = 3;

        while (attempt <= maxAttempts) {
            const form = new FormData();
            for (const path of filePaths) {
                form.append("files", fs.createReadStream(path));
            }
            form.append("expected_sequence", JSON.stringify(expectedSequence));

            try {
                const response = await axios({
                    method: 'POST',
                    url: `${BIOMETRIC_URL}/analyze-sequence`,
                    data: form,
                    headers: {
                        ...form.getHeaders(),
                        'x-biometric-api-key': process.env.BIOMETRIC_API_KEY || '',
                        'x-request-id': requestId
                    },
                    timeout: 60000 // Give 60 seconds for multi-frame analysis on slower hardware
                });
                
                const data = response.data;
                const spoofed = data.spoof_detected === true || data.liveness < 0.3;

                return {
                    source: 'BiometricService',
                    category: 'HUMAN',
                    modality: 'FACE',
                    status: data.success ? 'PASS' : 'INSUFFICIENT_DATA',
                    confidence: data.success ? 0.99 : 0.0,
                    quality: 80, // Default quality
                    timestamp: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 5 * 60000).toISOString(),
                    isContradictory: false,
                    isSpoofed: spoofed,
                    liveness: data.liveness,
                    modelVersion: '1.2.0',
                    metadata: {
                        livenessScore: data.liveness,
                        antiSpoof: !spoofed,
                        metrics: data.metrics,
                        rawEmbedding: data.embedding
                    }
                };
            } catch (error: any) {
                const isTransient = this.isTransientError(error);
                if (isTransient && attempt < maxAttempts) {
                    const delayMs = 500 * Math.pow(2, attempt - 1);
                    logger.warn(`[BiometricService] Analyze sequence request failed (attempt ${attempt}/${maxAttempts}). Retrying in ${delayMs}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                    attempt++;
                } else {
                    const rawData = error.response?.data ? JSON.stringify(error.response.data) : "No response data";
                    const pythonError = error.response?.data?.error?.message || error.message;
                    logger.error(`[BiometricService] Failed to analyze liveness sequence. Raw Data: ${rawData}`);
                    throw new Error(`Face analysis failed: ${pythonError} (Raw: ${rawData})`);
                }
            }
        }
        throw new Error('Failed to analyze sequence after retries');
    }

    /**
     * Extracts a Voice embedding and wraps it in an IdentityEvidence contract.
     * Note: Typically used during Enrollment, or Verification if local DB matching is preferred.
     */
    static async extractVoice(filePath: string, isEnrollment: boolean = false): Promise<NormalizedEvidence> {
        try {
            const data = await this.executeWithBackoff('POST', '/extract-voice-embedding', filePath, !isEnrollment, 'VOICE');
            
            return {
                source: 'BiometricService',
                category: 'HUMAN',
                modality: 'VOICE',
                status: 'PASS',
                confidence: data.confidence || 0,
                quality: data.quality || 0,
                timestamp: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 5 * 60000).toISOString(),
                isContradictory: false,
                isSpoofed: false,
                modelVersion: data.model?.name || 'spkrec-ecapa-voxceleb',
                metadata: {
                    liveness: true,
                    antiSpoof: true,
                    challengePassed: true,
                    rawEmbedding: data.embedding,
                    rawText: data.raw_text,
                    normalizedText: data.normalized_text,
                    totalDuration: data.metrics?.total_duration || 0,
                    speechDuration: data.metrics?.speech_duration || 0,
                    speechRatio: data.metrics?.speech_ratio || 0
                }
            };
        } catch (error: any) {
            return this.handlePythonError('VOICE', error);
        }
    }



    /**
     * Maps Python service failures to the strict IdentityEvidence contract.
     */
    private static handlePythonError(modality: 'FACE' | 'VOICE', error: any): NormalizedEvidence {
        let status: EvidenceStatus = 'ERROR';
        let reason = error.message;
        let isSpoofed = false;

        if (error.code === 'ECONNABORTED' || error.code === 'ECONNREFUSED') {
            status = 'UNAVAILABLE';
            reason = 'Biometric Service Offline or Timeout';
        } else if (error.response) {
            // Python returned an explicit HTTP error (e.g., 400 Bad Request, 422 Unprocessable, 404 Not Found)
            if (error.response.status === 422 || error.response.status === 400) {
                const code = error.response.data?.error?.code;
                if (code === 'NO_FACE_DETECTED' || code === 'MULTIPLE_FACES') {
                    status = 'INSUFFICIENT_DATA';
                } else if (code === 'SPOOF_DETECTED') {
                    status = 'FAIL';
                    isSpoofed = true;
                } else if (code === 'FACE_QUALITY_INSUFFICIENT') {
                    status = 'INSUFFICIENT_DATA';
                } else {
                    status = 'INSUFFICIENT_DATA'; // Generic bad input
                }
                reason = error.response.data?.error?.message || error.response.data?.detail || 'Invalid Biometric Input';
            } else if (error.response.status === 404) {
                status = 'FAIL';
                reason = 'No Enrollment Found';
            } else if (error.response.status >= 500) {
                status = 'ERROR';
                reason = 'Biometric Service Internal Error';
            }
        }

        logger.warn(`[BiometricService] ${modality} check failed -> ${status}: ${reason}`);

        return {
            source: 'BiometricService',
            category: 'HUMAN',
            modality,
            status,
            confidence: 0,
            quality: 0,
            timestamp: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 5 * 60000).toISOString(),
            isContradictory: false, // If it errored or spoofed, it's not a verified mismatch
            isSpoofed,
            modelVersion: 'unknown',
            metadata: {
                liveness: !isSpoofed,
                antiSpoof: !isSpoofed,
                challengePassed: false,
                reason
            }
        };
    }
}
