import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { CryptoUtil } from '../common/utils/crypto.util';
import { ApiKeyEnvironment } from '@prisma/client';

@Injectable()
export class ApiKeysService {
  constructor(private prisma: PrismaService) {}

  private getDefaultScopes(environment: ApiKeyEnvironment): string[] {
    switch (environment) {
      case 'production':
      case 'test':
        return ['messages:send', 'messages:read'];
      case 'restricted':
        return [];
      default:
        return ['messages:send', 'messages:read'];
    }
  }

  async create(projectSlug: string, createApiKeyDto: CreateApiKeyDto, createdBy?: string) {
    const project = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
    });

    if (!project) {
      throw new NotFoundException(`Project with slug '${projectSlug}' not found`);
    }

    const apiKey = CryptoUtil.generateApiKey(createApiKeyDto.environment);
    const keyHash = CryptoUtil.hashApiKey(apiKey);
    const keyPrefix = CryptoUtil.getKeyPrefix(apiKey);

    const scopes = createApiKeyDto.scopes || this.getDefaultScopes(createApiKeyDto.environment);

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
        name: createApiKeyDto.name,
        environment: createApiKeyDto.environment,
        expiresAt,
        createdBy,
        scopes: {
          create: scopes.map(scope => ({ scope })),
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
      scopes: createdApiKey.scopes.map(s => s.scope),
      environment: createdApiKey.environment,
      expiresAt: createdApiKey.expiresAt,
      createdAt: createdApiKey.createdAt,
    };
  }

  async findAll(projectSlug: string) {
    const project = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
    });

    if (!project) {
      throw new NotFoundException(`Project with slug '${projectSlug}' not found`);
    }

    const apiKeys = await this.prisma.apiKey.findMany({
      where: {
        projectId: project.id,
        revokedAt: null,
      },
      include: {
        scopes: true,
      },
    });

    return apiKeys.map(key => ({
      id: key.id,
      name: key.name,
      maskedKey: CryptoUtil.maskApiKey(key.keyPrefix, key.keyPrefix.substring(key.keyPrefix.length - 4)),
      environment: key.environment,
      scopes: key.scopes.map(s => s.scope),
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
    }));
  }

  async revoke(projectSlug: string, keyId: string) {
    const project = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
    });

    if (!project) {
      throw new NotFoundException(`Project with slug '${projectSlug}' not found`);
    }

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

  async roll(projectSlug: string, keyId: string, createdBy?: string) {
    const project = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
    });

    if (!project) {
      throw new NotFoundException(`Project with slug '${projectSlug}' not found`);
    }

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

    const newApiKey = CryptoUtil.generateApiKey(oldKey.environment);
    const keyHash = CryptoUtil.hashApiKey(newApiKey);
    const keyPrefix = CryptoUtil.getKeyPrefix(newApiKey);

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
          name: `${oldKey.name} (rolled)`,
          environment: oldKey.environment,
          expiresAt: oldKey.expiresAt,
          createdBy,
          scopes: {
            create: oldKey.scopes.map(s => ({ scope: s.scope })),
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
      scopes: createdApiKey.scopes.map(s => s.scope),
      environment: createdApiKey.environment,
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
        project: true,
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
      scopes: key.scopes.map(s => s.scope),
      environment: key.environment,
    };
  }
}