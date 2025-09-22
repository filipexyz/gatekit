import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlatformDto } from './dto/create-platform.dto';
import { UpdatePlatformDto } from './dto/update-platform.dto';
import { CryptoUtil } from '../common/utils/crypto.util';

@Injectable()
export class PlatformsService {
  constructor(private readonly prisma: PrismaService) {}

  private getWebhookUrl(platform: string, webhookToken: string): string {
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    return `${baseUrl}/api/v1/webhooks/${platform}/${webhookToken}`;
  }

  async create(projectSlug: string, createPlatformDto: CreatePlatformDto) {
    const project = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
    });

    if (!project) {
      throw new NotFoundException(`Project with slug '${projectSlug}' not found`);
    }

    // Check if platform already exists for this project
    const existingPlatform = await this.prisma.projectPlatform.findUnique({
      where: {
        projectId_platform: {
          projectId: project.id,
          platform: createPlatformDto.platform,
        },
      },
    });

    if (existingPlatform) {
      throw new ConflictException(
        `Platform '${createPlatformDto.platform}' already configured for project '${projectSlug}'`,
      );
    }

    // Encrypt credentials
    const encryptedCredentials = CryptoUtil.encrypt(
      JSON.stringify(createPlatformDto.credentials),
    );

    const platform = await this.prisma.projectPlatform.create({
      data: {
        projectId: project.id,
        platform: createPlatformDto.platform,
        credentialsEncrypted: encryptedCredentials,
        isActive: createPlatformDto.isActive ?? true,
        testMode: createPlatformDto.testMode ?? false,
      },
    });

    return {
      id: platform.id,
      platform: platform.platform,
      isActive: platform.isActive,
      testMode: platform.testMode,
      webhookUrl: this.getWebhookUrl(platform.platform, platform.webhookToken),
      createdAt: platform.createdAt,
      updatedAt: platform.updatedAt,
    };
  }

  async findAll(projectSlug: string) {
    const project = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
      include: {
        projectPlatforms: true,
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with slug '${projectSlug}' not found`);
    }

    return project.projectPlatforms.map((platform) => ({
      id: platform.id,
      platform: platform.platform,
      isActive: platform.isActive,
      testMode: platform.testMode,
      webhookUrl: this.getWebhookUrl(platform.platform, platform.webhookToken),
      createdAt: platform.createdAt,
      updatedAt: platform.updatedAt,
    }));
  }

  async findOne(projectSlug: string, platformId: string) {
    const project = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
    });

    if (!project) {
      throw new NotFoundException(`Project with slug '${projectSlug}' not found`);
    }

    const platform = await this.prisma.projectPlatform.findFirst({
      where: {
        id: platformId,
        projectId: project.id,
      },
    });

    if (!platform) {
      throw new NotFoundException(`Platform with id '${platformId}' not found`);
    }

    // Decrypt credentials for response
    const decryptedCredentials = JSON.parse(
      CryptoUtil.decrypt(platform.credentialsEncrypted),
    );

    return {
      id: platform.id,
      platform: platform.platform,
      credentials: decryptedCredentials,
      isActive: platform.isActive,
      testMode: platform.testMode,
      webhookUrl: this.getWebhookUrl(platform.platform, platform.webhookToken),
      createdAt: platform.createdAt,
      updatedAt: platform.updatedAt,
    };
  }

  async update(projectSlug: string, platformId: string, updatePlatformDto: UpdatePlatformDto) {
    const project = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
    });

    if (!project) {
      throw new NotFoundException(`Project with slug '${projectSlug}' not found`);
    }

    const existingPlatform = await this.prisma.projectPlatform.findFirst({
      where: {
        id: platformId,
        projectId: project.id,
      },
    });

    if (!existingPlatform) {
      throw new NotFoundException(`Platform with id '${platformId}' not found`);
    }

    const updateData: any = {};

    if (updatePlatformDto.credentials !== undefined) {
      updateData.credentialsEncrypted = CryptoUtil.encrypt(
        JSON.stringify(updatePlatformDto.credentials),
      );
    }

    if (updatePlatformDto.isActive !== undefined) {
      updateData.isActive = updatePlatformDto.isActive;
    }

    if (updatePlatformDto.testMode !== undefined) {
      updateData.testMode = updatePlatformDto.testMode;
    }

    const platform = await this.prisma.projectPlatform.update({
      where: { id: platformId },
      data: updateData,
    });

    return {
      id: platform.id,
      platform: platform.platform,
      isActive: platform.isActive,
      testMode: platform.testMode,
      webhookUrl: this.getWebhookUrl(platform.platform, platform.webhookToken),
      createdAt: platform.createdAt,
      updatedAt: platform.updatedAt,
    };
  }

  async remove(projectSlug: string, platformId: string) {
    const project = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
    });

    if (!project) {
      throw new NotFoundException(`Project with slug '${projectSlug}' not found`);
    }

    const platform = await this.prisma.projectPlatform.findFirst({
      where: {
        id: platformId,
        projectId: project.id,
      },
    });

    if (!platform) {
      throw new NotFoundException(`Platform with id '${platformId}' not found`);
    }

    await this.prisma.projectPlatform.delete({
      where: { id: platformId },
    });

    return { message: 'Platform removed successfully' };
  }

  async getDecryptedCredentials(projectId: string, platform: string) {
    const projectPlatform = await this.prisma.projectPlatform.findUnique({
      where: {
        projectId_platform: {
          projectId,
          platform,
        },
      },
    });

    if (!projectPlatform) {
      throw new NotFoundException(`Platform '${platform}' not configured for project`);
    }

    if (!projectPlatform.isActive) {
      throw new ConflictException(`Platform '${platform}' is not active`);
    }

    return JSON.parse(CryptoUtil.decrypt(projectPlatform.credentialsEncrypted));
  }
}