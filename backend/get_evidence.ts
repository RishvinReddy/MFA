import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const evidence = await prisma.biometricEvidence.findMany({
        where: { modality: 'VOICE' },
        orderBy: { timestamp: 'desc' },
        take: 30
    });
    console.log(JSON.stringify(evidence, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
