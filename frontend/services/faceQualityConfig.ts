/**
 * Face Quality Configuration
 * 
 * This module defines the OPERATING THRESHOLDS for UX and quality pre-screening
 * on the frontend. It is NOT a security authority. It exists solely to classify 
 * frames so the UI can give users targeted coaching ("Move closer", "More light", etc.)
 * rather than failing silently with generic timeouts.
 * 
 * The actual authentication decision (identity match and liveness) is performed
 * exclusively by the backend Fusion and Policy engines.
 */

export const FACE_QUALITY_CONFIG = {
    // Positioning (Center of bounding box relative to frame)
    CENTER_X_MIN: 0.30,
    CENTER_X_MAX: 0.70,
    CENTER_Y_MIN: 0.25,
    CENTER_Y_MAX: 0.75,
    
    // Sizing (Bounding box area relative to frame area)
    BBOX_MIN: 0.05,
    BBOX_MAX: 0.70,
    
    // Lighting & Sharpness
    BRIGHTNESS_MIN: 30,
    BRIGHTNESS_MAX: 240,
    
    // Blur Score (Laplacian variance). 
    // 20.0 is a calibrated operating threshold for typical webcam JPEG compression.
    // Sharp phone photos will easily pass this (so this is NOT an anti-spoof measure).
    BLUR_MIN: 20.0,
    
    // Minimum confidence from the detector to consider it a face for UX purposes.
    // Note: The python backend det_thresh is set to 0.50, so anything below 
    // that won't even be returned as a face bounding box.
    CONFIDENCE_MIN: 0.50
} as const;

/**
 * Liveness Pose Configuration
 * 
 * Defines the canonical head pose thresholds for liveness detection.
 * Physical testing confirms that:
 * - Physical LEFT -> POSITIVE Yaw
 * - Physical RIGHT -> NEGATIVE Yaw
 */
export const LIVENESS_POSE_CONFIG = {
    // Relative movement required from neutral pose to pass a turn challenge
    turnYawMin: 0.15, // Radians
    
    // Number of consecutive frames the user must hold the valid pose
    requiredConsecutiveFrames: 3,
    
    // How many frames to collect per challenge state before triggering a timeout
    maxFramesPerChallenge: 25,
} as const;
