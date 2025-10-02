import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SendMessageDto } from '../dto/send-message.dto';
import { SendReactionDto } from '../dto/send-reaction.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { MessageQueue } from '../../queues/message.queue';
import { PlatformsService } from '../platforms.service';
import { PlatformRegistry } from '../services/platform-registry.service';
import { SecurityUtil, AuthContext } from '../../common/utils/security.util';
import { ReactionType, Prisma } from '@prisma/client';
import { WebhookDeliveryService } from '../../webhooks/services/webhook-delivery.service';
import { WebhookEventType } from '../../webhooks/types/webhook-event.types';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly platformsService: PlatformsService,
    private readonly prisma: PrismaService,
    private readonly messageQueue: MessageQueue,
    private readonly platformRegistry: PlatformRegistry,
    private readonly webhookDeliveryService: WebhookDeliveryService,
  ) {}

  async sendMessage(projectId: string, sendMessageDto: SendMessageDto) {
    const targetCount = sendMessageDto.targets.length;
    const platformIds = sendMessageDto.targets.map((t) => t.platformId);

    this.logger.log(`Sending message to ${targetCount} targets`);

    // Get project and validate platforms
    const project = await this.getProject(projectId);
    for (const target of sendMessageDto.targets) {
      await this.platformsService.validatePlatformConfigById(target.platformId);
    }

    // Queue message for processing
    const queueResult = await this.messageQueue.addMessage({
      projectId: project.id,
      message: sendMessageDto,
    });

    this.logger.log(`Message queued - Job ID: ${queueResult.jobId}`);

    const response = {
      success: true,
      jobId: queueResult.jobId,
      status: queueResult.status,
      targets: sendMessageDto.targets,
      platformIds,
      timestamp: new Date().toISOString(),
      message: 'Message queued for delivery',
    };
    return response;
  }

  async getMessageStatus(jobId: string) {
    // Get job status from queue
    const jobStatus = await this.messageQueue.getJobStatus(jobId);
    if (!jobStatus) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    // Get actual delivery results from database
    const deliveryResults = await this.prisma.sentMessage.findMany({
      where: { jobId },
      select: {
        id: true,
        platformId: true,
        platform: true,
        targetChatId: true,
        targetUserId: true,
        targetType: true,
        status: true,
        errorMessage: true,
        providerMessageId: true,
        sentAt: true,
        createdAt: true,
      },
    });

    // Calculate delivery summary
    const totalTargets = deliveryResults.length;
    const successfulDeliveries = deliveryResults.filter(
      (r) => r.status === 'sent',
    ).length;
    const failedDeliveries = deliveryResults.filter(
      (r) => r.status === 'failed',
    ).length;
    const pendingDeliveries = deliveryResults.filter(
      (r) => r.status === 'pending',
    ).length;

    // Determine overall status
    let overallStatus: 'completed' | 'failed' | 'partial' | 'pending';
    if (pendingDeliveries > 0) {
      overallStatus = 'pending';
    } else if (successfulDeliveries === totalTargets) {
      overallStatus = 'completed';
    } else if (failedDeliveries === totalTargets) {
      overallStatus = 'failed';
    } else {
      overallStatus = 'partial';
    }

    return {
      ...jobStatus,
      delivery: {
        overallStatus,
        summary: {
          totalTargets,
          successful: successfulDeliveries,
          failed: failedDeliveries,
          pending: pendingDeliveries,
        },
        results: deliveryResults,
        errors: deliveryResults
          .filter((r) => r.status === 'failed' && r.errorMessage)
          .map((r) => ({
            platform: r.platform,
            target: `${r.targetType}:${r.targetChatId}`,
            error: r.errorMessage,
          })),
      },
    };
  }

  async getQueueMetrics() {
    return this.messageQueue.getQueueMetrics();
  }

  async retryMessage(jobId: string) {
    return this.messageQueue.retryFailedJob(jobId);
  }

  async reactToMessage(
    projectId: string,
    reactionDto: SendReactionDto,
    authContext: AuthContext,
  ) {
    this.logger.log(
      `Adding reaction ${reactionDto.emoji} to message ${reactionDto.messageId}`,
    );

    // Prepare context (validates platform, ownership, gets provider)
    const { provider, connectionKey, platformConfig } =
      await this.prepareReactionContext(projectId, reactionDto, authContext);

    // Find message and determine origin
    const { chatId, fromMe } = await this.findMessageAndDetermineOrigin(
      reactionDto.messageId,
      reactionDto.platformId,
    );

    // Validate provider supports reactions
    if (!provider.sendReaction) {
      throw new BadRequestException(
        `Platform ${platformConfig.platform} does not support sending reactions`,
      );
    }

    // Send reaction
    await provider.sendReaction(
      connectionKey,
      chatId,
      reactionDto.messageId,
      reactionDto.emoji,
      fromMe,
    );

    this.logger.log(`Reaction sent successfully`);

    return {
      success: true,
      platformId: reactionDto.platformId,
      messageId: reactionDto.messageId,
      emoji: reactionDto.emoji,
      timestamp: new Date().toISOString(),
    };
  }

  async unreactToMessage(
    projectId: string,
    reactionDto: SendReactionDto,
    authContext: AuthContext,
  ) {
    this.logger.log(
      `Removing reaction ${reactionDto.emoji} from message ${reactionDto.messageId}`,
    );

    // Prepare context (validates platform, ownership, gets provider)
    const { provider, connectionKey, platformConfig } =
      await this.prepareReactionContext(projectId, reactionDto, authContext);

    // Find message and determine origin
    const { chatId, fromMe } = await this.findMessageAndDetermineOrigin(
      reactionDto.messageId,
      reactionDto.platformId,
    );

    // Validate provider supports unreact
    if (!provider.unreactFromMessage) {
      throw new BadRequestException(
        `Platform ${platformConfig.platform} does not support removing reactions`,
      );
    }

    // Remove reaction
    await provider.unreactFromMessage(
      connectionKey,
      chatId,
      reactionDto.messageId,
      reactionDto.emoji,
      fromMe,
    );

    this.logger.log(`Reaction removed successfully`);

    return {
      success: true,
      platformId: reactionDto.platformId,
      messageId: reactionDto.messageId,
      emoji: reactionDto.emoji,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Store incoming message from platform providers
   * Returns true if stored successfully, false if duplicate (P2002)
   * Identity resolution happens dynamically at query time via JOIN
   */
  async storeIncomingMessage(data: {
    projectId: string;
    platformId: string;
    platform: string;
    providerMessageId: string;
    providerChatId: string;
    providerUserId: string;
    userDisplay?: string;
    messageText: string | null;
    messageType: string;
    rawData: any;
  }): Promise<boolean> {
    try {
      const storedMessage = await this.prisma.receivedMessage.create({
        data: {
          projectId: data.projectId,
          platformId: data.platformId,
          platform: data.platform,
          providerMessageId: data.providerMessageId,
          providerChatId: data.providerChatId,
          providerUserId: data.providerUserId,
          userDisplay: data.userDisplay,
          messageText: data.messageText,
          messageType: data.messageType,
          rawData: data.rawData,
        },
      });

      this.logger.debug(
        `Stored ${data.platform} message ${storedMessage.id} from ${data.userDisplay || data.providerUserId}`,
      );

      // Deliver webhook notification for incoming message
      await this.webhookDeliveryService.deliverEvent(
        data.projectId,
        WebhookEventType.MESSAGE_RECEIVED,
        {
          message_id: storedMessage.id,
          platform: data.platform,
          platform_id: data.platformId,
          chat_id: data.providerChatId,
          user_id: data.providerUserId,
          user_display: data.userDisplay ?? null,
          text: data.messageText,
          message_type: data.messageType,
          received_at: storedMessage.receivedAt.toISOString(),
        },
      );

      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.debug(
          `Duplicate message ignored: ${data.providerMessageId} on platform ${data.platformId}`,
        );
        return false;
      }
      throw error;
    }
  }

  /**
   * Store incoming button click from platform providers
   * Returns true if stored successfully, false if duplicate (P2002)
   * Identity resolution happens dynamically at query time via JOIN
   */
  async storeIncomingButtonClick(data: {
    projectId: string;
    platformId: string;
    platform: string;
    providerMessageId: string;
    providerChatId: string;
    providerUserId: string;
    userDisplay?: string;
    buttonValue: string;
    rawData: any;
  }): Promise<boolean> {
    try {
      const storedButton = await this.prisma.receivedMessage.create({
        data: {
          projectId: data.projectId,
          platformId: data.platformId,
          platform: data.platform,
          providerMessageId: data.providerMessageId,
          providerChatId: data.providerChatId,
          providerUserId: data.providerUserId,
          userDisplay: data.userDisplay,
          messageText: data.buttonValue,
          messageType: 'button_click',
          rawData: data.rawData,
        },
      });

      this.logger.debug(
        `Stored ${data.platform} button click ${storedButton.id} from ${data.userDisplay || data.providerUserId}`,
      );

      // Deliver webhook notification for button click
      await this.webhookDeliveryService.deliverEvent(
        data.projectId,
        WebhookEventType.BUTTON_CLICKED,
        {
          message_id: storedButton.id,
          platform: data.platform,
          platform_id: data.platformId,
          chat_id: data.providerChatId,
          user_id: data.providerUserId,
          user_display: data.userDisplay ?? null,
          button_value: data.buttonValue,
          clicked_at: storedButton.receivedAt.toISOString(),
        },
      );

      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.debug(
          `Duplicate button click ignored: ${data.providerMessageId} on platform ${data.platformId}`,
        );
        return false;
      }
      throw error;
    }
  }

  /**
   * Store incoming reaction from platform providers
   * Returns true if stored successfully, false if duplicate (P2002)
   * Identity resolution happens dynamically at query time via JOIN
   */
  async storeIncomingReaction(data: {
    projectId: string;
    platformId: string;
    platform: string;
    providerMessageId: string;
    providerChatId: string;
    providerUserId: string;
    userDisplay?: string;
    emoji: string;
    reactionType: ReactionType;
    rawData: any;
  }): Promise<boolean> {
    try {
      const storedReaction = await this.prisma.receivedReaction.create({
        data: {
          projectId: data.projectId,
          platformId: data.platformId,
          platform: data.platform,
          providerMessageId: data.providerMessageId,
          providerChatId: data.providerChatId,
          providerUserId: data.providerUserId,
          userDisplay: data.userDisplay,
          emoji: data.emoji,
          reactionType: data.reactionType,
          rawData: data.rawData,
        },
      });

      this.logger.debug(
        `Stored ${data.reactionType} reaction: ${data.emoji} by ${data.userDisplay || data.providerUserId}`,
      );

      // Deliver webhook notification
      const eventType =
        data.reactionType === ReactionType.added
          ? WebhookEventType.REACTION_ADDED
          : WebhookEventType.REACTION_REMOVED;

      await this.webhookDeliveryService.deliverEvent(
        data.projectId,
        eventType,
        {
          message_id: storedReaction.id,
          platform: data.platform,
          platform_id: data.platformId,
          chat_id: data.providerChatId,
          user_id: data.providerUserId,
          user_display: data.userDisplay ?? null,
          emoji: data.emoji,
          timestamp: storedReaction.receivedAt.toISOString(),
          raw: {
            original_message_id: data.providerMessageId,
          },
        },
      );

      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.debug(
          `Duplicate ${data.reactionType} reaction ignored: ${data.emoji} on ${data.providerMessageId}`,
        );
        return false;
      }
      throw error;
    }
  }

  /**
   * Helper: Prepare reaction context (validates platform, ownership, gets provider)
   */
  private async prepareReactionContext(
    projectId: string,
    reactionDto: SendReactionDto,
    authContext: AuthContext,
  ) {
    // Validate platform exists
    const platformConfig =
      await this.platformsService.validatePlatformConfigById(
        reactionDto.platformId,
      );

    // SECURITY: Get project and validate access (defense-in-depth)
    const project = await SecurityUtil.getProjectWithAccess(
      this.prisma,
      projectId,
      authContext,
      'send reactions',
    );

    // SECURITY: Validate platform belongs to project
    if (platformConfig.projectId !== project.id) {
      throw new BadRequestException(
        `Platform ${reactionDto.platformId} does not belong to project ${projectId}`,
      );
    }

    // Get provider for this platform
    const provider = this.platformRegistry.getProvider(platformConfig.platform);
    if (!provider) {
      throw new BadRequestException(
        `Provider not found for platform: ${platformConfig.platform}`,
      );
    }

    const connectionKey = `${project.id}:${platformConfig.id}`;

    return { provider, connectionKey, platformConfig };
  }

  /**
   * Helper: Find message in DB and determine if it's from us (optimized with Promise.all)
   */
  private async findMessageAndDetermineOrigin(
    messageId: string,
    platformId: string,
  ): Promise<{ chatId: string; fromMe: boolean }> {
    // Optimize: Query both tables in parallel
    const [receivedMessage, sentMessage] = await Promise.all([
      this.prisma.receivedMessage.findFirst({
        where: {
          providerMessageId: messageId,
          platformId: platformId,
        },
      }),
      this.prisma.sentMessage.findFirst({
        where: {
          providerMessageId: messageId,
          platformId: platformId,
        },
      }),
    ]);

    if (receivedMessage) {
      return {
        chatId: receivedMessage.providerChatId,
        fromMe: false,
      };
    }

    if (sentMessage) {
      return {
        chatId: sentMessage.targetChatId,
        fromMe: true,
      };
    }

    throw new NotFoundException(
      `Message ${messageId} not found on platform ${platformId}`,
    );
  }

  private async getProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project '${projectId}' not found`);
    }

    return project;
  }
}
