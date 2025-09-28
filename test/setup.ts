import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.DATABASE_URL ||
        'postgresql://gatekit:gatekit_password@localhost:5432/gatekit_test?schema=public',
    },
  },
});

beforeAll(async () => {
  await prisma.$connect();
});

beforeEach(async () => {
  // Clean database in correct order (respecting foreign keys)
  await prisma.apiKeyUsage.deleteMany();
  await prisma.apiKeyScope.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.receivedMessage.deleteMany();
  await prisma.sentMessage.deleteMany();
  await prisma.platformLog.deleteMany();
  await prisma.projectPlatform.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
