import { PrismaClient, ApiKeyEnvironment } from '@prisma/client';
import { CryptoUtil } from '../../src/common/utils/crypto.util';

export const createTestApiKey = async (
  prisma: PrismaClient,
  projectId: string,
  overrides: Partial<{
    name: string;
    environment: ApiKeyEnvironment;
    scopes: string[];
    expiresAt: Date;
    revokedAt: Date;
    createdBy: string;
  }> = {},
) => {
  const environment = overrides.environment || 'test';
  const apiKey = CryptoUtil.generateApiKey(environment);
  const keyHash = CryptoUtil.hashApiKey(apiKey);
  const keyPrefix = CryptoUtil.getKeyPrefix(apiKey);

  const scopes = overrides.scopes || ['messages:send', 'messages:read'];

  const createdKey = await prisma.apiKey.create({
    data: {
      projectId,
      keyHash,
      keyPrefix,
      name: overrides.name || 'Test API Key',
      environment,
      expiresAt: overrides.expiresAt || null,
      revokedAt: overrides.revokedAt || null,
      createdBy: overrides.createdBy || null,
      scopes: {
        create: scopes.map(scope => ({ scope })),
      },
    },
    include: {
      scopes: true,
    },
  });

  return { apiKey: createdKey, rawKey: apiKey };
};