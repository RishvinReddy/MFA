import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';

const BASE_URL = 'http://localhost:8080/api';
const imgPath = 'C:/Users/EikoMotsu/OneDrive/Documents/Desktop/bioshield-mfa-18-sep/bioshield-mfa-2025 v9 31 july/ChatGPT Image Aug 21, 2026, 05_48_00 PM.png';
const audioPath = 'C:/Users/EikoMotsu/OneDrive/Documents/Desktop/bioshield-mfa-18-sep/bioshield-mfa-2025 v9 31 july/biometric-service/dummy1.wav';

async function run() {
    try {
        const email = `test_flow_${Date.now()}@example.com`;
        console.log("1. Registering...");
        const regRes = await axios.post(`${BASE_URL}/auth/register`, {
            email, password: 'Password123!', device: 'TestDevice', fullName: 'Test User'
        });

        const enrollToken = regRes.data.enrollmentToken;
        console.log("2. Enrolling biometrics...");
        const enrollForm = new FormData();
        enrollForm.append('face', fs.createReadStream(imgPath));
        enrollForm.append('voice', fs.createReadStream(audioPath));
        await axios.post(`${BASE_URL}/biometric/register`, enrollForm, {
            headers: {
                ...enrollForm.getHeaders(),
                'x-enrollment-token': enrollToken
            }
        });

        console.log("3. Logging in...");
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            email, password: 'Password123!', device: 'TestDevice'
        });
        
        console.log("Login Res:", loginRes.data);
        let token = loginRes.data.token || loginRes.data.enrollmentToken;
        let sessionId = loginRes.data.sessionId || loginRes.data.session?.id;

        console.log(`Login sessionId: ${sessionId}`);

        // Generate challenge for face
        const chalFace = await axios.post(`${BASE_URL}/auth/generate-challenge`, { type: 'LOGIN', modality: 'FACE' }, {
            headers: { 'x-session-id': sessionId }
        });

        console.log("3. Verify Face...");
        const faceForm = new FormData();
        faceForm.append('face', fs.createReadStream(imgPath));
        faceForm.append('challengeId', chalFace.data.challengeId);
        faceForm.append('nonce', chalFace.data.nonce);
        
        const faceRes = await axios.post(`${BASE_URL}/biometric/verify`, faceForm, {
            headers: { ...faceForm.getHeaders(), 'x-session-id': sessionId }
        });
        console.log("Face verify:", faceRes.data.status, faceRes.data.next);

        // Generate challenge for voice
        const chalVoice = await axios.post(`${BASE_URL}/auth/generate-challenge`, { type: 'LOGIN', modality: 'VOICE' }, {
            headers: { 'x-session-id': sessionId }
        });

        console.log("4. Verify Voice...");
        const voiceForm = new FormData();
        voiceForm.append('voice', fs.createReadStream(audioPath));
        voiceForm.append('challengeId', chalVoice.data.challengeId);
        voiceForm.append('nonce', chalVoice.data.nonce);
        
        const voiceRes = await axios.post(`${BASE_URL}/biometric/verify`, voiceForm, {
            headers: { ...voiceForm.getHeaders(), 'x-session-id': sessionId }
        });
        console.log("Voice verify:", voiceRes.data.status, voiceRes.data.next);

        console.log("5. MFA Verify...");
        try {
            const mfaRes = await axios.post(`${BASE_URL}/mfa/totp/verify-login`, { userId: loginRes.data.userId, token: '000000' }, {
                headers: { 'x-session-id': sessionId }
            });
            console.log("MFA:", mfaRes.data);
        } catch (e: any) {
            console.log("MFA Error:", e.response?.status, e.response?.data);
        }

    } catch (e: any) {
        console.error("Error:", e.response?.data || e.message);
    }
}
run();
