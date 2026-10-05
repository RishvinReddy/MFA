import Redis from 'ioredis';
import { RedisStore } from 'rate-limit-redis';
import express from 'express';
import rateLimit from 'express-rate-limit';

const app = express();

const client = new Redis('redis://localhost:9999', {
    maxRetriesPerRequest: 1,
    connectTimeout: 1000,
});

const store = new RedisStore({
    sendCommand: (...args: string[]) => client.call(...args),
    passOnStoreError: false // Do not fail open! If true, it ignores errors and allows request. If false, it passes error to next() (Express standard error handling -> 500 error).
});

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    store: store,
    passOnStoreError: false, // In express-rate-limit 7+ it might be configured here instead of RedisStore.
    handler: (req, res, next, options) => {
        res.status(options.statusCode).send(options.message);
    }
});

app.use(limiter);

app.get('/', (req, res) => res.send('OK'));

app.use((err: any, req: any, res: any, next: any) => {
    console.error("Error caught:", err.message);
    res.status(500).json({ error: "Rate limit unavailable - fail closed" });
});

app.listen(3000, () => {
    console.log('Test server started');
});
