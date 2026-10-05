
import http from 'http';
import fs from 'fs';
import path from 'path';

// Simple script to test the backend enrollment
// Usage: npx ts-node helpers/test-enroll.ts

const POST_DATA = Buffer.from('fake-biometric-data-' + Date.now());
const BOUNDARY = '----WebKitFormBoundary7MA4YWxkTrZu0gW';

const bodyHeader = `--${BOUNDARY}\r\nContent-Disposition: form-data; name="userId"\r\n\r\ntest-user-1\r\n--${BOUNDARY}\r\nContent-Disposition: form-data; name="modality"\r\n\r\nface\r\n--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="face.dat"\r\nContent-Type: application/octet-stream\r\n\r\n`;
const bodyFooter = `\r\n--${BOUNDARY}--`;

const payload = Buffer.concat([
    Buffer.from(bodyHeader),
    POST_DATA,
    Buffer.from(bodyFooter)
]);

const options = {
    hostname: 'localhost',
    port: 8080,
    path: '/api/enroll',
    method: 'POST',
    headers: {
        'Content-Type': `multipart/form-data; boundary=${BOUNDARY}`,
        'Content-Length': payload.length,
        'Authorization': 'Bearer test-admin-token'
    }
};

console.log('Attemping to enroll user...');

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
    res.on('end', () => {
        console.log('No more data in response.');
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(payload);
req.end();
