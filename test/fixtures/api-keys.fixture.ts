import { PrismaClient } from '@prisma/client';
import { CryptoUtil } from '../../src/common/utils/crypto.util';

export const createTestApiKey = async (
  prisma: PrismaClient,
  projectId: string,
  overrides: Partial<{
    name: string;
    scopes: string[];
    expiresAt: Date;
    revokedAt: Date;
    createdBy: string;
  }> = {},
) => {
  // Get the project to use its environment
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  const apiKey = CryptoUtil.generateApiKey(
    project?.environment || 'development',
  );
  const keyHash = CryptoUtil.hashApiKey(apiKey);
  const keyPrefix = CryptoUtil.getKeyPrefix(apiKey);
  const keySuffix = CryptoUtil.getKeySuffix(apiKey);

  const scopes = overrides.scopes || ['messages:write', 'messages:read'];

  const createdKey = await prisma.apiKey.create({
    data: {
      projectId,
      keyHash,
      keyPrefix,
      keySuffix,
      name: overrides.name || 'Test API Key',
      expiresAt: overrides.expiresAt || null,
      revokedAt: overrides.revokedAt || null,
      createdBy: overrides.createdBy || null,
      scopes: {
        create: scopes.map((scope) => ({ scope })),
      },
    },
    include: {
      scopes: true,
    },
  });

  return { apiKey: createdKey, rawKey: apiKey };
};
