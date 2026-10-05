import prisma from '../prisma';
import { logger } from '../utils/logger';

export interface AuditLogEntry {
    userId?: string;
    action: string;
    metadata?: any;
}

/**
 * Logs a security event
 */
export async function logEvent(entry: AuditLogEntry) {
    const { userId, action, metadata } = entry;

    try {
        await prisma.auditLog.create({
            data: {
                userId,
                action,
                metadata: metadata || {}
            }
        });
        logger.info(`[AUDIT] Action: ${action}, User: ${userId || 'System'}`, { action, userId, metadata });
    } catch (error) {
        logger.error('Failed to write audit log:', error);
    }
}
