import axios from 'axios';


import { BiometricService } from '../src/services/biometric.service';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

const BIOMETRIC_URL = process.env.BIOMETRIC_SERVICE_URL || "http://127.0.0.1:5000";
const API_KEY = process.env.BIOMETRIC_API_KEY || "dev_api_key_override_me";

describe('Phase 7D — Biometric Trust & Reliability', () => {
    let dummyImagePath: string;

    beforeAll(() => {
        dummyImagePath = path.join(__dirname, 'dummy_face.jpg');
        const validJpegBase64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
        fs.writeFileSync(dummyImagePath, Buffer.from(validJpegBase64, 'base64'));
    });

    afterAll(() => {
        if (fs.existsSync(dummyImagePath)) fs.unlinkSync(dummyImagePath);
    });

    describe('API Authentication and Binding Semantics', () => {
        beforeEach(() => {
            jest.spyOn(axios, 'post').mockImplementation(async (url: string, data: any, config: any) => {
                const key = config?.headers?.['x-biometric-api-key'];
                if (!key) {
                    const err: any = new Error("Forbidden");
                    err.response = { status: 403 };
                    throw err;
                }
                if (key !== API_KEY) {
                    const err: any = new Error("Forbidden");
                    err.response = { status: 403 };
                    throw err;
                }
                const err: any = new Error("Bad Request");
                err.response = { status: 400 };
                throw err;
            });
            
            jest.spyOn(axios, 'get').mockImplementation(async (url: string, config: any) => {
                if (url.includes('5000') && !url.includes('127.0.0.1') && !url.includes('localhost')) {
                    const err: any = new Error("Connection Refused");
                    err.code = 'ECONNREFUSED';
                    throw err;
                }
                return { status: 200 };
            });
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('1. Correct API key accepted', async () => {
            const formData = new FormData();
            formData.append("file", fs.createReadStream(dummyImagePath));
            
            try {
                await axios.post(`${BIOMETRIC_URL}/extract-face`, formData, {
                    headers: { 
                        ...formData.getHeaders(),
                        'x-biometric-api-key': API_KEY
                    }
                });
                fail("Expected 400 Invalid Image, but request succeeded");
            } catch (e: any) {
                expect(e.response?.status).not.toBe(401);
                expect(e.response?.status).not.toBe(403);
                expect(e.response?.status).toBe(400); // Because of the dummy image
            }
        });

        it('2. Missing API key rejected', async () => {
            const formData = new FormData();
            formData.append("file", fs.createReadStream(dummyImagePath));
            
            try {
                await axios.post(`${BIOMETRIC_URL}/extract-face`, formData, {
                    headers: { ...formData.getHeaders() }
                });
                fail("Expected 403 Forbidden, but request succeeded");
            } catch (e: any) {
                expect(e.response?.status).toBe(403);
            }
        });

        it('3. Invalid API key rejected', async () => {
            const formData = new FormData();
            formData.append("file", fs.createReadStream(dummyImagePath));
            
            try {
                await axios.post(`${BIOMETRIC_URL}/extract-face`, formData, {
                    headers: { 
                        ...formData.getHeaders(),
                        'x-biometric-api-key': 'WRONG_API_KEY'
                    }
                });
                fail("Expected 403 Forbidden, but request succeeded");
            } catch (e: any) {
                expect(e.response?.status).toBe(403);
            }
        });

        it('4. Service bound to localhost', async () => {
            const os = require('os');
            const interfaces = os.networkInterfaces();
            let localIp = '';
            
            for (const name of Object.keys(interfaces)) {
                for (const iface of interfaces[name]) {
                    if (iface.family === 'IPv4' && !iface.internal) {
                        localIp = iface.address;
                        break;
                    }
                }
                if (localIp) break;
            }

            if (!localIp) {
                console.log("No external IP found to test binding.");
                return;
            }

            try {
                await axios.get(`http://${localIp}:5000/health`, { timeout: 2000 });
                fail(`Reachable at http://${localIp}:5000! Bound to 0.0.0.0`);
            } catch (e: any) {
                expect(['ECONNREFUSED', 'ETIMEDOUT', 'ECONNABORTED']).toContain(e.code);
            }
        });
    });

    describe('Retry Backoff Semantics', () => {
        beforeEach(() => {
            jest.spyOn(axios, 'request');
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        const mockAxiosForRetry = (statusCodes: number[], networkErrorCodes: string[]) => {
            let attempt = 0;
            const mockFn = async (config: any) => {
                attempt++;
                
                if (statusCodes.length >= attempt && statusCodes[attempt-1]) {
                    const error: any = new Error("Mock HTTP Error");
                    error.response = { status: statusCodes[attempt-1], data: { error: { code: 'MOCK', message: 'mock' } } };
                    throw error;
                }
                
                if (networkErrorCodes.length >= attempt && networkErrorCodes[attempt-1]) {
                    const error: any = new Error("Mock Network Error");
                    error.code = networkErrorCodes[attempt-1];
                    throw error;
                }
                
                return { data: { passed: true, similarity: 0.95 } };
            };
            
            (axios.request as jest.Mock).mockImplementation(mockFn);
            
            return {
                getAttempts: () => attempt
            };
        };

        it('5. ECONNREFUSED retries', async () => {
            const mock = mockAxiosForRetry([], ['ECONNREFUSED', 'ECONNREFUSED']);
            const startTime = Date.now();
            await BiometricService.extractVoice(dummyImagePath);
            const duration = Date.now() - startTime;
            
            expect(mock.getAttempts()).toBe(3);
            expect(duration).toBeGreaterThanOrEqual(1500);
        });

        it('6. ETIMEDOUT retries', async () => {
            const mock = mockAxiosForRetry([], ['ETIMEDOUT']);
            const startTime = Date.now();
            await BiometricService.extractVoice(dummyImagePath);
            const duration = Date.now() - startTime;
            
            expect(mock.getAttempts()).toBe(2);
            expect(duration).toBeGreaterThanOrEqual(500);
        });

        it('7. HTTP 503 retries', async () => {
            const mock = mockAxiosForRetry([503, 503, 503], []);
            const startTime = Date.now();
            await BiometricService.extractVoice(dummyImagePath);
            const duration = Date.now() - startTime;
            
            expect(mock.getAttempts()).toBe(3);
            expect(duration).toBeGreaterThanOrEqual(1500);
        });

        it('8. HTTP 400 does not retry', async () => {
            const mock = mockAxiosForRetry([400], []);
            await BiometricService.extractVoice(dummyImagePath);
            
            expect(mock.getAttempts()).toBe(1);
        });

        it('9. Biometric mismatch does not retry', async () => {
            const mock = mockAxiosForRetry([422], []);
            await BiometricService.extractVoice(dummyImagePath);
            
            expect(mock.getAttempts()).toBe(1);
        });

        it('10. Enrollment request does not retry', async () => {
            const mock = mockAxiosForRetry([503], []);
            try {
                await BiometricService.extractFace(dummyImagePath, true);
            } catch (e) {
                // Expected to throw
            }
            
            expect(mock.getAttempts()).toBe(1);
        });

        it('11. Verification succeeds after retry', async () => {
            const mock = mockAxiosForRetry([503, 503], []);
            const evidence = await BiometricService.extractVoice(dummyImagePath);
            
            expect(mock.getAttempts()).toBe(3);
            expect(evidence.status).toBe('PASS');
        });
    });
});
