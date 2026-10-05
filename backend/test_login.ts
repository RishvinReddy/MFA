
// import fetch from 'node-fetch'; // Built-in fetch in Node 18+

async function testLogin() {
    const url = 'http://localhost:8080/api/auth/login';
    const body = {
        email: 'id-admin',
        password: 'password-admin123',
        behavioralMetrics: {},
        deviceFingerprint: 'test-fingerprint'
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error:', error);
    }
}

testLogin();
