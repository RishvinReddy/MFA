import express from 'express';
import { requireActiveSession, requirePrivilegedAction } from '../middleware';
import { decryptVaultDocument } from '../controllers/vault.controller';

const router = express.Router();

router.use(requireActiveSession);

// Secure Vault operations are strictly protected by continuous authentication policy
router.post('/decrypt', requirePrivilegedAction, decryptVaultDocument);

export default router;
