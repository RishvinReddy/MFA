import express from 'express';
import { requireActiveSession, authorize, requirePrivilegedAction } from '../middleware';
import { getOverview, getStats, getUsers, createUser, getSessions, revokeSession, getAuditLogs, disableUser, enableUser, forceLogout, resetMfa, getSystemHealth, getAiTelemetry } from '../controllers/admin.controller';

const router = express.Router();

// Apply Auth & Admin check to all routes in this router
router.use(requireActiveSession);
router.use(authorize(['ADMIN', 'PRIMARY_ADMIN']));

router.get('/overview', getOverview);
router.post('/users', requirePrivilegedAction, createUser);
router.get('/users', getUsers);
router.get('/sessions', getSessions);
router.get('/audit', getAuditLogs);
router.delete('/session/:id', requirePrivilegedAction, revokeSession);
router.patch('/user/:id/disable', requirePrivilegedAction, disableUser);
router.patch('/user/:id/enable', requirePrivilegedAction, enableUser);
router.post('/user/:id/force-logout', requirePrivilegedAction, forceLogout);
router.post('/user/:id/reset-mfa', requirePrivilegedAction, resetMfa);

router.post('/stats', getStats);
router.get('/system-health', getSystemHealth);
router.get('/ai-telemetry', getAiTelemetry);

export default router;
