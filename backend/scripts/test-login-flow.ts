import { AuthService } from '../src/services/auth.service';
import prisma from '../src/prisma';
import { AppError } from '../src/middleware';

const authService = new AuthService();

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testLoginFlow() {
    console.log("🧪 Starting Secure Login Flow Test...");

    const testEmail = `test-login-${Date.now()}@bioshield.com`;
    const testPassword = "Password123!";
    const wrongPassword = "WrongPassword!";
    const metadata = { ip: "127.0.0.1", device: "TestRunner", typingSpeed: 100, mouseVariance: 0.5 };

    try {
        // 1. Setup User
        console.log("🔹 Creating Test User...");
        await authService.register({ email: testEmail, password: testPassword });

        const user = await prisma.user.findUnique({ where: { email: testEmail } });
        if (!user) throw new Error("User creation failed");
        console.log(`   User ID: ${user.id}`);

        // 2. Test Success
        console.log("\n🔹 Test 1: Valid Login");
        const success = await authService.login(testEmail, testPassword, metadata);
        if (success) console.log("   ✅ Login Successful");

        // 3. Test Invalid Password Counter
        console.log("\n🔹 Test 2: Invalid Password (Counter Increment)");
        try {
            await authService.login(testEmail, wrongPassword, metadata);
        } catch (e: any) {
            console.log(`   ✅ Caught Expected Error: ${e.message}`);
        }

        const userAfterFail = await prisma.user.findUnique({ where: { email: testEmail } });
        console.log(`   Failed Attempts: ${userAfterFail?.failedAttempts} (Expected: 1)`);
        if (userAfterFail?.failedAttempts !== 1) throw new Error("Counter did not increment");

        // 4. Test Lockout (Trigger 5 failures)
        console.log("\n🔹 Test 3: Trigger Lockout (4 more failures)");
        for (let i = 0; i < 4; i++) {
            try {
                process.stdout.write(`   Attempt ${i + 2}... `);
                await authService.login(testEmail, wrongPassword, metadata);
            } catch (e) { }
        }
        console.log("\n   Done.");

        const userLocked = await prisma.user.findUnique({ where: { email: testEmail } });
        console.log(`   Failed Attempts: ${userLocked?.failedAttempts}`);
        console.log(`   Locked Until: ${userLocked?.lockedUntil}`);

        if (!userLocked?.lockedUntil) throw new Error("User was not locked!");

        // 5. Test Login While Locked
        console.log("\n🔹 Test 4: Login While Locked");
        try {
            await authService.login(testEmail, testPassword, metadata); // Correct password!
            throw new Error("Login succeeded but should be locked!");
        } catch (e: any) {
            if (e.message.includes("Account locked")) {
                console.log(`   ✅ Blocked: ${e.message}`);
            } else {
                throw e;
            }
        }

        // 6. Test Reset (Manually unlock for testing)
        console.log("\n🔹 Test 5: Login After Unlock");
        await prisma.user.update({
            where: { id: user.id },
            data: { lockedUntil: null, failedAttempts: 0 } // Simulate expiry
        });
        await prisma.auditLog.deleteMany({
            where: { userId: user.id, action: "LOGIN_FAILED" }
        });

        const result = await authService.login(testEmail, testPassword, metadata);
        if (result) console.log("   ✅ Login Succeeded after unlock");

        console.log("\n✅ ALL LOGIN FLOW TESTS PASSED");

    } catch (error: any) {
        console.error("\n❌ TEST FAILED:", error.message);
    } finally {
        // Cleanup
        await prisma.user.deleteMany({ where: { email: { startsWith: 'test-login-' } } });
        await prisma.$disconnect();
    }
}

testLoginFlow();
