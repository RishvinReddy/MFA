import { Router } from 'express';
import { chat, checkHealth } from '../controllers/ai.controller';
import { apiLimiter } from '../middleware';

const router = Router();

router.get('/health', checkHealth);
router.post('/chat', apiLimiter, chat);

export default router;
