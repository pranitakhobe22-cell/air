const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function test() {
  console.log('Testing database connection...');
  try {
    await prisma.$connect();
    console.log('✅ Database connected!');
    const nodes = await prisma.node.count();
    console.log(`✅ Nodes in DB: ${nodes}`);
  } catch (e) {
    console.error('❌ Database connection failed:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}
test();
