import express from 'express';
import { setupTotp, verifyTotpSetup, verifyLoginTotp, sendEmailOtp, verifyEmail, sendPreRegOtp, verifyPreRegOtp } from '../controllers/mfa.controller';
import { requireChallengeSession, requireActiveSession, requireActiveSessionOrEnrollmentToken, loginLimiter } from '../middleware';

const router = express.Router();

router.post('/totp/setup', requireActiveSessionOrEnrollmentToken, setupTotp);
router.post('/totp/verify', requireActiveSessionOrEnrollmentToken, loginLimiter, verifyTotpSetup);

router.post('/totp/verify-login', requireChallengeSession, loginLimiter, verifyLoginTotp);
router.post('/send-email-code', requireChallengeSession, sendEmailOtp);
router.post('/verify-email', requireChallengeSession, loginLimiter, verifyEmail);

router.post('/email/send-pre-reg', sendPreRegOtp);
router.post('/email/verify-pre-reg', loginLimiter, verifyPreRegOtp);

export default router;
