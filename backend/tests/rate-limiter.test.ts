import request from 'supertest';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';

// We must unmock rate-limit-redis to test the actual fail-closed proxy
jest.unmock('rate-limit-redis');

describe('Rate Limiter - Fail Closed Semantics', () => {
    let app: express.Express;
    let isRedisOnline = false;
    let localMockCall: jest.Mock;

    beforeEach(() => {
        isRedisOnline = false;
        localMockCall = jest.fn().mockImplementation((command, ...args) => {
            if (command.toUpperCase() === 'SCRIPT') return 'mock-sha';
            if (command.toUpperCase() === 'EVALSHA') return [1, 60000];
            return [];
        });
    });

    const setupApp = () => {
        app = express();
        app.use(express.json());
        
        const sendCommand = async (...args: string[]) => {
            if (!isRedisOnline) {
                throw new Error('Redis is offline');
            }
            return localMockCall(...args);
        };

        const testLimiter = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 20,
            store: new RedisStore({ sendCommand }),
            passOnStoreError: false,
            message: { success: false, error: { code: 429, message: 'Too many login attempts' } }
        });

        app.post('/test-login', testLimiter, (req, res) => {
            res.status(200).json({ success: true });
        });

        app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
            res.status(500).json({ success: false, message: err.message });
        });
    };

    it('should block requests with 500 when Redis is unavailable (Fail Closed)', async () => {
        // Leave Redis offline
        setupApp();
        const res = await request(app).post('/test-login').send();
        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
    });

    it('should allow requests when Redis is available', async () => {
        // Setup Redis as online BEFORE initializing the app
        isRedisOnline = true;
        setupApp();

        const res = await request(app).post('/test-login').send();
        if (res.status !== 200) console.error(res.body);
        
        expect(res.status).toBe(200);
        expect(localMockCall).toHaveBeenCalled();
    });

    it('should enforce rate limits correctly with mock client', async () => {
        localMockCall.mockImplementation((command, ...args) => {
            if (command.toUpperCase() === 'SCRIPT') return 'mock-sha';
            if (command.toUpperCase() === 'EVALSHA') return [21, 60000];
            return [];
        });
        isRedisOnline = true;
        setupApp();

        const res = await request(app).post('/test-login').send();
        
        // Should hit 429 because the mock Redis told it the limit was exceeded
        expect(res.status).toBe(429);
        expect(res.body.success).toBe(false);
        expect(res.body.error.message).toContain('Too many login attempts');
    });
});
