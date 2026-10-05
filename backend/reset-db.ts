import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    await prisma.biometricProfile.deleteMany();
    await prisma.behavioralProfile.deleteMany();
    await prisma.authSession.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.totpSecret.deleteMany();
    await prisma.webAuthnCredential.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.securityEvent.deleteMany();
    await prisma.trustEvent.deleteMany();
    await prisma.enrollmentToken.deleteMany();
    await prisma.enrollmentState.deleteMany();
    await prisma.user.deleteMany();
    console.log('Database wiped completely.');
}
main().catch(console.error).finally(() => prisma.$disconnect());
