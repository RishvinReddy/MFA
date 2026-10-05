import { FACE_QUALITY_CONFIG as cfg } from './faceQualityConfig';

export type FaceStatus = 
    | 'NO_FACE' 
    | 'MULTIPLE_FACES' 
    | 'LOW_CONFIDENCE'
    | 'BLURRY' 
    | 'POOR_LIGHTING' 
    | 'TOO_CLOSE'
    | 'TOO_FAR'
    | 'OFF_CENTER' 
    | 'READY';

export interface QualityMetrics {
    blurScore: number;
    bboxSize: number;
    yaw: number;
    noseXRatio: number;
    brightness: number;
    contrast: number;
    centerX: number;
    centerY: number;
    confidence: number;
    boundingBox: any;
}

export interface CanonicalFaceAnalysisResult {
    faceDetected: boolean;
    faceCount: number;
    qualityStatus: FaceStatus;
    qualityMessage: string;
    metrics: QualityMetrics;
    rawEmbedding?: number[]; // Only populated if engine returned it
    poseOk: boolean; // Computed by the caller based on the current challenge
}

/**
 * Pure function to evaluate UX/quality status of a face frame.
 * This is NOT a security/authentication check; it is purely to give the user
 * diagnostic feedback during the positioning phase.
 */
export const evaluateFaceQuality = (
    faceCount: number,
    metrics: QualityMetrics
): { status: FaceStatus; message: string } => {
    
    if (faceCount === 0) {
        // If the frame was completely blank/noisy or confidence < 0.50 
        // InsightFace won't even return a face box.
        // We can still use the global blur/brightness if they are horrible,
        // but typically NO_FACE is the best fallback.
        if (metrics.brightness < cfg.BRIGHTNESS_MIN) {
            return { status: 'POOR_LIGHTING', message: "Lighting too low — Move to a brighter area." };
        }
        if (metrics.blurScore < cfg.BLUR_MIN) {
            return { status: 'BLURRY', message: "Image is too blurry. Clean the lens and hold still." };
        }
        return { status: 'NO_FACE', message: "○ Searching for face — Position your face inside the guide." };
    }
    
    if (faceCount > 1) {
        return { status: 'MULTIPLE_FACES', message: "✗ Multiple faces detected. Only the enrolled person should be visible." };
    }
    
    if (metrics.confidence < cfg.CONFIDENCE_MIN) {
        return { status: 'LOW_CONFIDENCE', message: "Hold still and look directly at the camera." };
    }
    
    // Check centering
    if (metrics.centerX < cfg.CENTER_X_MIN) {
        return { status: 'OFF_CENTER', message: "Move slightly left ← to center your face in the oval." };
    }
    if (metrics.centerX > cfg.CENTER_X_MAX) {
        return { status: 'OFF_CENTER', message: "Move slightly right → to center your face in the oval." };
    }
    if (metrics.centerY < cfg.CENTER_Y_MIN) {
        return { status: 'OFF_CENTER', message: "Move your face down slightly ↓ into the oval." };
    }
    if (metrics.centerY > cfg.CENTER_Y_MAX) {
        return { status: 'OFF_CENTER', message: "Raise your head slightly ↑ into the oval." };
    }
    
    // Check Lighting & Sharpness
    if (metrics.brightness < cfg.BRIGHTNESS_MIN) {
        return { status: 'POOR_LIGHTING', message: "Lighting too low — Move to a brighter area." };
    }
    if (metrics.brightness > cfg.BRIGHTNESS_MAX) {
        return { status: 'POOR_LIGHTING', message: "Lighting too bright or glare detected." };
    }
    if (metrics.blurScore < cfg.BLUR_MIN) {
        return { status: 'BLURRY', message: "Image is blurry. Hold still and ensure lens is clean." };
    }
    
    // Check Size
    if (metrics.bboxSize < cfg.BBOX_MIN) {
        return { status: 'TOO_FAR', message: "Move closer to the camera." };
    }
    if (metrics.bboxSize > cfg.BBOX_MAX) {
        return { status: 'TOO_CLOSE', message: "Move farther back from the camera." };
    }
    
    return { status: 'READY', message: "Hold still for capture." };
};
