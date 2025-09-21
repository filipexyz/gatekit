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
  }> = {},
) => {
  const name = overrides.name || 'Test Project';
  const slug = overrides.slug || CryptoUtil.generateSlug(name);

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
    },
  });
};