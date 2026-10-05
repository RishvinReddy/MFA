process.env.BIOMETRIC_SERVICE_URL = process.env.BIOMETRIC_SERVICE_URL || "http://127.0.0.1:5001";
process.env.BIOMETRIC_API_KEY = "mock-api-key";
process.env.BIOMETRIC_KEY = "111122223333444455556666777788889999aaaabbbbccccddddeeeeffff0000";
process.env.MASTER_KEY_HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.JWT_SECRET = "supersecret";
process.env.TEST_SUITE_ID = require('crypto').randomBytes(4).toString('hex');
