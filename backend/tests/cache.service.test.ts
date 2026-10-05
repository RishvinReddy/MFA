import { cacheService } from '../src/services/cache.service';
import Redis from 'ioredis';

// Mock the ioredis module
jest.mock('ioredis', () => {
    return jest.fn().mockImplementation(() => {
        return {
            on: jest.fn(),
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            exists: jest.fn(),
            eval: jest.fn(),
            quit: jest.fn(),
        };
    });
});

describe('CacheService Unit Tests', () => {
    let mockRedisClient: any;

    beforeEach(() => {
        jest.clearAllMocks();
        // Force the service to re-initialize or explicitly set properties for testing
        // Since it's a singleton and we can't easily reset its constructor, we access private/public fields.
        cacheService.isConnected = true;
        mockRedisClient = {
            eval: jest.fn(),
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
        };
        (cacheService as any).client = mockRedisClient;
    });

    it('should execute verifyOtp Lua script and handle SUCCESS', async () => {
        mockRedisClient.eval.mockResolvedValueOnce('SUCCESS');

        const result = await cacheService.verifyOtp('testKey', '123456', 3);

        expect(result).toBe('SUCCESS');
        expect(mockRedisClient.eval).toHaveBeenCalledTimes(1);
    });

    it('should execute verifyOtp Lua script and handle INVALID_CODE', async () => {
        mockRedisClient.eval.mockResolvedValueOnce('INVALID_CODE');

        const result = await cacheService.verifyOtp('testKey', 'wrong', 3);

        expect(result).toBe('INVALID_CODE');
    });

    it('should execute compareAndDelete Lua script and handle true', async () => {
        mockRedisClient.eval.mockResolvedValueOnce(1); // 1 = true

        const result = await cacheService.compareAndDelete('challengeKey', 'challengeValue');

        expect(result).toBe(true);
        expect(mockRedisClient.eval).toHaveBeenCalledTimes(1);
    });

    it('should return safe failure if Redis is disconnected', async () => {
        cacheService.isConnected = false;

        const resultOtp = await cacheService.verifyOtp('testKey', '123456', 3);
        const resultChallenge = await cacheService.compareAndDelete('testKey', 'value');

        expect(resultOtp).toBe('ERROR');
        expect(resultChallenge).toBe(false);
        expect(mockRedisClient.eval).not.toHaveBeenCalled();
    });
});
