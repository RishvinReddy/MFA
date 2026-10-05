import express from 'express';
import { analyzeAlert } from '../controllers/forensic.controller';
import { requireActiveSession, authorize } from '../middleware';

const router = express.Router();

router.use(requireActiveSession);

// Just keeping analyzeAlert for now
router.post('/analyze-alert', analyzeAlert);

export default router;
