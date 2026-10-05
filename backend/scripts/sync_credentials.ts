import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const filePath = path.join(__dirname, '../../credentials.md');
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Basic regex to find the email and password in the markdown file
    const emailMatch = content.match(/- \*\*Email:\*\* `([^`]+)`/);
    const passwordMatch = content.match(/- \*\*Password:\*\* `([^`]+)`/);
    
    if (emailMatch && passwordMatch) {
        const email = emailMatch[1];
        const password = passwordMatch[1];
        
        console.log(`Parsed credentials from file: ${email}`);
        
        const passwordHash = await bcrypt.hash(password, 10);
        
        // Find the first ADMIN user to update their credentials
        const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
        if (admins.length > 0) {
            await prisma.user.update({
                where: { id: admins[0].id },
                data: { email, passwordHash }
            });
            console.log(`✅ Updated existing ADMIN user to use credentials from credentials.md`);
        } else {
            await prisma.user.create({
                data: {
                    email,
                    passwordHash,
                    role: 'ADMIN'
                }
            });
            console.log(`✅ Created new ADMIN user with credentials from credentials.md`);
        }
    } else {
        console.log('❌ Could not parse Email or Password from credentials.md');
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
