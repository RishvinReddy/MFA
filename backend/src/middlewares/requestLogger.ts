import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';

declare global {
    namespace Express {
        interface Request {
            id: string;
        }
    }
}

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
    // Generate correlation ID
    req.id = req.headers['x-request-id'] as string || randomUUID();
    
    // Pass to response header
    res.setHeader('X-Request-Id', req.id);

    const start = Date.now();

    // Log request start
    logger.info(`Incoming ${req.method} ${req.url}`, {
        requestId: req.id,
        method: req.method,
        url: req.url,
        ip: req.ip
        // Do not log body to avoid huge logs or accidental secrets
    });

    // Log request finish
    res.on('finish', () => {
        const duration = Date.now() - start;
        const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
        
        logger[level](`Completed ${req.method} ${req.url} ${res.statusCode}`, {
            requestId: req.id,
            method: req.method,
            url: req.url,
            status: res.statusCode,
            durationMs: duration
        });
    });

    next();
};
