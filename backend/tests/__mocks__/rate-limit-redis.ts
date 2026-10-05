import { MemoryStore } from 'express-rate-limit';

// Mock RedisStore to use MemoryStore during standard Jest tests
// This allows the 88/88 test regression suite to pass without a real Redis instance
export const RedisStore = jest.fn().mockImplementation(() => {
    return new MemoryStore();
});
