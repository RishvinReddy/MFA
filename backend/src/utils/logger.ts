import { randomUUID } from 'crypto';

export const SENSITIVE_KEYS = [
    'password',
    'secret',
    'token',
    'refreshtoken',
    'authorization',
    'x-enrollment-token',
    'mfasecret',
    'embedding',
    'rawembedding',
    'biometric',
    'masterkey'
];

function isPlainObject(val: any): boolean {
    return !!val && typeof val === 'object' && val.constructor === Object;
}

export function redact(data: any, seen = new WeakSet()): any {
    if (data === null || data === undefined) return data;
    
    if (typeof data !== 'object') {
        return data;
    }

    if (seen.has(data)) {
        return '[CIRCULAR]';
    }

    seen.add(data);

    if (Array.isArray(data)) {
        return data.map(item => redact(item, seen));
    }

    if (isPlainObject(data)) {
        const redactedObj: any = {};
        for (const [key, value] of Object.entries(data)) {
            const lowerKey = key.toLowerCase();
            if (SENSITIVE_KEYS.some(k => lowerKey.includes(k))) {
                redactedObj[key] = '[REDACTED]';
            } else {
                redactedObj[key] = redact(value, seen);
            }
        }
        return redactedObj;
    }

    // Pass through Dates, RegExps, etc.
    return data;
}

export const logger = {
    _format(level: string, message: string, meta?: any) {
        const payload = {
            timestamp: new Date().toISOString(),
            level,
            message,
            ...redact(meta)
        };

        if (process.env.NODE_ENV === 'production') {
            return JSON.stringify(payload);
        } else {
            // Human readable for development
            const reqId = payload.requestId ? `[${payload.requestId}] ` : '';
            const metaStr = meta ? `\n  ${JSON.stringify(redact(meta), null, 2)}` : '';
            return `[${payload.timestamp}] ${level.toUpperCase()}: ${reqId}${message}${metaStr}`;
        }
    },

    info(message: string, meta?: any) {
        console.info(this._format('info', message, meta));
    },

    warn(message: string, meta?: any) {
        console.warn(this._format('warn', message, meta));
    },

    error(message: string, meta?: any) {
        console.error(this._format('error', message, meta));
    },

    debug(message: string, meta?: any) {
        if (process.env.NODE_ENV !== 'production') {
            console.debug(this._format('debug', message, meta));
        }
    }
};
