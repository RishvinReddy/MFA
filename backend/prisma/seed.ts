import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const usersToSeed: Array<{ email: string; password: string; fullName: string; role: Role }> = [
    {
      email: 'admin@bioshield.com',
      password: 'Password-Admin123!',
      fullName: 'System Administrator',
      role: Role.ADMIN,
    },
    {
      email: 'user@bioshield.com',
      password: 'Password-User123!',
      fullName: 'Standard User (Rishvin)',
      role: Role.USER,
    },
    {
      email: 'analyst@bioshield.com',
      password: 'Password-Analyst123!',
      fullName: 'Security Compliance Analyst',
      role: Role.USER,
    },
  ];

  for (const u of usersToSeed) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    const existing = await prisma.user.findUnique({ where: { email: u.email } });

    if (!existing) {
      await prisma.user.create({
        data: {
          email: u.email,
          fullName: u.fullName,
          passwordHash,
          role: u.role,
          emailVerified: true,
        },
      });
      console.log(`[SEED] Created ${u.role} user: ${u.email}`);
    } else {
      await prisma.user.update({
        where: { email: u.email },
        data: {
          emailVerified: true,
          passwordHash,
        },
      });
      console.log(`[SEED] Verified & updated user: ${u.email}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
