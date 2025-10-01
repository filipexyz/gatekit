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
import { AttachmentDto, ButtonDto } from '../dto/send-message.dto';
import { WebhookDeliveryService } from '../../webhooks/services/webhook-delivery.service';
import { WebhookEventType } from '../../webhooks/types/webhook-event.types';
import { PlatformCapability } from '../enums/platform-capability.enum';
import { EmbedDto } from '../dto/send-message.dto';
import { UrlValidationUtil } from '../../common/utils/url-validation.util';
import { ProviderUtil } from './provider.util';
import { ReactionType } from '@prisma/client';
import { MessagesService } from '../messages/messages.service';

interface TelegramConnection {
  connectionKey: string; // projectId:platformId
  projectId: string;
  platformId: string;
  bot: TelegramBot;
  isActive: boolean;
  webhookCleanup?: () => void;
}

@Injectable()
@PlatformProviderDecorator('telegram', [
  { capability: PlatformCapability.SEND_MESSAGE },
  { capability: PlatformCapability.RECEIVE_MESSAGE },
  {
    capability: PlatformCapability.ATTACHMENTS,
    limitations: 'Max 50MB per file, varies by type',
  },
  {
    capability: PlatformCapability.EMBEDS,
    limitations:
      'Max 1024 chars for caption (converted to HTML text + first embed image only)',
  },
  {
    capability: PlatformCapability.BUTTONS,
    limitations: '~100 buttons per message, 1-8 buttons per row recommended',
  },
  {
    capability: PlatformCapability.REACTIONS,
    limitations:
      'Send: DMs and groups. Receive: Only in groups/channels where bot is admin (Telegram API limitation).',
  },
])
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
    private readonly messagesService: MessagesService,
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

    // Create Telegram bot (webhook mode - we handle webhooks via NestJS, not library's server)
    const bot = new TelegramBot(credentials.token, { polling: false });

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
    } else if ((update as any).message_reaction) {
      await this.handleMessageReaction(
        (update as any).message_reaction,
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
        const storedCallback = await this.prisma.receivedMessage.create({
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
            messageType: 'button_click',
            rawData: query as any,
          },
        });
        this.logger.debug(
          `Stored Telegram callback ${query.id} for project ${projectId}`,
        );

        // Deliver webhook event for button click
        await this.webhookDeliveryService.deliverEvent(
          projectId,
          WebhookEventType.BUTTON_CLICKED,
          {
            message_id: storedCallback.id,
            platform: 'telegram',
            platform_id: platformId,
            chat_id: query.message.chat.id.toString(),
            user_id: query.from.id.toString(),
            user_display:
              query.from.username || query.from.first_name || 'Unknown',
            button_value: query.data || '',
            clicked_at: storedCallback.receivedAt.toISOString(),
            raw: {
              callback_id: query.id,
              message_id: query.message.message_id,
            },
          },
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
        allowed_updates: [
          'message',
          'callback_query',
          'inline_query',
          'message_reaction',
          'message_reaction_count',
        ],
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

      const hasEmbeds = reply.embeds && reply.embeds.length > 0;
      const platformLogger = this.createPlatformLogger(
        env.projectId,
        platformId,
      );

      let sentMessage: TelegramBot.Message;
      let finalText = reply.text;

      // Transform embeds to Telegram format (HTML + optional photo)
      // Note: Telegram doesn't have native embeds, so we convert to HTML text + separate photo
      let embedImage: AttachmentDto | undefined;

      if (hasEmbeds && reply.embeds) {
        const embedResults = await Promise.all(
          reply.embeds.map((embed) => this.transformToTelegramEmbed(embed)),
        );

        // Merge all embed texts with message text
        const embedTexts = embedResults
          .map((result) => result.text)
          .filter(Boolean);
        if (embedTexts.length > 0) {
          finalText = this.mergeEmbedWithText(
            finalText,
            embedTexts.join('\n\n---\n\n'),
          );
        }

        // Extract ONLY FIRST embed image (Telegram doesn't have native embeds)
        // Platform limitation: Only the first embed image is sent
        const firstEmbedImage = embedResults.find((result) => result.photo);

        if (firstEmbedImage?.photo) {
          embedImage = { url: firstEmbedImage.photo };

          platformLogger.logMessage(
            'Extracted first embed image (platform limitation)',
            { embedImageUrl: firstEmbedImage.photo },
          );
        }
      }

      // Combine user attachments + embed image (without mutating reply)
      const allMedia: AttachmentDto[] = [
        ...(reply.attachments || []),
        ...(embedImage ? [embedImage] : []),
      ];

      const hasMedia = allMedia.length > 0;

      // Transform buttons if present
      let replyMarkup: TelegramBot.InlineKeyboardMarkup | undefined;
      if (reply.buttons && reply.buttons.length > 0) {
        replyMarkup = await this.transformToTelegramButtons(reply.buttons);
      }

      // Handle media (attachments + embed images)
      if (hasMedia) {
        // Telegram supports media groups (2-10 items of same type)
        if (allMedia.length > 1) {
          sentMessage = await this.sendMediaGroup(
            connection.bot,
            chatId,
            allMedia,
            finalText,
            replyMarkup,
          );
        } else {
          // Single media item
          sentMessage = await this.sendSingleAttachment(
            connection.bot,
            chatId,
            allMedia[0],
            finalText,
            replyMarkup,
          );
        }
      } else {
        // Text-only message (or text with embeds converted to HTML and/or buttons)
        sentMessage = await connection.bot.sendMessage(
          chatId,
          finalText ?? '',
          {
            parse_mode: 'HTML',
            reply_markup: replyMarkup,
          },
        );
      }

      platformLogger.logMessage(`Message sent successfully to chat ${chatId}`, {
        messageId: sentMessage.message_id.toString(),
        chatId,
        messageLength: reply.text?.length || 0,
        mediaCount: allMedia.length,
        userAttachments: reply.attachments?.length || 0,
        embedImages: embedImage ? 1 : 0,
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
    replyMarkup?: TelegramBot.InlineKeyboardMarkup,
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

    // Add reply markup if provided
    if (replyMarkup) {
      options.reply_markup = replyMarkup;
    }

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
   * Note: Telegram media groups don't support reply_markup (buttons)
   * If buttons are needed, send a separate message after the media group
   */
  private async sendMediaGroup(
    bot: TelegramBot,
    chatId: string,
    attachments: AttachmentDto[],
    caption?: string,
    replyMarkup?: TelegramBot.InlineKeyboardMarkup,
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

    // If buttons are provided, send a separate message with buttons
    // (Telegram doesn't support reply_markup on media groups)
    if (replyMarkup) {
      this.logger.debug(
        'Sending buttons in separate message (Telegram limitation)',
      );
      await bot.sendMessage(chatId, '⬆️ Actions for media above:', {
        reply_markup: replyMarkup,
      });
    }

    return messages[0]; // Return first message for ID
  }

  /**
   * Transform universal EmbedDto to Telegram HTML format
   * Platform-specific: Telegram doesn't have native embeds, so we convert to HTML text + photo
   * Supports graceful degradation for author, url, fields, footer, and timestamp
   * Includes SSRF protection for all URLs
   */
  private async transformToTelegramEmbed(
    embed: EmbedDto,
  ): Promise<{ text: string; photo?: string }> {
    const parts: string[] = [];

    // Author (header section)
    if (embed.author) {
      if (embed.author.url) {
        try {
          await UrlValidationUtil.validateUrl(
            embed.author.url,
            'embed author URL',
          );
          parts.push(
            `📬 <a href="${this.escapeHtml(embed.author.url)}">${this.escapeHtml(embed.author.name)}</a>`,
          );
        } catch (error) {
          this.logger.warn(
            `Invalid or unsafe author URL: ${embed.author.url}, skipping link. ${error.message}`,
          );
          parts.push(`📬 ${this.escapeHtml(embed.author.name)}`);
        }
      } else {
        parts.push(`📬 ${this.escapeHtml(embed.author.name)}`);
      }
      parts.push('━━━━━━━━━━━━━━━━━');
    }

    // Title (bold) with optional URL
    if (embed.title) {
      if (embed.url) {
        try {
          await UrlValidationUtil.validateUrl(embed.url, 'embed URL');
          parts.push(
            `<b><a href="${this.escapeHtml(embed.url)}">${this.escapeHtml(embed.title)}</a></b>`,
          );
        } catch (error) {
          this.logger.warn(
            `Invalid or unsafe embed URL: ${embed.url}, skipping link. ${error.message}`,
          );
          parts.push(`<b>${this.escapeHtml(embed.title)}</b>`);
        }
      } else {
        parts.push(`<b>${this.escapeHtml(embed.title)}</b>`);
      }
    }

    // Description
    if (embed.description) {
      parts.push(this.escapeHtml(embed.description));
    }

    // Fields (structured data)
    if (embed.fields && embed.fields.length > 0) {
      parts.push('━━━━━━━━━━━━━━━━━');

      const fieldLines: string[] = [];
      let inlineBuffer: string[] = [];

      for (const field of embed.fields) {
        const fieldText = `<b>${this.escapeHtml(field.name)}:</b> ${this.escapeHtml(field.value)}`;

        if (field.inline) {
          inlineBuffer.push(fieldText);

          // Telegram doesn't have real inline, so we group inline fields on same line (max 2)
          if (inlineBuffer.length >= 2) {
            fieldLines.push(inlineBuffer.join(' • '));
            inlineBuffer = [];
          }
        } else {
          // Flush inline buffer first
          if (inlineBuffer.length > 0) {
            fieldLines.push(inlineBuffer.join(' • '));
            inlineBuffer = [];
          }
          fieldLines.push(fieldText);
        }
      }

      // Flush remaining inline fields
      if (inlineBuffer.length > 0) {
        fieldLines.push(inlineBuffer.join(' • '));
      }

      parts.push(fieldLines.join('\n'));
    }

    // Footer and timestamp
    if (embed.footer || embed.timestamp) {
      parts.push('━━━━━━━━━━━━━━━━━');

      if (embed.timestamp) {
        const date = new Date(embed.timestamp);
        if (!isNaN(date.getTime())) {
          const formattedDate = date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
          parts.push(`⏰ ${formattedDate}`);
        }
      }

      if (embed.footer) {
        parts.push(`💡 ${this.escapeHtml(embed.footer.text)}`);
      }
    }

    const text = parts.join('\n\n');
    const photo = embed.imageUrl || embed.thumbnailUrl;

    this.logger.debug(
      `Transformed embed to Telegram format: ${embed.title || 'Untitled'}, photo: ${!!photo}`,
    );

    return { text, photo };
  }

  /**
   * Merge embed content with existing message text
   */
  private mergeEmbedWithText(
    originalText: string | undefined,
    embedText: string | undefined,
  ): string {
    if (!embedText) return originalText || '';
    if (!originalText) return embedText;
    return `${originalText}\n\n${embedText}`;
  }

  /**
   * Escape HTML special characters for Telegram
   * Prevents XSS attacks by escaping: & < > " '
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Transform universal ButtonDto array to Telegram InlineKeyboardMarkup
   * Platform-specific transformation with validation
   */
  private async transformToTelegramButtons(
    buttons: ButtonDto[],
  ): Promise<TelegramBot.InlineKeyboardMarkup> {
    const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

    // Group buttons in rows (2 buttons per row for optimal mobile layout)
    const buttonsPerRow = 2;

    for (let i = 0; i < buttons.length; i += buttonsPerRow) {
      const row: TelegramBot.InlineKeyboardButton[] = [];
      const rowButtons = buttons.slice(i, i + buttonsPerRow);

      for (const btn of rowButtons) {
        try {
          if (btn.url) {
            // Link button - validate URL (SSRF protection)
            await UrlValidationUtil.validateUrl(btn.url, 'button URL');
            row.push({ text: btn.text, url: btn.url });
          } else if (btn.value) {
            // Callback button - validate callback_data length (Telegram limit: 1-64 bytes)
            if (btn.value.length > 64) {
              this.logger.warn(
                `Button value exceeds 64 bytes: "${btn.value}", truncating`,
              );
              row.push({
                text: btn.text,
                callback_data: btn.value.substring(0, 64),
              });
            } else {
              row.push({ text: btn.text, callback_data: btn.value });
            }
          } else {
            this.logger.warn(
              `Button "${btn.text}" has no value or url, skipping`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Failed to create button "${btn.text}": ${error.message}`,
          );
        }
      }

      if (row.length > 0) {
        keyboard.push(row);
      }
    }

    this.logger.debug(
      `Transformed ${buttons.length} buttons to ${keyboard.length} Telegram keyboard rows`,
    );

    return { inline_keyboard: keyboard };
  }

  /**
   * Send a reaction to a message on Telegram
   */
  async sendReaction(
    connectionKey: string,
    chatId: string,
    messageId: string,
    emoji: string,
    fromMe?: boolean,
  ): Promise<void> {
    // Get credentials using shared utility
    const { platformId, credentials } =
      await ProviderUtil.getPlatformCredentials<{ token: string }>(
        connectionKey,
        this.prisma,
        'Telegram',
      );

    const botToken = credentials.token;
    if (!botToken) {
      throw new Error(`Telegram bot token not found for ${platformId}`);
    }

    try {
      // Validate and parse chat ID and message ID
      const chatIdNum = parseInt(chatId);
      const messageIdNum = parseInt(messageId);

      if (isNaN(chatIdNum) || isNaN(messageIdNum)) {
        throw new Error(
          `Invalid Telegram chat ID or message ID format: chatId=${chatId}, messageId=${messageId}`,
        );
      }

      // Create temporary bot instance for API call
      const TelegramBot = (await import('node-telegram-bot-api')).default;
      const bot = new TelegramBot(botToken, { polling: false });

      // Telegram Bot API: setMessageReaction
      await bot.setMessageReaction(chatIdNum, messageIdNum, {
        reaction: [{ type: 'emoji', emoji: emoji as any }],
      });

      this.logger.debug(
        `Telegram reaction sent: ${emoji} to message ${messageId} in chat ${chatId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send Telegram reaction [${connectionKey}]: ${error.message}`,
      );
      throw error;
    }
  }

  async unreactFromMessage(
    connectionKey: string,
    chatId: string,
    messageId: string,
    emoji: string,
    fromMe?: boolean,
  ): Promise<void> {
    // Get credentials using shared utility
    const { platformId, credentials } =
      await ProviderUtil.getPlatformCredentials<{ token: string }>(
        connectionKey,
        this.prisma,
        'Telegram',
      );

    const botToken = credentials.token;
    if (!botToken) {
      throw new Error(`Telegram bot token not found for ${platformId}`);
    }

    try {
      // Validate and parse chat ID and message ID
      const chatIdNum = parseInt(chatId);
      const messageIdNum = parseInt(messageId);

      if (isNaN(chatIdNum) || isNaN(messageIdNum)) {
        throw new Error(
          `Invalid Telegram chat ID or message ID format: chatId=${chatId}, messageId=${messageId}`,
        );
      }

      // Create temporary bot instance for API call
      const TelegramBot = (await import('node-telegram-bot-api')).default;
      const bot = new TelegramBot(botToken, { polling: false });

      // Telegram Bot API: setMessageReaction with empty array removes all reactions
      await bot.setMessageReaction(chatIdNum, messageIdNum, {
        reaction: [],
      } as any);

      this.logger.debug(
        `Telegram reaction removed: ${emoji} from message ${messageId} in chat ${chatId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to remove Telegram reaction [${connectionKey}]: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Handle incoming message reactions from Telegram
   */
  private async handleMessageReaction(
    reaction: any,
    projectId: string,
    platformId?: string,
  ) {
    if (!platformId) return;

    try {
      // Validate user exists (prevent null pointer exceptions)
      if (!reaction.user || !reaction.user.id) {
        this.logger.warn(`Reaction event missing user data, skipping`);
        return;
      }

      // reaction structure: { chat, user, message_id, date, old_reaction, new_reaction }
      const oldReactions = reaction.old_reaction || [];
      const newReactions = reaction.new_reaction || [];

      // Find added reactions (in new but not in old)
      const addedReactions = newReactions.filter(
        (newR: any) =>
          !oldReactions.some(
            (oldR: any) =>
              oldR.type === newR.type &&
              (oldR.type === 'emoji' ? oldR.emoji === newR.emoji : true),
          ),
      );

      // Find removed reactions (in old but not in new)
      const removedReactions = oldReactions.filter(
        (oldR: any) =>
          !newReactions.some(
            (newR: any) =>
              newR.type === oldR.type &&
              (newR.type === 'emoji' ? newR.emoji === oldR.emoji : true),
          ),
      );

      // Process added reactions
      for (const addedReaction of addedReactions) {
        if (addedReaction.type === 'emoji') {
          try {
            const success = await this.messagesService.storeIncomingReaction({
              projectId,
              platformId,
              platform: 'telegram',
              providerMessageId: reaction.message_id.toString(),
              providerChatId: reaction.chat.id.toString(),
              providerUserId: reaction.user.id.toString(),
              userDisplay:
                reaction.user.username || reaction.user.first_name || 'Unknown',
              emoji: addedReaction.emoji,
              reactionType: ReactionType.added,
              rawData: reaction,
            });

            if (success) {
              this.logger.debug(
                `Telegram reaction added: ${addedReaction.emoji} by ${reaction.user.id}`,
              );
            }
          } catch (error) {
            this.logger.error(
              `Failed to handle Telegram reaction add: ${error.message}`,
            );
          }
        }
      }

      // Process removed reactions
      for (const removedReaction of removedReactions) {
        if (removedReaction.type === 'emoji') {
          try {
            const success = await this.messagesService.storeIncomingReaction({
              projectId,
              platformId,
              platform: 'telegram',
              providerMessageId: reaction.message_id.toString(),
              providerChatId: reaction.chat.id.toString(),
              providerUserId: reaction.user.id.toString(),
              userDisplay:
                reaction.user.username || reaction.user.first_name || 'Unknown',
              emoji: removedReaction.emoji,
              reactionType: ReactionType.removed,
              rawData: reaction,
            });

            if (success) {
              this.logger.debug(
                `Telegram reaction removed: ${removedReaction.emoji} by ${reaction.user.id}`,
              );
            }
          } catch (error) {
            this.logger.error(
              `Failed to handle Telegram reaction remove: ${error.message}`,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to handle message reaction: ${error.message}`);
    }
  }
}
