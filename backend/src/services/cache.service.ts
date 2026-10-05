import Redis from 'ioredis';
import { logger } from '../utils/logger';

class CacheService {
    private client: Redis | null = null;
    public isConnected: boolean = false;
    private isClosed: boolean = false;

    constructor() {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        
        if (process.env.NODE_ENV === 'test') {
            // In tests, we mock Redis or don't need real connections
            this.client = null;
            this.isConnected = false;
            return;
        }
        
        try {
            this.client = new Redis(redisUrl, {
                // Ensure it doesn't indefinitely block the application if Redis is down
                maxRetriesPerRequest: 3,
                connectTimeout: 5000,
                retryStrategy: (times) => {
                    // Reconnect after
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                }
            });

            this.client.on('connect', () => {
                this.isConnected = true;
                logger.info('[CacheService] Connected to Redis successfully');
            });

            this.client.on('error', (err) => {
                this.isConnected = false;
                if (!this.isClosed) {
                    logger.error('[CacheService] Redis connection error:', err.message);
                }
            });

            this.client.on('close', () => {
                this.isConnected = false;
                if (!this.isClosed) {
                    logger.warn('[CacheService] Redis connection closed');
                }
            });

        } catch (error: any) {
            logger.error('[CacheService] Failed to initialize Redis:', error.message);
            this.client = null;
            this.isConnected = false;
        }
    }

    /**
     * Get a value from the cache.
     * Fails safely if Redis is unavailable (returns null).
     */
    async get(key: string): Promise<string | null> {
        if (!this.client || !this.isConnected) {
            logger.warn(`[CacheService] Redis is unavailable. Cannot get key: ${key}`);
            return null;
        }
        try {
            return await this.client.get(key);
        } catch (error: any) {
            logger.error(`[CacheService] Error getting key ${key}:`, error.message);
            return null;
        }
    }

    /**
     * Set a value in the cache with an optional TTL (in seconds).
     * Fails safely if Redis is unavailable.
     */
    async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
        if (!this.client || !this.isConnected) {
            logger.warn(`[CacheService] Redis is unavailable. Cannot set key: ${key}`);
            return false;
        }
        try {
            if (ttlSeconds) {
                await this.client.set(key, value, 'EX', ttlSeconds);
            } else {
                await this.client.set(key, value);
            }
            return true;
        } catch (error: any) {
            logger.error(`[CacheService] Error setting key ${key}:`, error.message);
            return false;
        }
    }

    /**
     * Delete a value from the cache.
     * Fails safely if Redis is unavailable.
     */
    async delete(key: string): Promise<boolean> {
        if (!this.client || !this.isConnected) {
            logger.warn(`[CacheService] Redis is unavailable. Cannot delete key: ${key}`);
            return false;
        }
        try {
            await this.client.del(key);
            return true;
        } catch (error: any) {
            logger.error(`[CacheService] Error deleting key ${key}:`, error.message);
            return false;
        }
    }

    /**
     * Check if a key exists in the cache.
     * Fails safely if Redis is unavailable.
     */
    async exists(key: string): Promise<boolean> {
        if (!this.client || !this.isConnected) {
            logger.warn(`[CacheService] Redis is unavailable. Cannot check existence of key: ${key}`);
            return false;
        }
        try {
            const result = await this.client.exists(key);
            return result === 1;
        } catch (error: any) {
            logger.error(`[CacheService] Error checking existence of key ${key}:`, error.message);
            return false;
        }
    }

    /**
     * Atomically verifies an OTP code and manages its attempt counter.
     * @returns 'SUCCESS' | 'INVALID_CODE' | 'TOO_MANY_ATTEMPTS' | 'NOT_FOUND' | 'ERROR'
     */
    async verifyOtp(key: string, code: string, maxAttempts: number): Promise<'SUCCESS' | 'INVALID_CODE' | 'TOO_MANY_ATTEMPTS' | 'NOT_FOUND' | 'ERROR'> {
        if (!this.client || !this.isConnected) {
            logger.warn(`[CacheService] Redis is unavailable. Cannot verify OTP key: ${key}`);
            return 'ERROR';
        }

        const script = `
            local key = KEYS[1]
            local codeArg = ARGV[1]
            local maxAttempts = tonumber(ARGV[2])

            local data = redis.call('GET', key)
            if not data then return "NOT_FOUND" end

            local decoded = cjson.decode(data)
            local storedCode = decoded.code
            local attempts = tonumber(decoded.attempts) or 0

            if storedCode == codeArg then
                redis.call('DEL', key)
                return "SUCCESS"
            else
                attempts = attempts + 1
                if attempts >= maxAttempts then
                    redis.call('DEL', key)
                    return "TOO_MANY_ATTEMPTS"
                else
                    decoded.attempts = attempts
                    local ttl = redis.call('PTTL', key)
                    if ttl > 0 then
                        redis.call('SET', key, cjson.encode(decoded), 'PX', ttl)
                    else
                        redis.call('SET', key, cjson.encode(decoded))
                    end
                    return "INVALID_CODE"
                end
            end
        `;

        try {
            const result = await this.client.eval(script, 1, key, code, maxAttempts);
            return result as 'SUCCESS' | 'INVALID_CODE' | 'TOO_MANY_ATTEMPTS' | 'NOT_FOUND';
        } catch (error: any) {
            logger.error(`[CacheService] Error executing verifyOtp for key ${key}:`, error.message);
            return 'ERROR';
        }
    }

    /**
     * Atomically compares a key's value with an expected value and deletes it if it matches.
     * @returns true if deleted, false if mismatch or not found
     */
    async compareAndDelete(key: string, expectedValue: string): Promise<boolean> {
        if (!this.client || !this.isConnected) {
            logger.warn(`[CacheService] Redis is unavailable. Cannot perform compareAndDelete for key: ${key}`);
            return false;
        }

        const script = `
            if redis.call('GET', KEYS[1]) == ARGV[1] then
                return redis.call('DEL', KEYS[1])
            else
                return 0
            end
        `;

        try {
            const result = await this.client.eval(script, 1, key, expectedValue);
            return result === 1;
        } catch (error: any) {
            logger.error(`[CacheService] Error executing compareAndDelete for key ${key}:`, error.message);
            return false;
        }
    }

    /**
     * Closes the Redis connection.
     */
    async close(): Promise<void> {
        this.isClosed = true;
        if (this.client) {
            if (typeof this.client.removeAllListeners === 'function') {
                this.client.removeAllListeners('close');
                this.client.removeAllListeners('error');
            }
            if (typeof this.client.disconnect === 'function') {
                this.client.disconnect();
            } else if (typeof this.client.quit === 'function') {
                await this.client.quit();
            }
            this.client = null;
            this.isConnected = false;
        }
    }
}

// Export a singleton instance
export const cacheService = new CacheService();
