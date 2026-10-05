import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import { PrismaClient } from '@prisma/client';
import speakeasy from 'speakeasy';
import { encrypt } from '../src/utils/kms';

const prisma = new PrismaClient();

async function main() {
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!admin) {
        console.error("Admin user not found.");
        return;
    }

    const secret = speakeasy.generateSecret({ name: `BioShield (${admin.email})` });
    const encryptedSecret = encrypt(secret.base32);

    await prisma.user.update({
        where: { id: admin.id },
        data: { mfaSecretEnc: encryptedSecret }
    });

    console.log("=========================================");
    console.log("✅ Admin MFA Secret Configured!");
    console.log(`User: ${admin.email}`);
    console.log(`Secret (Base32): ${secret.base32}`);
    console.log(`Auth URI (Use this to create QR): ${secret.otpauth_url}`);
    console.log("=========================================");
    
    // Generate code for next 30 seconds
    const token = speakeasy.totp({
        secret: secret.base32,
        encoding: 'base32'
    });
    
    console.log("🔥 YOUR CURRENT 6-DIGIT CODE IS: " + token);
    console.log("=========================================");
}

main().finally(() => prisma.$disconnect());
