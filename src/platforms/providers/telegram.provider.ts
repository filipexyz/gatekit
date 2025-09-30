import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import TelegramBot = require('node-telegram-bot-api');
import {
  PlatformProvider,
  WebhookConfig,
} from '../interfaces/platform-provider.interface';
import { PlatformAdapter } from '../interfaces/platform-adapter.interface';
import type { IEventBus } from '../interfaces/event-bus.interface';
import { EVENT_BUS } from '../interfaces/event-bus.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformProviderDecorator } from '../decorators/platform-provider.decorator';
import { MessageEnvelopeV1 } from '../interfaces/message-envelope.interface';
import { makeEnvelope } from '../utils/envelope.factory';
import { CryptoUtil } from '../../common/utils/crypto.util';
import { PlatformLogsService } from '../services/platform-logs.service';
import { PlatformLogger } from '../utils/platform-logger';
import { AttachmentUtil } from '../../common/utils/attachment.util';
import { AttachmentDto } from '../dto/send-message.dto';
import { WebhookDeliveryService } from '../../webhooks/services/webhook-delivery.service';
import { WebhookEventType } from '../../webhooks/types/webhook-event.types';

interface TelegramConnection {
  connectionKey: string; // projectId:platformId
  projectId: string;
  platformId: string;
  bot: TelegramBot;
  isActive: boolean;
  webhookCleanup?: () => void;
}

@Injectable()
@PlatformProviderDecorator('telegram')
export class TelegramProvider implements PlatformProvider, PlatformAdapter {
  private readonly logger = new Logger(TelegramProvider.name);
  private readonly connections = new Map<string, TelegramConnection>();

