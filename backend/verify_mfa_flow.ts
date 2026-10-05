import { login } from './src/controllers/auth.controller';

// Mock Request and Response
const req = {
    body: {
        email: 'test@example.com',
        password: 'password123',
        behavioralMetrics: { typingSpeed: 100, mouseVariance: 50 },
        deviceFingerprint: 'test-device'
    },
    ip: '127.0.0.1'
};

const res = {
    json: (data: any) => console.log(JSON.stringify(data, null, 2)),
    status: (code: number) => ({ json: (data: any) => console.log(`Status ${code}:`, data) })
};

// This script is just a placeholder to show intent of verification.
// Real verification requires running the backend and hitting endpoints.
console.log("To verify, run the backend and use the frontend UI.");
