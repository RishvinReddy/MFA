import express from 'express';
import authRoutes from './auth.routes';
import adminRoutes from './admin.routes';
import biometricRoutes from './biometric.routes';
import forensicRoutes from './forensic.routes';
import mfaRoutes from './mfa.routes';
import vaultRoutes from './vault.routes';
import aiRoutes from './ai.routes';
import { webAuthnRoutes } from './webauthn.routes';
import { SystemDiagnosticsService } from '../services/systemDiagnostics.service';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/ai', aiRoutes);
router.use('/webauthn', webAuthnRoutes);
router.use('/biometric', biometricRoutes);
router.use('/forensics', forensicRoutes);
router.use('/auth/webauthn', webAuthnRoutes);
router.use('/mfa', mfaRoutes);
router.use('/vault', vaultRoutes);

// Real Secure Boot Native Telemetry Endpoint
router.get('/system-boot', async (req, res) => {
    try {
        const diagnostics = await SystemDiagnosticsService.runDiagnostics();
        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            ...diagnostics
        });
    } catch (err: any) {
        res.status(500).json({
            success: false,
            error: 'Backend system diagnostic check failed',
            details: err.message
        });
    }
});

import { PersistenceScannerService } from '../services/persistenceScanner.service';

router.get('/system-persistence', async (req, res) => {
    try {
        const findings = await PersistenceScannerService.runDiscovery();
        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            findings
        });
    } catch (err: any) {
        res.status(500).json({
            success: false,
            error: 'Persistence scanner failed',
            details: err.message
        });
    }
});

export default router;