  readonly name = 'telegram';
  readonly displayName = 'Telegram';
  readonly connectionType = 'webhook' as const;
  readonly channel = 'telegram' as const;

  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
    private readonly prisma: PrismaService,
    private readonly platformLogsService: PlatformLogsService,
    private readonly webhookDeliveryService: WebhookDeliveryService,
  ) {
    // Constructor uses dependency injection - no initialization needed
  }

  async initialize(): Promise<void> {
    this.logger.log('Telegram provider initialized');
  }

  private createPlatformLogger(
    projectId: string,
    platformId?: string,
  ): PlatformLogger {
    return PlatformLogger.create(this.platformLogsService, {
      projectId,
      platformId,
      platform: this.name,
    });
  }

  async shutdown(): Promise<void> {
    this.logger.log('Shutting down Telegram provider...');

    const connectionKeys = Array.from(this.connections.keys());
    const promises = connectionKeys.map((key) => this.removeAdapter(key));

    await Promise.all(promises);
    this.logger.log('Telegram provider shut down');
  }

  async createAdapter(
    connectionKey: string,
    credentials: any,
  ): Promise<PlatformAdapter> {
    const existingConnection = this.connections.get(connectionKey);

    if (existingConnection) {
      // Return this provider as the adapter
      return this;
    }

    // Parse connectionKey to get projectId and platformId
    const [projectId, platformId] = connectionKey.split(':');

    // Create Telegram bot (webhook mode)
    const bot = new TelegramBot(credentials.token, { webHook: true });

    const connection: TelegramConnection = {
      connectionKey,
      projectId,
      platformId,
      bot,
      isActive: false,
    };

    // Store connection with composite key
    this.connections.set(connectionKey, connection);

    try {
      // Register webhook with Telegram if we have a webhook token
      if (credentials.webhookToken) {
        await this.registerWebhook(
          bot,
          credentials.token,
          credentials.webhookToken,
        );
      }

      connection.isActive = true;

      // Enhanced logging for connection success
      const platformLogger = this.createPlatformLogger(projectId, platformId);
      platformLogger.logConnection(
        `Telegram connection created for ${connectionKey}`,
        {
          connectionKey,
          botUsername: credentials.botUsername,
          hasWebhook: !!credentials.webhookToken,
        },
      );

      this.logger.log(`Telegram connection created for ${connectionKey}`);
      return this; // Provider IS the adapter
    } catch (error) {
      // Enhanced logging for connection failure
      const platformLogger = this.createPlatformLogger(projectId, platformId);
      platformLogger.errorConnection(
        `Failed to create Telegram connection for ${connectionKey}`,
        error,
        {
          connectionKey,
          botToken: credentials.token ? 'present' : 'missing',
        },
      );

      this.logger.error(
        `Failed to create Telegram connection for ${connectionKey}: ${error.message}`,
      );

      // Clean up on failure
      this.connections.delete(connectionKey);

      throw error;
    }
  }

  getAdapter(connectionKey: string): PlatformAdapter | undefined {
    const connection = this.connections.get(connectionKey);
    return connection ? this : undefined;
  }

  async removeAdapter(connectionKey: string): Promise<void> {
    const connection = this.connections.get(connectionKey);
    if (!connection) return;

    this.logger.log(`Removing Telegram connection for ${connectionKey}`);

    try {
      // Clean up webhook handlers if any
      if (connection.webhookCleanup) {
        connection.webhookCleanup();
        this.logger.debug(`Webhook cleanup completed for ${connectionKey}`);
      }

      // Mark as inactive to prevent further message processing
      connection.isActive = false;

      // Note: Telegram bots don't need explicit connection cleanup like Discord
      // The bot token remains valid, we just stop processing messages for this connection

      this.logger.debug(`Telegram connection cleaned up for ${connectionKey}`);
    } catch (error) {
      this.logger.error(
        `Error cleaning up Telegram connection for ${connectionKey}: ${error.message}`,
      );
    } finally {
      // Always remove from connections map
      this.connections.delete(connectionKey);
      this.logger.debug(
        `Connection removed from registry for ${connectionKey}`,
      );
    }
  }

  getWebhookConfig(): WebhookConfig {
    return {
      path: 'telegram/:webhookToken',
      handler: async (params: any, body: any, headers: any) => {
        const { webhookToken } = params;

        // Validate UUID format
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(webhookToken)) {
          throw new NotFoundException('Invalid webhook token');
        }

        // Find platform configuration by webhook token
        const platformConfig = await this.prisma.projectPlatform.findUnique({
          where: { webhookToken },
          include: { project: true },
        });

        if (!platformConfig || platformConfig.platform !== 'telegram') {
          throw new NotFoundException('Webhook not found');
        }

        if (!platformConfig.isActive) {
          return { ok: false, error: 'Platform disabled' };
        }

        // Process the webhook update directly with platform ID
        await this.processWebhookUpdate(
          platformConfig.projectId,
          body as TelegramBot.Update,
          platformConfig.id,
        );

        // Enhanced logging for webhook processing
        const platformLogger = this.createPlatformLogger(
          platformConfig.projectId,
          platformConfig.id,
        );
        const update = body as TelegramBot.Update;
        platformLogger.logWebhook(
          `Processed Telegram webhook for project: ${platformConfig.project.slug}`,
          {
            updateType: update.message
              ? 'message'
              : update.callback_query
                ? 'callback'
                : 'other',
            messageId: update.message?.message_id,
            callbackId: update.callback_query?.id,
            chatId:
              update.message?.chat?.id ||
              update.callback_query?.message?.chat?.id,
          },
        );

        this.logger.log(
          `Processed Telegram webhook for project: ${platformConfig.project.slug}`,
        );

        return { ok: true };
      },
    };
  }

  async isHealthy(): Promise<boolean> {
    // Check if we can connect to at least one bot
    for (const connection of this.connections.values()) {
      if (connection.isActive) {
        try {
          // Try to get bot info
          await connection.bot.getMe();
          return true;
        } catch {
          // Bot is not responding
          connection.isActive = false;
        }
      }
    }

    // If no connections, provider is still healthy (just idle)
    return true;
  }

  getConnectionStats() {
    return {
      totalConnections: this.connections.size,
      connections: Array.from(this.connections.entries()).map(
        ([projectId, conn]) => ({
          projectId,
          isActive: conn.isActive,
        }),
      ),
    };
  }

  // Process webhook update for a specific project
  async processWebhookUpdate(
    projectId: string,
    update: TelegramBot.Update,
    platformId?: string,
  ) {
    // Connections are stored by connectionKey (projectId:platformId), not just projectId
    const connectionKey = platformId ? `${projectId}:${platformId}` : projectId;
    let connection = this.connections.get(connectionKey);

    if (!connection && platformId) {
      this.logger.log(
        `Auto-creating Telegram connection for incoming webhook - project: ${projectId}`,
      );

      // Get platform credentials to create connection
      try {
        const platformConfig = await this.prisma.projectPlatform.findUnique({
          where: { id: platformId },
        });

        if (platformConfig && platformConfig.isActive) {
          // Decrypt credentials and create connection
          const credentials = JSON.parse(
            CryptoUtil.decrypt(platformConfig.credentialsEncrypted),
          );
          const connectionKey = `${projectId}:${platformId}`;

          await this.createAdapter(connectionKey, credentials);
          connection = this.connections.get(connectionKey);
          this.logger.log(
            `✅ Auto-created Telegram connection for webhook processing`,
          );
        }
      } catch (error) {
        this.logger.error(`Failed to auto-create connection: ${error.message}`);
      }
    }

    if (!connection) {
      this.logger.warn(
        `No connection available for project ${projectId} - webhook ignored`,
      );
      return false;
    }

    // Process the update directly
    if (update.message) {
      await this.handleMessage(update.message, projectId, platformId);
    } else if (update.callback_query) {
      await this.handleCallbackQuery(
        update.callback_query,
        projectId,
        platformId,
      );
    }

    return true;
  }

  private async handleMessage(
    msg: TelegramBot.Message,
    projectId: string,
    platformId?: string,
  ) {
    if (msg.from?.is_bot) return;

    // Store the message in database
    if (platformId) {
      try {
        const storedMessage = await this.prisma.receivedMessage.create({
          data: {
            projectId,
            platformId,
            platform: 'telegram',
            providerMessageId: msg.message_id.toString(),
            providerChatId: msg.chat.id.toString(),
            providerUserId: msg.from?.id?.toString() || 'unknown',
            userDisplay:
              msg.from?.username || msg.from?.first_name || 'Unknown',
            messageText: msg.text || null,
            messageType: msg.text ? 'text' : 'other',
            rawData: msg as any,
          },
        });
        this.logger.debug(
          `Stored Telegram message ${msg.message_id} for project ${projectId}`,
        );

        // Deliver webhook event for incoming message
        await this.webhookDeliveryService.deliverEvent(
          projectId,
          WebhookEventType.MESSAGE_RECEIVED,
          {
            message_id: storedMessage.id,
            platform: 'telegram',
            platform_id: platformId,
            chat_id: msg.chat.id.toString(),
            user_id: msg.from?.id?.toString() || 'unknown',
            user_display:
              msg.from?.username || msg.from?.first_name || 'Unknown',
            text: msg.text || null,
            message_type: msg.text ? 'text' : 'other',
            received_at: storedMessage.receivedAt.toISOString(),
          },
        );
      } catch (error) {
        // Check if it's a duplicate message
        if (error.code === 'P2002') {
          this.logger.debug(
            `Message ${msg.message_id} already stored for platform ${platformId}`,
          );
        } else {
          this.logger.error(`Failed to store message: ${error.message}`);
        }
      }
    }

    const env = this.toEnvelopeWithProject(msg, projectId);
    await this.eventBus.publish(env);
  }

  private async handleCallbackQuery(
    query: TelegramBot.CallbackQuery,
    projectId: string,
    platformId?: string,
  ) {
    // Store the callback query as a message
    if (platformId && query.message) {
      try {
        await this.prisma.receivedMessage.create({
          data: {
            projectId,
            platformId,
            platform: 'telegram',
            providerMessageId: `callback_${query.id}`,
            providerChatId: query.message.chat.id.toString(),
            providerUserId: query.from.id.toString(),
            userDisplay:
              query.from.username || query.from.first_name || 'Unknown',
            messageText: query.data || null,
            messageType: 'callback',
            rawData: query as any,
          },
        });
        this.logger.debug(
          `Stored Telegram callback ${query.id} for project ${projectId}`,
        );
      } catch (error) {
        if (error.code !== 'P2002') {
          this.logger.error(`Failed to store callback: ${error.message}`);
        }
      }
    }

    const env = this.toEnvelopeWithProject(query, projectId);
    await this.eventBus.publish(env);

    // Find the bot for this project to answer callback
    const connection = this.connections.get(projectId);
    if (connection && connection.bot) {
      await connection.bot.answerCallbackQuery(query.id);
    }
  }

  private toEnvelopeWithProject(
    msg: TelegramBot.Message | TelegramBot.CallbackQuery,
    projectId: string,
  ): MessageEnvelopeV1 {
    if ('message' in msg) {
      // Handle callback query
      const callbackQuery = msg;
      return makeEnvelope({
        channel: 'telegram',
        projectId,
        threadId: callbackQuery.message?.chat?.id?.toString(),
        user: {
          providerUserId: callbackQuery.from.id.toString(),
          display: callbackQuery.from.username || callbackQuery.from.first_name,
        },
        message: {
          text: callbackQuery.data,
        },
        action: {
          type: 'button',
          value: callbackQuery.data || '',
        },
        provider: {
          eventId: callbackQuery.id,
          raw: callbackQuery,
        },
      });
    }

    // Handle regular message
    const message = msg as TelegramBot.Message;
    return makeEnvelope({
      channel: 'telegram',
      projectId,
      threadId: message.chat.id.toString(),
      user: {
        providerUserId: message.from?.id?.toString() || 'unknown',
        display:
          message.from?.username || message.from?.first_name || 'Unknown',
      },
      message: {
        text: message.text,
      },
      provider: {
        eventId: message.message_id.toString(),
        raw: message,
      },
    });
  }

  // PlatformAdapter interface methods
  async start(): Promise<void> {
    this.logger.log('Telegram provider/adapter started');
  }

  toEnvelope(
    msg: TelegramBot.Message | TelegramBot.CallbackQuery,
    projectId: string,
  ): MessageEnvelopeV1 {
    return this.toEnvelopeWithProject(msg, projectId);
  }

  private async registerWebhook(
    bot: TelegramBot,
    token: string,
    webhookToken: string,
  ): Promise<void> {
    try {
      const baseUrl = process.env.API_BASE_URL || 'https://api.gatekit.dev';
      const webhookUrl = `${baseUrl}/api/v1/webhooks/telegram/${webhookToken}`;

      // Set the webhook URL
      const result = await bot.setWebHook(webhookUrl, {
        max_connections: 100,
        allowed_updates: ['message', 'callback_query', 'inline_query'],
      });

      this.logger.log(
        `Telegram webhook registered: ${webhookUrl} - Result: ${result}`,
      );

      // Verify webhook was set
      const webhookInfo = await bot.getWebHookInfo();
      this.logger.log(
        `Webhook info - URL: ${webhookInfo.url}, Pending: ${webhookInfo.pending_update_count}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to register Telegram webhook: ${error.message}`,
      );
      throw error;
    }
  }

  async sendMessage(
    env: MessageEnvelopeV1,
    reply: {
      text?: string;
      attachments?: any[];
      buttons?: any[];
      embeds?: any[];
      threadId?: string;
      replyTo?: string;
      silent?: boolean;
    },
  ): Promise<{ providerMessageId: string }> {
    // Extract platformId from envelope to construct connection key
    const platformId = (env.provider?.raw as any)?.platformId;
    if (!platformId) {
      this.logger.error('No platformId in envelope, cannot route message');
      throw new Error('No platformId in envelope, cannot route message');
    }

    const connectionKey = `${env.projectId}:${platformId}`;
    const connection = this.connections.get(connectionKey);

    if (!connection || !connection.isActive) {
      throw new Error(
        `Telegram bot not ready for ${connectionKey}, cannot send message`,
      );
    }

    try {
      const chatId = reply.threadId ?? env.threadId;
      if (!chatId) {
        throw new Error('No chat ID provided');
      }

      const hasAttachments = reply.attachments && reply.attachments.length > 0;
      const platformLogger = this.createPlatformLogger(
        env.projectId,
        platformId,
      );

      let sentMessage: TelegramBot.Message;

      // Handle attachments
      if (hasAttachments && reply.attachments && reply.attachments.length > 0) {
        // Telegram supports media groups (2-10 items of same type)
        if (reply.attachments.length > 1) {
          sentMessage = await this.sendMediaGroup(
            connection.bot,
            chatId,
            reply.attachments,
            reply.text,
          );
        } else {
          // Single attachment
          sentMessage = await this.sendSingleAttachment(
            connection.bot,
            chatId,
            reply.attachments[0],
            reply.text,
          );
        }
      } else {
        // Text-only message
        sentMessage = await connection.bot.sendMessage(
          chatId,
          reply.text ?? '',
          {
            parse_mode: 'HTML',
          },
        );
      }

      platformLogger.logMessage(`Message sent successfully to chat ${chatId}`, {
        messageId: sentMessage.message_id.toString(),
        chatId,
        messageLength: reply.text?.length || 0,
        attachmentCount:
          hasAttachments && reply.attachments ? reply.attachments.length : 0,
        parseMode: 'HTML',
      });

      return { providerMessageId: sentMessage.message_id.toString() };
    } catch (error) {
      const platformLogger = this.createPlatformLogger(
        env.projectId,
        platformId,
      );
      platformLogger.errorMessage(
        `Failed to send Telegram message to chat ${reply.threadId ?? env.threadId}`,
        error,
        {
          chatId: reply.threadId ?? env.threadId,
          messageText: reply.text?.substring(0, 100),
          errorType: error.name || 'Unknown',
        },
      );

      this.logger.error('Failed to send Telegram message:', error.message);
      throw error; // Re-throw to propagate error to processor
    }
  }

  /**
   * Sends a single attachment via Telegram
   */
  private async sendSingleAttachment(
    bot: TelegramBot,
    chatId: string,
    attachment: AttachmentDto,
    caption?: string,
  ): Promise<TelegramBot.Message> {
    let fileData: string | Buffer;
    let filename: string;

    // Process attachment data
    if (attachment.url) {
      await AttachmentUtil.validateAttachmentUrl(attachment.url);
      fileData = attachment.url;
      filename =
        attachment.filename ||
        AttachmentUtil.getFilenameFromUrl(attachment.url);
    } else if (attachment.data) {
      AttachmentUtil.validateBase64Data(attachment.data, 50 * 1024 * 1024); // 50MB Telegram limit
      fileData = AttachmentUtil.base64ToBuffer(attachment.data);
      filename = attachment.filename || 'file';
    } else {
      throw new Error('Attachment must have url or data');
    }

    // Detect MIME type
    const mimeType = AttachmentUtil.detectMimeType({
      url: attachment.url,
      data: attachment.data,
      filename: filename,
      providedMimeType: attachment.mimeType,
    });

    const attachmentType = AttachmentUtil.getAttachmentType(mimeType);
    const messageCaption = attachment.caption || caption;
    const options: any = messageCaption
      ? { caption: messageCaption, parse_mode: 'HTML' }
      : {};

    // Route to appropriate Telegram method based on type
    switch (attachmentType) {
      case 'image':
        return await bot.sendPhoto(chatId, fileData, options);
      case 'video':
        return await bot.sendVideo(chatId, fileData, options);
      case 'audio':
        return await bot.sendAudio(chatId, fileData, options);
      default:
        return await bot.sendDocument(chatId, fileData, options);
    }
  }

  /**
   * Sends multiple attachments as media group
   */
  private async sendMediaGroup(
    bot: TelegramBot,
    chatId: string,
    attachments: AttachmentDto[],
    caption?: string,
  ): Promise<TelegramBot.Message> {
    const media: any[] = [];

    for (let i = 0; i < Math.min(attachments.length, 10); i++) {
      const attachment = attachments[i];
      let fileData: string;

      // Telegram media groups only support URLs, not Buffers
      if (attachment.url) {
        await AttachmentUtil.validateAttachmentUrl(attachment.url);
        fileData = attachment.url;
      } else if (attachment.data) {
        // For base64, we need to send individually (Telegram limitation)
        this.logger.warn(
          'Media groups do not support base64 data, sending individually',
        );
        return await this.sendSingleAttachment(
          bot,
          chatId,
          attachment,
          caption,
        );
      } else {
        continue;
      }

      const filename =
        attachment.filename ||
        AttachmentUtil.getFilenameFromUrl(attachment.url);
      const mimeType = AttachmentUtil.detectMimeType({
        url: attachment.url,
        filename: filename,
        providedMimeType: attachment.mimeType,
      });

      const attachmentType = AttachmentUtil.getAttachmentType(mimeType);
      const itemCaption =
        i === 0 ? attachment.caption || caption : attachment.caption;

      // Media groups only support photo and video
      if (attachmentType === 'image') {
        media.push({
          type: 'photo',
          media: fileData,
          caption: itemCaption,
          parse_mode: 'HTML',
        });
      } else if (attachmentType === 'video') {
        media.push({
          type: 'video',
          media: fileData,
          caption: itemCaption,
          parse_mode: 'HTML',
        });
      } else {
        // Documents/audio can't be in media groups, send individually
        return await this.sendSingleAttachment(
          bot,
          chatId,
          attachment,
          caption,
        );
      }
    }

    if (media.length === 0) {
      throw new Error('No valid media items for media group');
    }

    const messages = await bot.sendMediaGroup(chatId, media);
    return messages[0]; // Return first message for ID
  }
}
