import { cacheService } from '../../src/services/cache.service';

const REDIS_AVAILABLE = process.env.REDIS_AVAILABLE === 'true';

const testIfRedis = REDIS_AVAILABLE ? describe : describe.skip;

testIfRedis('Redis Integration Tests', () => {
    beforeAll(async () => {
        // Wait for Redis connection to stabilize if testing against real Redis
        await new Promise(resolve => setTimeout(resolve, 500));
    });

    afterAll(async () => {
        await cacheService.close();
    });

    it('OTP flow: atomic consumption and attempt counting', async () => {
        const key = 'bioshield:otp:prereg:integrationtest@example.com';
        const code = '123456';
        
        // Setup initial OTP payload
        await cacheService.set(key, JSON.stringify({ code, attempts: 0 }), 5);

        // Incorrect attempt 1
        let result = await cacheService.verifyOtp(key, 'wrong', 3);
        expect(result).toBe('INVALID_CODE');

        // Incorrect attempt 2
        result = await cacheService.verifyOtp(key, 'wrong', 3);
        expect(result).toBe('INVALID_CODE');

        // Incorrect attempt 3 - should consume
        result = await cacheService.verifyOtp(key, 'wrong', 3);
        expect(result).toBe('TOO_MANY_ATTEMPTS');

        // Verify it was consumed
        const existsAfterMax = await cacheService.exists(key);
        expect(existsAfterMax).toBe(false);

        // Reset
        await cacheService.set(key, JSON.stringify({ code, attempts: 0 }), 5);
        
        // Correct attempt - should succeed and consume
        result = await cacheService.verifyOtp(key, '123456', 3);
        expect(result).toBe('SUCCESS');

        // Verify consumed
        const existsAfterSuccess = await cacheService.exists(key);
        expect(existsAfterSuccess).toBe(false);
    });

    it('OTP flow: TTL expiry', async () => {
        const key = 'bioshield:otp:prereg:integrationtest2@example.com';
        const code = '123456';
        
        // Set short TTL
        await cacheService.set(key, JSON.stringify({ code, attempts: 0 }), 1);
        
        // Wait for expiry
        await new Promise(resolve => setTimeout(resolve, 1100));

        const result = await cacheService.verifyOtp(key, code, 3);
        expect(result).toBe('NOT_FOUND');
    });

    it('WebAuthn flow: compareAndDelete atomicity', async () => {
        const key = 'bioshield:webauthn:challenge:testuser';
        const challenge = 'random_challenge_string';

        // Setup challenge
        await cacheService.set(key, challenge);

        // Attempt to consume with wrong challenge
        let consumed = await cacheService.compareAndDelete(key, 'wrong_challenge');
        expect(consumed).toBe(false);

        // Verify it's still there
        const existsAfterFail = await cacheService.exists(key);
        expect(existsAfterFail).toBe(true);

        // Consume with correct challenge
        consumed = await cacheService.compareAndDelete(key, challenge);
        expect(consumed).toBe(true);

        // Verify it's gone
        const existsAfterSuccess = await cacheService.exists(key);
        expect(existsAfterSuccess).toBe(false);

        // Try to consume again (replay)
        const consumedReplay = await cacheService.compareAndDelete(key, challenge);
        expect(consumedReplay).toBe(false);
    });
});

describe('Redis Unavailable Fallback', () => {
    it('returns null/error safely when Redis is offline', async () => {
        // If we are genuinely running tests without Redis, we can test the fallback directly.
        if (!REDIS_AVAILABLE) {
            // cacheService is offline locally. Let's ensure it doesn't crash.
            const resultOtp = await cacheService.verifyOtp('test', 'code', 3);
            const resultChallenge = await cacheService.compareAndDelete('test', 'value');
            
            expect(resultOtp).toBe('ERROR');
            expect(resultChallenge).toBe(false);
        }
    });
});
