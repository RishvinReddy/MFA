import { AuthService } from '../src/services/auth.service';
import prisma from '../src/prisma';
import { decrypt } from '../src/utils/kms';

const authService = new AuthService();

async function testRegistration() {
    console.log("🧪 Starting Secure Registration Test...");

    const testEmail = `test-reg-${Date.now()}@bioshield.com`;
    const testPassword = "Password123!";

    try {
        // Cleanup
        await prisma.user.deleteMany({ where: { email: { startsWith: 'test-reg-' } } });

        console.log(`Creating user: ${testEmail}`);
        const result = await authService.register({
            email: testEmail,
            password: testPassword
        });

        console.log("✅ Registration Successful!");
        console.log(`User ID: ${result.userId}`);
        console.log(`QR Code Length: ${result.qrCode.length}`);

        // Verify Database State
        const user = await prisma.user.findUnique({ where: { id: result.userId } });

        if (!user) throw new Error("User not found in DB");
        if (!user.mfaSecretEnc) throw new Error("MFA Secret Encrypted is missing");
        if (!user.passwordHash) throw new Error("Password Hash is missing");
        if (user.passwordHash === testPassword) throw new Error("Password stored in plaintext!");

        console.log("✅ Database Verification Passed");
        console.log(`Stored Encrypted Secret: ${user.mfaSecretEnc.substring(0, 20)}...`);

        // Test Decryption (Internal sanity check)
        const decrypted = decrypt(user.mfaSecretEnc);
        if (decrypted.length !== 32) { // Base32 length for 20 bytes secret
            console.warn("⚠️ Decrypted secret length unexpected: " + decrypted.length);
        } else {
            console.log("✅ Decryption works internally");
        }

        // Verify Audit Log
        const log = await prisma.auditLog.findFirst({
            where: { userId: user.id, action: "USER_REGISTERED" }
        });

        if (log) {
            console.log("✅ Audit Log Created");
        } else {
            console.error("❌ Audit Log Missing");
        }

    } catch (error: any) {
        console.error("❌ Test Failed:", error.message);
        if (error.errors) console.error(error.errors); // Zod errors
    } finally {
        await prisma.$disconnect();
    }
}

testRegistration();
