import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Starting deletion of all user accounts and related data...');
        
        // Delete child tables first due to foreign key constraints
        const auditLogs = await prisma.auditLog.deleteMany({});
        console.log(`Deleted ${auditLogs.count} AuditLogs.`);
        
        const securityEvents = await prisma.securityEvent.deleteMany({});
        console.log(`Deleted ${securityEvents.count} SecurityEvents.`);
        
        const authSessions = await prisma.authSession.deleteMany({});
        console.log(`Deleted ${authSessions.count} AuthSessions.`);
        
        const refreshTokens = await prisma.refreshToken.deleteMany({});
        console.log(`Deleted ${refreshTokens.count} RefreshTokens.`);
        
        const totpSecrets = await prisma.totpSecret.deleteMany({});
        console.log(`Deleted ${totpSecrets.count} TotpSecrets.`);
        
        const webauthnCreds = await prisma.webAuthnCredential.deleteMany({});
        console.log(`Deleted ${webauthnCreds.count} WebAuthnCredentials.`);
        
        const biometricProfiles = await prisma.biometricProfile.deleteMany({});
        console.log(`Deleted ${biometricProfiles.count} BiometricProfiles.`);
        
        const behavioralProfiles = await prisma.behavioralProfile.deleteMany({});
        console.log(`Deleted ${behavioralProfiles.count} BehavioralProfiles.`);
        
        // Finally delete all users
        const users = await prisma.user.deleteMany({});
        console.log(`Deleted ${users.count} User accounts.`);
        
        console.log('✅ Successfully deleted all user accounts and associated records.');
    } catch (error) {
        console.error('Error deleting users:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
