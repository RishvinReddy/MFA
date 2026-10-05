
import axios from 'axios';

const API_URL = 'http://localhost:8080/api/auth';

async function testLogin() {
    try {
        console.log('1. Attempting Login...');
        const loginRes = await axios.post(`${API_URL}/login`, {
            email: 'admin@bioshield.com',
            password: 'admin123',
            deviceFingerprint: 'test-device',
            behavioralMetrics: {
                typingSpeed: 100,
                mouseVariance: 0.5
            }
        });

        if (loginRes.data.success) {
            console.log('✅ Login Successful');
            const { accessToken, refreshToken } = loginRes.data.data;
            console.log(`   Access Token: ${accessToken.substring(0, 20)}...`);
            console.log(`   Refresh Token: ${refreshToken.substring(0, 20)}...`);

            console.log('\n2. Testing Refresh Token...');
            const refreshRes = await axios.post(`${API_URL}/refresh-token`, {
                refreshToken
            });

            if (refreshRes.data.success) {
                console.log('✅ Refresh Successful');
                const newTokens = refreshRes.data.data;
                console.log(`   New Access Token: ${newTokens.accessToken.substring(0, 20)}...`);
                console.log(`   New Refresh Token: ${newTokens.refreshToken.substring(0, 20)}...`);
            } else {
                console.error('❌ Refresh Failed:', refreshRes.data);
            }
        } else {
            console.error('❌ Login Failed:', loginRes.data);
        }
    } catch (error: any) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

testLogin();
