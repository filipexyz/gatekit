import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlatformDto } from './dto/create-platform.dto';
import { UpdatePlatformDto } from './dto/update-platform.dto';
import { CryptoUtil } from '../common/utils/crypto.util';
import TelegramBot = require('node-telegram-bot-api');

@Injectable()
export class PlatformsService {
  private readonly logger = new Logger(PlatformsService.name);

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

    // Note: Multiple instances of the same platform are now allowed per project

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
    // Note: This method is deprecated - use getProjectPlatform(platformId) instead
    // Only used for backward compatibility
    const projectPlatform = await this.prisma.projectPlatform.findFirst({
      where: {
        projectId,
        platform,
        isActive: true,
      },
    });

    if (!projectPlatform) {
      throw new NotFoundException(`Platform '${platform}' not configured for project`);
    }

    // No need to check isActive again since we already filtered by it in the query
    return JSON.parse(CryptoUtil.decrypt(projectPlatform.credentialsEncrypted));
  }

  async getProjectPlatform(platformId: string) {
    try {
      // Add timeout to prevent hanging queries
      const platform = await Promise.race([
        this.prisma.projectPlatform.findUnique({
          where: { id: platformId },
          include: { project: true },
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Database query timeout')), 5000)
        )
      ]) as any;

      if (!platform) {
        throw new NotFoundException(`Platform configuration with ID '${platformId}' not found`);
      }

      if (!platform.isActive) {
        throw new ConflictException(`Platform configuration '${platformId}' is not active`);
      }

      // Decrypt credentials with timeout
      let decryptedCredentials;
      try {
        decryptedCredentials = JSON.parse(CryptoUtil.decrypt(platform.credentialsEncrypted));
      } catch (error) {
        throw new BadRequestException('Failed to decrypt platform credentials');
      }

      return {
        id: platform.id,
        projectId: platform.projectId,
        platform: platform.platform,
        isActive: platform.isActive,
        testMode: platform.testMode,
        webhookToken: platform.webhookToken,
        decryptedCredentials,
        project: platform.project,
      };
    } catch (error) {
      if (error.message === 'Database query timeout') {
        throw new BadRequestException('Platform lookup timed out');
      }
      throw error;
    }
  }

  async validatePlatformConfigById(platformId: string) {
    const logger = new Logger('PlatformsService');

    try {
      logger.log(`[VALIDATION START] Checking platformId: ${platformId}`);

      // Direct query with immediate failure on timeout - no hanging connections
      logger.log(`[VALIDATION QUERY] Starting database query for platformId: ${platformId}`);

      const platform = await this.prisma.projectPlatform.findUnique({
        where: { id: platformId },
      });

      logger.log(`[VALIDATION QUERY COMPLETE] Query result for ${platformId}: ${platform ? 'FOUND' : 'NOT_FOUND'}`);

      if (!platform) {
        logger.warn(`[VALIDATION FAILED] Platform not found: ${platformId}`);
        throw new NotFoundException(
          `Platform configuration with ID '${platformId}' not found`,
        );
      }

      if (!platform.isActive) {
        logger.warn(`[VALIDATION FAILED] Platform inactive: ${platformId}`);
        throw new BadRequestException(
          `Platform configuration '${platformId}' is currently disabled`,
        );
      }

      logger.log(`[VALIDATION SUCCESS] Platform validated: ${platformId}`);
      return platform;
    } catch (error) {
      logger.error(`[VALIDATION ERROR] Failed to validate platformId ${platformId}: ${error.message}`);
      // Fail fast - don't retry, don't hang
      throw error;
    }
  }

  async registerWebhook(projectSlug: string, platformId: string) {
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

    if (!platform.isActive) {
      throw new BadRequestException('Platform must be active to register webhook');
    }

    // Decrypt credentials
    const credentials = JSON.parse(CryptoUtil.decrypt(platform.credentialsEncrypted));

    if (platform.platform === 'telegram') {
      try {
        // Create temporary bot instance to register webhook
        const bot = new TelegramBot(credentials.token, { webHook: true });

        const baseUrl = process.env.API_BASE_URL || 'https://api.gatekit.dev';
        const webhookUrl = `${baseUrl}/api/v1/webhooks/telegram/${platform.webhookToken}`;

        // Set the webhook
        const result = await bot.setWebHook(webhookUrl, {
          max_connections: 100,
          allowed_updates: ['message', 'callback_query', 'inline_query'],
        });

        this.logger.log(`Telegram webhook registered for platform ${platformId}: ${webhookUrl}`);

        // Get webhook info to confirm
        const webhookInfo = await bot.getWebHookInfo();

        return {
          message: 'Webhook registered successfully',
          webhookUrl,
          webhookInfo: {
            url: webhookInfo.url,
            has_custom_certificate: webhookInfo.has_custom_certificate,
            pending_update_count: webhookInfo.pending_update_count,
            max_connections: webhookInfo.max_connections,
          },
        };
      } catch (error) {
        this.logger.error(`Failed to register Telegram webhook: ${error.message}`);
        throw new BadRequestException(`Failed to register webhook: ${error.message}`);
      }
    } else if (platform.platform === 'discord') {
      // Discord doesn't need webhook registration - it uses WebSocket
      return {
        message: 'Discord uses WebSocket connection, no webhook registration needed',
        connectionType: 'websocket',
      };
    } else {
      throw new BadRequestException(`Platform '${platform.platform}' does not support webhook registration`);
    }
  }
}