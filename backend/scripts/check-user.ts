
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findUnique({
        where: { email: 'admin@bioshield.com' }
    });
    console.log(user ? 'User found' : 'User not found');
    await prisma.$disconnect();
}

main();
