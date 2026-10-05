import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                emailVerified: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' }
        });
        console.log('--- EXISTING USER ACCOUNTS ---');
        console.table(users);
        console.log(JSON.stringify(users, null, 2));
    } catch (error) {
        console.error('Error fetching users:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
