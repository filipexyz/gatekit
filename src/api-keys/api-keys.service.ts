import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { CryptoUtil } from '../common/utils/crypto.util';
import { SecurityUtil, AuthContext } from '../common/utils/security.util';

@Injectable()
export class ApiKeysService {
  constructor(private prisma: PrismaService) {}

  async create(
    projectId: string,
    createApiKeyDto: CreateApiKeyDto,
    authContext: AuthContext,
    createdBy?: string,
  ) {
    // Get project and validate access in one step
    const project = await SecurityUtil.getProjectWithAccess(
      this.prisma,
      projectId,
      authContext,
      'API key creation',
    );

    const apiKey = CryptoUtil.generateApiKey(project.environment);
    const keyHash = CryptoUtil.hashApiKey(apiKey);
    const keyPrefix = CryptoUtil.getKeyPrefix(apiKey);
    const keySuffix = CryptoUtil.getKeySuffix(apiKey);

    const scopes = createApiKeyDto.scopes || [];

    let expiresAt: Date | null = null;
    if (createApiKeyDto.expiresInDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + createApiKeyDto.expiresInDays);
    }

    const createdApiKey = await this.prisma.apiKey.create({
      data: {
        projectId: project.id,
        keyHash,
        keyPrefix,
        keySuffix,
        name: createApiKeyDto.name,
        expiresAt,
        createdBy,
        scopes: {
          create: scopes.map((scope) => ({ scope })),
        },
      },
      include: {
        scopes: true,
      },
    });

    return {
      id: createdApiKey.id,
      key: apiKey,
      name: createdApiKey.name,
      prefix: keyPrefix,
      scopes: createdApiKey.scopes.map((s) => s.scope),
      expiresAt: createdApiKey.expiresAt,
      createdAt: createdApiKey.createdAt,
    };
  }

  async findAll(projectId: string, authContext: AuthContext) {
    // Get project and validate access in one step
    const project = await SecurityUtil.getProjectWithAccess(
      this.prisma,
      projectId,
      authContext,
      'API key listing',
    );

    const apiKeys = await this.prisma.apiKey.findMany({
      where: {
        projectId: project.id,
        revokedAt: null,
      },
      include: {
        scopes: true,
      },
    });

    return apiKeys.map((key) => ({
      id: key.id,
      name: key.name,
      maskedKey: CryptoUtil.maskApiKey(key.keyPrefix, key.keySuffix),
      scopes: key.scopes.map((s) => s.scope),
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
    }));
  }

  async revoke(projectId: string, keyId: string, authContext: AuthContext) {
    // Get project and validate access in one step
    const project = await SecurityUtil.getProjectWithAccess(
      this.prisma,
      projectId,
      authContext,
      'API key revocation',
    );

    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        id: keyId,
        projectId: project.id,
      },
    });

    if (!apiKey) {
      throw new NotFoundException(`API key not found`);
    }

    if (apiKey.revokedAt) {
      return { message: 'API key already revoked' };
    }

    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });

    return { message: 'API key revoked successfully' };
  }

  async roll(
    projectId: string,
    keyId: string,
    authContext: AuthContext,
    createdBy?: string,
  ) {
    // Get project and validate access in one step
    const project = await SecurityUtil.getProjectWithAccess(
      this.prisma,
      projectId,
      authContext,
      'API key rolling',
    );

    const oldKey = await this.prisma.apiKey.findFirst({
      where: {
        id: keyId,
        projectId: project.id,
        revokedAt: null,
      },
      include: {
        scopes: true,
      },
    });

    if (!oldKey) {
      throw new NotFoundException(`Active API key not found`);
    }

    const newApiKey = CryptoUtil.generateApiKey(project.environment);
    const keyHash = CryptoUtil.hashApiKey(newApiKey);
    const keyPrefix = CryptoUtil.getKeyPrefix(newApiKey);
    const keySuffix = CryptoUtil.getKeySuffix(newApiKey);

    const [, createdApiKey] = await this.prisma.$transaction([
      this.prisma.apiKey.update({
        where: { id: keyId },
        data: {
          revokedAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      }),
      this.prisma.apiKey.create({
        data: {
          projectId: project.id,
          keyHash,
          keyPrefix,
          keySuffix,
          name: oldKey.name,
          expiresAt: oldKey.expiresAt,
          createdBy,
          scopes: {
            create: oldKey.scopes.map((s) => ({ scope: s.scope })),
          },
        },
        include: {
          scopes: true,
        },
      }),
    ]);

    return {
      id: createdApiKey.id,
      key: newApiKey,
      name: createdApiKey.name,
      prefix: keyPrefix,
      scopes: createdApiKey.scopes.map((s) => s.scope),
      expiresAt: createdApiKey.expiresAt,
      createdAt: createdApiKey.createdAt,
      oldKeyRevokedAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  async validateApiKey(apiKey: string) {
    const keyHash = CryptoUtil.hashApiKey(apiKey);

    const key = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        project: {
          include: {
            owner: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
        scopes: true,
      },
    });

    if (!key) {
      return null;
    }

    if (key.revokedAt && key.revokedAt < new Date()) {
      return null;
    }

    if (key.expiresAt && key.expiresAt < new Date()) {
      return null;
    }

    await this.prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      id: key.id,
      projectId: key.projectId,
      project: key.project,
      scopes: key.scopes.map((s) => s.scope),
    };
  }
}
