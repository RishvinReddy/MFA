import express from 'express';
import { register, login, logout, me, getMyAuditLogs, getMyAiTelemetry, refreshToken, getSessionStatus, getEnrollmentStatus, continuousVerify, generateLivenessChallenge } from '../controllers/auth.controller';
import { requireActiveSession, requireActiveSessionOrEnrollmentToken, loginLimiter } from '../middleware';
import multer from 'multer';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/register', register);
router.post('/login', loginLimiter, login);
router.post('/refresh', refreshToken);
router.get('/session-status', getSessionStatus);
router.get('/enrollment-status', requireActiveSessionOrEnrollmentToken, getEnrollmentStatus);

// Protected routes (either active session or enrollment)
router.use(requireActiveSessionOrEnrollmentToken);
router.post('/generate-challenge', generateLivenessChallenge);

router.use(requireActiveSession);

router.post('/logout', logout);
router.post('/continuous-verify', upload.single('face'), continuousVerify);
router.get('/me', me);
router.get('/audit', getMyAuditLogs);
router.get('/ai-telemetry', getMyAiTelemetry);

export default router;
