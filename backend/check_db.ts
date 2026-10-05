
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // Attempt to query a table that should exist
    const count = await prisma.user.count();
    console.log(`\nSUCCESS: Connected to DB. User count: ${count}`);
    
    const tables = await prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table';`;
    console.log('Tables:', tables);
  } catch (e: any) {
    console.error('\nERROR: Database check failed.');
    console.error(e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
