import { PrismaClient, ProjectEnvironment } from '@prisma/client';
import { CryptoUtil } from '../../src/common/utils/crypto.util';

export const createTestProject = async (
  prisma: PrismaClient,
  overrides: Partial<{
    name: string;
    slug: string;
    environment: ProjectEnvironment;
    isDefault: boolean;
    settings: any;
    ownerId: string;
  }> = {},
) => {
  const name = overrides.name || 'Test Project';
  const slug = overrides.slug || CryptoUtil.generateSlug(name);

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
      name,
      slug,
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
