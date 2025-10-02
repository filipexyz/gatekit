import { PrismaClient, ProjectEnvironment } from '@prisma/client';
import { CryptoUtil } from '../../src/common/utils/crypto.util';

export const createTestProject = async (
  prisma: PrismaClient,
  overrides: Partial<{
    name: string;
    id: string;
    environment: ProjectEnvironment;
    isDefault: boolean;
    settings: any;
    ownerId: string;
  }> = {},
) => {
  const name = overrides.name || 'Test Project';
  const id = overrides.id || CryptoUtil.generateSlug(name);

  // Create or get test owner user
  let ownerId = overrides.ownerId;
  if (!ownerId) {
    const testOwner = await prisma.user.upsert({
      where: { email: 'test-owner@gatekit.dev' },
      update: {},
      create: {
        email: 'test-owner@gatekit.dev',
        auth0Id: 'test-owner-auth0-id',
        name: 'Test Owner',
        isAdmin: false,
      },
    });
    ownerId = testOwner.id;
  }

  return await prisma.project.create({
    data: {
      id,
      name,
      environment: overrides.environment || 'development',
      isDefault: overrides.isDefault || false,
      settings: overrides.settings || {
        rateLimits: {
          test: 100,
          production: 1000,
        },
      },
      ownerId,
    },
    include: {
      owner: true,
    },
  });
};
