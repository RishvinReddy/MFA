import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import routes from './routes';
import authRoutes from './routes/auth.routes';
import biometricRoutes from './routes/biometric.routes';
import forensicRoutes from './routes/forensic.routes';
import webauthnRoutes from './routes/webauthn.routes';
import mfaRoutes from './routes/mfa.routes';
import adminRoutes from './routes/admin.routes';
import { errorHandler, apiLimiter } from './middleware';
import { CryptoService } from './services/crypto.service';
import { requestLogger } from './middlewares/requestLogger';
import { logger } from './utils/logger';

dotenv.config();

// 0. Environment Configuration Validation
const requiredConfig = [
    'DATABASE_URL',
    'JWT_SECRET',
    'MASTER_KEY_HEX',
    'BIOMETRIC_SERVICE_URL',
    'BIOMETRIC_API_KEY'
];

for (const key of requiredConfig) {
    if (!process.env[key]) {
        logger.error(`CRITICAL STARTUP FAILURE: Mandatory configuration '${key}' is missing.`);
        process.exit(1);
    }
}

// 1. Hardened Boot Check
try {
    CryptoService.validateBiometricKey();
} catch (error: any) {
    logger.error(error.message);
    process.exit(1);
}

const app = express();
const port = process.env.PORT || 8080;

// 1. Security Headers (Helmet) & CORS
app.use(helmet());
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173,http://localhost:8080').split(',');
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));

// 2. Body Parsing
app.use(express.json({ limit: '10mb' }) as any); // Limit payload size
app.use(express.urlencoded({ extended: true }) as any);

// 3. Request Logging (Audit prep)
app.use(requestLogger);

// 4. API Routes
app.use('/api', apiLimiter, routes);

// 5. Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', version: '1.2.0', env: process.env.NODE_ENV });
});

// 6. Global Error Handler
app.use(errorHandler);

let server: any;
if (require.main === module) {
    server = app.listen(port, () => {
        logger.info(`🛡️ BioShield Enterprise Backend listening on port ${port}`);
    });

    // 7. Background Workers
    const startSessionCleanupWorker = () => {
        setInterval(async () => {
            try {
                const { PrismaClient } = require('@prisma/client');
                const prisma = new PrismaClient();
                const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                const result = await prisma.authSession.deleteMany({
                    where: {
                        status: 'TERMINATED',
                        updatedAt: { lt: thirtyDaysAgo }
                    }
                });
                if (result.count > 0) {
                    logger.info(`[Worker] Cleaned up ${result.count} stale TERMINATED sessions.`);
                }
            } catch (err) {
                logger.error('[Worker] Error during session cleanup:', err);
            }
        }, 60 * 60 * 1000); // Run every hour
    };
    startSessionCleanupWorker();

    // Graceful Shutdown
    (process as any).on('SIGTERM', async () => {
        logger.info('SIGTERM received. Shutting down gracefully...');
        server.close(() => {
            logger.info('HTTP server closed');
            (process as any).exit(0);
        });
    });

    (process as any).on('SIGINT', async () => {
        logger.info('SIGINT received. Shutting down gracefully...');
        server.close(() => {
            logger.info('HTTP server closed');
            (process as any).exit(0);
        });
    });
}

export default app;