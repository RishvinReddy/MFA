import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import speakeasy from 'speakeasy';

dotenv.config();

const API_URL = 'http://localhost:8080/api';
const TEST_USER = {
    email: 'sys_check_' + Date.now() + '@bioshield.com',
    password: 'Password123!',
};

async function run() {
    console.log('🛡️  Starting BioShield System Verification 🛡️');
    console.log('-------------------------------------------');

    // 1. Health Check
    try {
        const healthUrl = 'http://localhost:8080/health';
        const res = await fetch(healthUrl);
        if (!res.ok) throw new Error(`Health check returned ${res.status}`);
        const health = await res.json();
        console.log('✅ Health Check:', health);
    } catch (e) {
        console.error('❌ Health Check Failed:', e);
        process.exit(1);
    }

    // 2. Registration
    console.log('\n1️⃣  Testing Registration...');
    let res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(TEST_USER)
    });

    if (!res.ok) throw new Error(`Registration failed: ${await res.text()}`);
    let json = await res.json();
    const userId = json.userId;
    const mfaSecret = json.manualEntrySecret;
    console.log('   ✅ User Registered. ID:', userId);
    console.log('   🔑 MFA Secret:', mfaSecret ? 'PRESENT' : 'MISSING');

    if (!mfaSecret) {
        throw new Error('MFA Secret was not returned during registration');
    }

    // 3. Login Step 1
    console.log('\n2️⃣  Testing Login Step 1 (Risk Assessment)...');
    res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'BioShield-Test-Script/1.0'
        },
        body: JSON.stringify({
            email: TEST_USER.email,
            password: TEST_USER.password,
            deviceFingerprint: 'test-device-hash-' + Date.now()
        })
    });

    if (!res.ok) throw new Error(`Login Step 1 failed: ${await res.text()}`);
    json = await res.json();
    console.log('   ✅ Login Step 1 Response:', json);

    if (!json.requiresMfa) {
        throw new Error('Expected MFA requirement to be true');
    }

    // 4. Verify TOTP to get JWT
    console.log('\n3️⃣  Testing TOTP Verification (Login Completion)...');
    const totpCode = speakeasy.totp({
        secret: mfaSecret,
        encoding: 'base32'
    });

    res = await fetch(`${API_URL}/mfa/totp/verify-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, token: totpCode })
    });

    if (!res.ok) throw new Error(`TOTP Login Verification failed: ${await res.text()}`);
    json = await res.json();
    const token = json.accessToken;
    console.log('   ✅ MFA Verification Successful.');
    console.log('   🎫 JWT Token retrieved:', token ? 'SUCCESS' : 'FAILED');

    if (!token) {
        throw new Error('Access Token was not returned during TOTP verification');
    }

    // 5. Biometric Enrollment
    console.log('\n4️⃣  Testing Biometric Enrollment (Face)...');
    const dummyPath = path.join(__dirname, 'temp_face.png');
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    fs.writeFileSync(dummyPath, Buffer.from(pngBase64, 'base64'));

    const blobEnroll = new Blob([fs.readFileSync(dummyPath)]);
    const formDataEnroll = new FormData();
    // In our routes, register biometric takes 'face' and/or 'voice' fields
    formDataEnroll.append('face', blobEnroll, 'face.jpg');

    res = await fetch(`${API_URL}/biometric/register`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formDataEnroll
    });

    if (!res.ok) throw new Error(`Biometric Enrollment failed: ${await res.text()}`);
    json = await res.json();
    console.log('   ✅ Biometric Enrollment Successful:', json.message);

    // 6. Biometric Verification
    console.log('\n5️⃣  Testing Biometric Verification...');
    const formDataVerify = new FormData();
    formDataVerify.append('face', blobEnroll, 'face.jpg'); // Verify with same data

    res = await fetch(`${API_URL}/biometric/verify`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formDataVerify
    });

    if (!res.ok) throw new Error(`Biometric Verification failed: ${await res.text()}`);
    json = await res.json();
    console.log('   ✅ Verification Result:', json.success ? 'MATCH' : 'NO MATCH');
    console.log('   💯 Match Score:', json.results?.face?.score);

    // 7. Admin Stats Check
    console.log('\n6️⃣  Testing Admin Stats (Security Check)...');
    res = await fetch(`${API_URL}/admin/stats`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` } // User token (not Admin)
    });

    if (res.status === 403) {
        console.log('   ✅ RBAC Working: User denied access to Admin API.');
    } else {
        console.error('   ❌ RBAC Failed: User accessed Admin API or other error.', res.status);
    }

    // 8. Cleanup
    fs.unlinkSync(dummyPath);
    console.log('\n-------------------------------------------');
    console.log('🎉 System Verification Complete! No critical errors found.');
}

run().catch(e => {
    console.error('\n❌ System Check Failed:', e);
    process.exit(1);
});
