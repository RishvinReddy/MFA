import prisma from '../src/prisma';

async function run() {
    const email = 'mfa.fix.user@bioshield.local';
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
        await prisma.enrollmentState.upsert({
            where: { userId: user.id },
            update: { faceEnrolled: true, voiceEnrolled: true },
            create: { userId: user.id, passwordEnrolled: true, faceEnrolled: true, voiceEnrolled: true }
        });
        
        // Also ensure biometric profile exists
        await prisma.biometricProfile.upsert({
            where: { userId: user.id },
            update: {},
            create: { userId: user.id }
        });

        console.log("SUCCESSFULLY UPDATED BIOMETRIC ENROLLMENT FOR", email);
    } else {
        console.error("USER NOT FOUND:", email);
    }
}

run();
