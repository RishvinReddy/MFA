import express from 'express';
import {
  generateRegistrationOptionsHandler,
  verifyRegistrationHandler,
  generateAuthenticationOptionsHandler,
  verifyAuthenticationHandler
} from '../controllers/webauthn.controller';
import { requireActiveSession, requireChallengeSession } from '../middleware';

const router = express.Router();

router.post('/register/options', requireActiveSession, generateRegistrationOptionsHandler);
router.post('/register/verify', requireActiveSession, verifyRegistrationHandler);

// Assuming authentication might happen during challenge state
router.post('/authenticate/options', requireChallengeSession, generateAuthenticationOptionsHandler);
router.post('/authenticate/verify', requireChallengeSession, verifyAuthenticationHandler);

export { router as webAuthnRoutes };
export default router;
