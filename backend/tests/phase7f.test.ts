import { logger, redact, SENSITIVE_KEYS } from '../src/utils/logger';

describe('Phase 7F — Secure Observability', () => {
    let originalEnv: string | undefined;

    beforeAll(() => {
        originalEnv = process.env.NODE_ENV;
    });

    afterAll(() => {
        process.env.NODE_ENV = originalEnv;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('1. Production logger emits valid JSON', () => {
        process.env.NODE_ENV = 'production';
        const spy = jest.spyOn(console, 'info').mockImplementation();
        logger.info('Test message', { foo: 'bar' });
        
        expect(spy).toHaveBeenCalled();
        const callArgs = spy.mock.calls[0][0];
        
        // Should parse cleanly
        const parsed = JSON.parse(callArgs);
        expect(parsed.message).toBe('Test message');
        expect(parsed.foo).toBe('bar');
        expect(parsed.timestamp).toBeDefined();
        expect(parsed.level).toBe('info');
    });

    it('2. Development logger remains readable', () => {
        process.env.NODE_ENV = 'development';
        const spy = jest.spyOn(console, 'info').mockImplementation();
        logger.info('Test message', { requestId: 'req-123', foo: 'bar' });
        
        expect(spy).toHaveBeenCalled();
        const output = spy.mock.calls[0][0];
        
        // Not JSON
        expect(() => JSON.parse(output)).toThrow();
        expect(output).toContain('[req-123]');
        expect(output).toContain('Test message');
        expect(output).toContain('foo');
    });

    it('3. password is redacted', () => {
        const payload = { user: 'admin', password: 'secretpassword123' };
        const result = redact(payload);
        
        expect(result.password).toBe('[REDACTED]');
        expect(result.user).toBe('admin');
    });

    it('4. JWT/token values are redacted', () => {
        const payload = { token: 'eyJhbG...', refreshToken: 'abcdef123456' };
        const result = redact(payload);
        
        expect(result.token).toBe('[REDACTED]');
        expect(result.refreshToken).toBe('[REDACTED]');
    });

    it('5. Authorization headers are redacted', () => {
        const payload = { headers: { authorization: 'Bearer 1234' } };
        const result = redact(payload);
        
        expect(result.headers.authorization).toBe('[REDACTED]');
    });

    it('6. enrollment tokens are redacted', () => {
        const payload = { 'x-enrollment-token': 'secure-token' };
        const result = redact(payload);
        
        expect(result['x-enrollment-token']).toBe('[REDACTED]');
    });

    it('7. nested secrets are redacted', () => {
        const payload = {
            request: {
                body: {
                    user: {
                        mfaSecret: 'otpauth://...'
                    }
                }
            }
        };
        const result = redact(payload);
        
        expect(result.request.body.user.mfaSecret).toBe('[REDACTED]');
    });

    it('8. biometric payloads are redacted', () => {
        const payload = {
            payloads: [
                { type: 'face', rawEmbedding: [0.1, 0.2] },
                { type: 'voice', biometric: 'base64...' }
            ]
        };
        const result = redact(payload);
        
        expect(result.payloads[0].rawEmbedding).toBe('[REDACTED]');
        expect(result.payloads[1].biometric).toBe('[REDACTED]');
    });

    it('9. non-sensitive telemetry remains visible', () => {
        const payload = { durationMs: 125, method: 'POST', status: 200, riskScore: 0.1 };
        const result = redact(payload);
        
        expect(result).toEqual(payload);
    });

    it('10. logger never throws on circular/unexpected data', () => {
        const circularObj: any = { a: 1 };
        circularObj.self = circularObj;
        
        const result = redact(circularObj);
        expect(result.self).toBe('[CIRCULAR]');
        
        // Also unexpected data types
        expect(redact(null)).toBeNull();
        expect(redact(undefined)).toBeUndefined();
        expect(redact('string')).toBe('string');
        expect(redact(123)).toBe(123);
        
        // Process shouldn't crash
        process.env.NODE_ENV = 'production';
        const spy = jest.spyOn(console, 'info').mockImplementation();
        expect(() => logger.info('Test', circularObj)).not.toThrow();
    });
});
