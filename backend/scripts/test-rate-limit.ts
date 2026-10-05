
import axios from 'axios';

async function testRateLimit() {
    console.log("🧪 Starting Rate Limit Test...");

    const url = 'http://localhost:8080/auth/login';
    const payload = {
        email: "test.rate.limit@example.com", // Doesn't need to exist, just hitting the endpoint
        password: "password123",
        // behavioralMetrics & deviceFingerprint optional for this test if validation allows
    };

    console.log(`Sending requests to ${url}...`);

    for (let i = 1; i <= 10; i++) {
        try {
            console.log(`Attempt ${i}...`);
            await axios.post(url, payload);
            console.log(`✅ Attempt ${i}: Allowed (200/401)`);
        } catch (error: any) {
            if (error.response) {
                if (error.response.status === 429) {
                    console.log(`⛔ Attempt ${i}: BLOCKED (429 Too Many Requests)`);
                    console.log("✅ Rate Limiting is WORKING!");
                    return;
                } else {
                    console.log(`✅ Attempt ${i}: Allowed with status ${error.response.status}`);
                }
            } else {
                console.error(`❌ Attempt ${i}: Error ${error.message}`);
            }
        }
    }

    console.error("❌ Rate Limiting FAILED. Did not receive 429 after 5 attempts.");
}

testRateLimit();
