import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const sessions = await prisma.authSession.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30
    });
    console.log(JSON.stringify(sessions, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
