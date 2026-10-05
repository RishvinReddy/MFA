import express from 'express';
import multer from 'multer';
import { registerBiometric, verifyBiometric, revokeBiometric, getBiometricStats, validateVoiceSample, finalizeVoiceEnrollment } from '../controllers/biometric.controller';
import { requireActiveSession, requireChallengeSession, authorize, requireActiveSessionOrEnrollmentToken } from '../middleware';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post(
    '/register',
    requireActiveSessionOrEnrollmentToken,
    upload.fields([{ name: 'face', maxCount: 30 }, { name: 'voice', maxCount: 1 }]),
    registerBiometric
);

router.post(
    '/validate-voice-sample',
    requireActiveSessionOrEnrollmentToken,
    upload.fields([{ name: 'voice', maxCount: 1 }]),
    validateVoiceSample
);

router.post(
    '/finalize-voice-enrollment',
    requireActiveSessionOrEnrollmentToken,
    finalizeVoiceEnrollment
);

router.post(
    '/verify',
    requireChallengeSession,
    upload.fields([{ name: 'face', maxCount: 30 }, { name: 'voice', maxCount: 1 }]),
    verifyBiometric
);

router.post('/revoke', requireActiveSession, revokeBiometric);

// Admin only route for analytics
router.get('/stats', authorize(['ADMIN']), getBiometricStats);

export default router;
