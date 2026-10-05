import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const logs = await prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30
    });
    console.log(JSON.stringify(logs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
