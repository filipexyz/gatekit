import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import TelegramBot = require('node-telegram-bot-api');
import { PlatformProvider, WebhookConfig } from '../interfaces/platform-provider.interface';
import { PlatformAdapter } from '../interfaces/platform-adapter.interface';
import type { IEventBus } from '../interfaces/event-bus.interface';
import { EVENT_BUS } from '../interfaces/event-bus.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformProviderDecorator } from '../decorators/platform-provider.decorator';
import { MessageEnvelopeV1 } from '../interfaces/message-envelope.interface';
import { makeEnvelope } from '../utils/envelope.factory';

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
  ) {}

  async initialize(): Promise<void> {
    this.logger.log('Telegram provider initialized');
  }

  async shutdown(): Promise<void> {
    this.logger.log('Shutting down Telegram provider...');

    const promises: Promise<void>[] = [];
    for (const projectId of this.connections.keys()) {
      promises.push(this.removeAdapter(projectId));
    }

    await Promise.all(promises);
    this.logger.log('Telegram provider shut down');
  }

  async createAdapter(connectionKey: string, credentials: any): Promise<PlatformAdapter> {
    const existingConnection = this.connections.get(connectionKey);

    if (existingConnection) {
      // Return this provider as the adapter
      return this;
    }

    // Parse connectionKey to get projectId and platformId
    const [projectId, platformId] = connectionKey.split(':');

    // Create Telegram bot without auto-webhook (prevents hanging)
    const bot = new TelegramBot(credentials.token, {
      webHook: false,  // Don't auto-setup webhook
      polling: false   // Don't use polling
    });

    // Note: Webhook is configured separately via webhookToken in platform config
    // The webhook URL is: /api/v1/webhooks/telegram/:webhookToken

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
      connection.isActive = true;

      this.logger.log(`Telegram connection created for ${connectionKey}`);
      return this; // Provider IS the adapter
    } catch (error) {
      this.logger.error(`Failed to create Telegram connection for ${connectionKey}: ${error.message}`);

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
      this.logger.error(`Error cleaning up Telegram connection for ${connectionKey}: ${error.message}`);
    } finally {
      // Always remove from connections map
      this.connections.delete(connectionKey);
      this.logger.debug(`Connection removed from registry for ${connectionKey}`);
    }
  }

  getWebhookConfig(): WebhookConfig {
    return {
      path: 'telegram/:webhookToken',
      handler: async (params: any, body: any, headers: any) => {
        const { webhookToken } = params;

        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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

        // Process the webhook update directly
        await this.processWebhookUpdate(platformConfig.projectId, body as TelegramBot.Update);

        this.logger.log(`Processed Telegram webhook for project: ${platformConfig.project.slug}`);

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
      connections: Array.from(this.connections.entries()).map(([projectId, conn]) => ({
        projectId,
        isActive: conn.isActive,
      })),
    };
  }

  // Process webhook update for a specific project
  async processWebhookUpdate(projectId: string, update: TelegramBot.Update) {
    const connection = this.connections.get(projectId);

    if (!connection) {
      this.logger.warn(`No connection found for project ${projectId}`);
      return false;
    }

    // Process the update directly
    if (update.message) {
      await this.handleMessage(update.message, projectId);
    } else if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query, projectId);
    }

    return true;
  }

  private async handleMessage(msg: TelegramBot.Message, projectId: string) {
    if (msg.from?.is_bot) return;
    const env = this.toEnvelopeWithProject(msg, projectId);
    await this.eventBus.publish(env);
  }

  private async handleCallbackQuery(query: TelegramBot.CallbackQuery, projectId: string) {
    const env = this.toEnvelopeWithProject(query, projectId);
    await this.eventBus.publish(env);

    // Find the bot for this project to answer callback
    const connection = this.connections.get(projectId);
    if (connection && connection.bot) {
      await connection.bot.answerCallbackQuery(query.id);
    }
  }

  private toEnvelopeWithProject(msg: TelegramBot.Message | TelegramBot.CallbackQuery, projectId: string): MessageEnvelopeV1 {
    if ('message' in msg) {
      // Handle callback query
      const callbackQuery = msg as TelegramBot.CallbackQuery;
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
        display: message.from?.username || message.from?.first_name || 'Unknown',
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

  toEnvelope(msg: TelegramBot.Message | TelegramBot.CallbackQuery, projectId: string): MessageEnvelopeV1 {
    return this.toEnvelopeWithProject(msg, projectId);
  }

  async sendMessage(
    env: MessageEnvelopeV1,
    reply: { text?: string; attachments?: any[]; buttons?: any[]; embeds?: any[]; threadId?: string; replyTo?: string; silent?: boolean },
  ): Promise<{ providerMessageId: string }> {
    // Extract platformId from envelope to construct connection key
    const platformId = (env.provider?.raw as any)?.platformId;
    if (!platformId) {
      this.logger.error('No platformId in envelope, cannot route message');
      return { providerMessageId: 'telegram-no-platform-id' };
    }

    const connectionKey = `${env.projectId}:${platformId}`;
    const connection = this.connections.get(connectionKey);

    if (!connection || !connection.isActive) {
      this.logger.warn(`Telegram bot not ready for ${connectionKey}, cannot send message`);
      return { providerMessageId: 'telegram-not-ready' };
    }

    try {
      const chatId = reply.threadId ?? env.threadId;
      if (!chatId) {
        throw new Error('No chat ID provided');
      }

      const sentMessage = await connection.bot.sendMessage(chatId, reply.text ?? '', {
        parse_mode: 'HTML',
      });

      return { providerMessageId: sentMessage.message_id.toString() };
    } catch (error) {
      this.logger.error('Failed to send Telegram message:', error.message);
      return { providerMessageId: 'telegram-send-failed' };
    }
  }
}