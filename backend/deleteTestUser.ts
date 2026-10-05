import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    await prisma.user.deleteMany({
        where: { email: 'sumitraj@gmail.com' }
    });
    console.log('User deleted');
}
main().catch(console.error).finally(() => prisma.$disconnect());
