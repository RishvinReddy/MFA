process.env.JWT_SECRET = 'test_secret';
import request from 'supertest';
import express from 'express';
import { loginLimiter } from '../../src/middleware';
import { cacheService } from '../../src/services/cache.service';

// Ensure the real rate-limit-redis is used, not the __mocks__ version
jest.unmock('rate-limit-redis');

const app = express();
app.use(express.json());
app.post('/test-login-integration', loginLimiter, (req, res) => {
    res.status(200).json({ success: true });
});

// Skip tests if real Redis is not requested via env var
const REDIS_AVAILABLE = process.env.REDIS_AVAILABLE === 'true';

const describeIfRedis = REDIS_AVAILABLE ? describe : describe.skip;

describeIfRedis('Rate Limiter - Real Redis Integration', () => {
    beforeAll(async () => {
        // Wait a brief moment to ensure cacheService has connected to the real Redis instance
        await new Promise(resolve => setTimeout(resolve, 500));
    });

    afterAll(async () => {
        await cacheService.close();
    });

    it('should correctly rate limit after 20 requests against real Redis', async () => {
        // Assume empty slate (make sure to use a unique endpoint or IP/key if needed,
        // though supertest uses a single localhost IP typically, which rate-limit-redis keys off of).
        
        // First 20 requests should pass
        for (let i = 0; i < 20; i++) {
            const res = await request(app).post('/test-login-integration').send();
            expect(res.status).toBe(200);
        }

        // 21st request should be rate limited
        const res21 = await request(app).post('/test-login-integration').send();
        expect(res21.status).toBe(429);
        expect(res21.body.success).toBe(false);
        expect(res21.body.error.message).toContain('Too many login attempts');
    });
});
