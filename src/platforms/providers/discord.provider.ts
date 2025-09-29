import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  Client,
  GatewayIntentBits,
  Message,
  AttachmentBuilder,
} from 'discord.js';
import {
  PlatformProvider,
  PlatformLifecycleEvent,
} from '../interfaces/platform-provider.interface';
import { PlatformAdapter } from '../interfaces/platform-adapter.interface';
import type { IEventBus } from '../interfaces/event-bus.interface';
import { EVENT_BUS } from '../interfaces/event-bus.interface';
import { PlatformProviderDecorator } from '../decorators/platform-provider.decorator';
import { MessageEnvelopeV1 } from '../interfaces/message-envelope.interface';
import { makeEnvelope } from '../utils/envelope.factory';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoUtil } from '../../common/utils/crypto.util';
import { AttachmentUtil } from '../../common/utils/attachment.util';

interface DiscordConnection {
  connectionKey: string; // projectId:platformId
  projectId: string;
  platformId: string;
  client: Client;
  token: string;
  isConnected: boolean;
  lastActivity: Date;
  eventCleanup?: () => void;
}

@Injectable()
@PlatformProviderDecorator('discord')
export class DiscordProvider
  implements PlatformProvider, PlatformAdapter, OnModuleInit
{
  private readonly logger = new Logger(DiscordProvider.name);
  private readonly connections = new Map<string, DiscordConnection>();
  private readonly MAX_CONNECTIONS = 100;

  readonly name = 'discord';
  readonly displayName = 'Discord';
  readonly connectionType = 'websocket' as const;
  readonly channel = 'discord' as const;

  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log(
      'Discord provider module initialized - checking for active platforms...',
    );

    try {
      // Query for all active Discord platforms
      const activePlatforms = await this.prisma.projectPlatform.findMany({
        where: {
          platform: 'discord',
          isActive: true,
        },
        include: {
          project: {
            select: {
              id: true,
              slug: true,
            },
          },
        },
      });

      this.logger.log(
        `Found ${activePlatforms.length} active Discord platforms to initialize`,
      );

      // Connect all active Discord platforms
      const connectionPromises = activePlatforms.map(async (platform) => {
        const connectionKey = `${platform.projectId}:${platform.id}`;

        try {
          // Decrypt credentials
          const credentials = JSON.parse(
            CryptoUtil.decrypt(platform.credentialsEncrypted),
          );

          await this.createAdapter(connectionKey, credentials);
          this.logger.log(
            `Discord bot auto-connected for project ${platform.project.slug} (${connectionKey})`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to auto-connect Discord bot for ${connectionKey}: ${error.message}`,
          );
        }
      });

      // Connect all platforms in parallel
      await Promise.allSettled(connectionPromises);

      this.logger.log(`Discord provider startup initialization completed`);
    } catch (error) {
      this.logger.error(
        `Failed to initialize Discord platforms on startup: ${error.message}`,
      );
    }
  }

  async initialize(): Promise<void> {
    this.logger.log('Discord provider initialized');
  }

  async onPlatformEvent(event: PlatformLifecycleEvent): Promise<void> {
    this.logger.log(
      `Discord platform event: ${event.type} for ${event.projectId}:${event.platformId}`,
    );

    const connectionKey = `${event.projectId}:${event.platformId}`;

    if (event.type === 'created' || event.type === 'activated') {
      // Auto-connect Discord bot when platform is created or activated
      try {
        await this.createAdapter(connectionKey, event.credentials);
        this.logger.log(`Discord bot auto-connected for ${connectionKey}`);
      } catch (error) {
        this.logger.error(
          `Failed to auto-connect Discord bot for ${connectionKey}: ${error.message}`,
        );
      }
    } else if (event.type === 'updated') {
      // Reconnect with new credentials if they changed
      try {
        if (this.connections.has(connectionKey)) {
          await this.removeAdapter(connectionKey);
        }
        await this.createAdapter(connectionKey, event.credentials);
        this.logger.log(`Discord bot reconnected for ${connectionKey}`);
      } catch (error) {
        this.logger.error(
          `Failed to reconnect Discord bot for ${connectionKey}: ${error.message}`,
        );
      }
    } else if (event.type === 'deactivated' || event.type === 'deleted') {
      // Disconnect Discord bot when platform is deactivated or deleted
      try {
        await this.removeAdapter(connectionKey);
        this.logger.log(`Discord bot disconnected for ${connectionKey}`);
      } catch (error) {
        this.logger.error(
          `Failed to disconnect Discord bot for ${connectionKey}: ${error.message}`,
        );
      }
    }
  }

  async shutdown(): Promise<void> {
    this.logger.log('Shutting down Discord provider...');

    const promises: Promise<void>[] = [];
    for (const projectId of this.connections.keys()) {
      promises.push(this.removeAdapter(projectId));
    }

    await Promise.all(promises);
    this.logger.log('Discord provider shut down');
  }

  async createAdapter(
    connectionKey: string,
    credentials: any,
  ): Promise<PlatformAdapter> {
    const existingConnection = this.connections.get(connectionKey);

    if (existingConnection) {
      if (existingConnection.token === credentials.token) {
        // Same token, return existing connection
        existingConnection.lastActivity = new Date();
        return this;
      } else {
        // Token changed, recreate connection
        this.logger.log(
          `Token changed for connection ${connectionKey}, recreating`,
        );
        await this.removeAdapter(connectionKey);
      }
    }

    // Check connection limit
    if (this.connections.size >= this.MAX_CONNECTIONS) {
      throw new Error(`Connection limit reached (${this.MAX_CONNECTIONS})`);
    }

    // Create Discord client
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
    });

    // Parse connectionKey to get projectId and platformId
    const [projectId, platformId] = connectionKey.split(':');

    const connection: DiscordConnection = {
      connectionKey,
      projectId,
      platformId,
      client,
      token: credentials.token,
      isConnected: false,
      lastActivity: new Date(),
    };

    // Store connection with composite key
    this.connections.set(connectionKey, connection);

    try {
      // Set up Discord event handlers
      this.setupEventHandlers(connection);

      // Login to Discord with timeout protection
      await Promise.race([
        client.login(credentials.token),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Discord login timeout')), 5000),
        ),
      ]);

      connection.isConnected = true;

      this.logger.log(`Discord connection established for ${connectionKey}`);
      return this; // Provider IS the adapter
    } catch (error) {
      this.logger.error(
        `Failed to create Discord connection for ${connectionKey}: ${error.message}`,
      );

      // Clean up on failure
      this.connections.delete(connectionKey);
      try {
        await client.destroy();
      } catch (destroyError) {
        this.logger.warn(
          `Discord client destroy failed for ${connectionKey}: ${
            destroyError instanceof Error ? destroyError.message : destroyError
          }`,
        );
      }

      throw error;
    }
  }

  getAdapter(connectionKey: string): PlatformAdapter | undefined {
    const connection = this.connections.get(connectionKey);
    return connection ? this : undefined; // Provider IS the adapter
  }

  async removeAdapter(connectionKey: string): Promise<void> {
    const connection = this.connections.get(connectionKey);
    if (!connection) return; // Already removed or never existed

    // Remove from map immediately to prevent concurrent cleanup
    this.connections.delete(connectionKey);

    this.logger.log(`Removing Discord connection for ${connectionKey}`);

    try {
      // Clean up event listeners first (prevents memory leaks)
      if (connection.eventCleanup) {
        connection.eventCleanup();
        this.logger.debug(`Event listeners cleaned up for ${connectionKey}`);
      }

      // Destroy the Discord client
      await connection.client.destroy();
      this.logger.debug(`Discord client destroyed for ${connectionKey}`);
    } catch (error) {
      this.logger.error(
        `Error closing Discord connection for ${connectionKey}: ${error.message}`,
      );
    }
  }

  private setupEventHandlers(connection: DiscordConnection) {
    const { client, projectId } = connection;

    // Store handler functions for proper cleanup
    const onReady = () => {
      connection.isConnected = true;
      this.logger.log(`Discord ready for ${projectId}: ${client.user?.tag}`);
    };

    const onMessageCreate = (message: Message) => {
      // Handle message directly in provider
      this.handleMessage(message, projectId);
      connection.lastActivity = new Date();
    };

    const onInteractionCreate = (interaction: any) => {
      this.eventEmitter.emit('discord.interaction', {
        projectId,
        interaction,
      });
      connection.lastActivity = new Date();
    };

    const onError = (error: Error) => {
      this.logger.error(`Discord error for ${projectId}: ${error.message}`);
    };

    const onDisconnect = () => {
      this.logger.warn(`Discord disconnected for ${projectId}`);
      connection.isConnected = false;
    };

    // Register event listeners
    client.on('clientReady', onReady);
    client.on('messageCreate', onMessageCreate);
    client.on('interactionCreate', onInteractionCreate);
    client.on('error', onError);
    client.on('disconnect', onDisconnect);

    // Store cleanup function to remove ALL listeners
    connection.eventCleanup = () => {
      client.off('clientReady', onReady);
      client.off('messageCreate', onMessageCreate);
      client.off('interactionCreate', onInteractionCreate);
      client.off('error', onError);
      client.off('disconnect', onDisconnect);
    };
  }

  getConnectionStats() {
    return {
      totalConnections: this.connections.size,
      maxConnections: this.MAX_CONNECTIONS,
      connections: Array.from(this.connections.entries()).map(
        ([projectId, conn]) => ({
          projectId,
          isConnected: conn.isConnected,
          lastActivity: conn.lastActivity,
          guilds: conn.client.guilds?.cache.size || 0,
          uptime: conn.client.uptime || 0,
        }),
      ),
    };
  }

  async isHealthy(): Promise<boolean> {
    // Check if at least one connection is active
    for (const connection of this.connections.values()) {
      if (connection.isConnected) {
        return true;
      }
    }

    // If no connections, provider is still healthy (just idle)
    return true;
  }

  // Optional: Clean up inactive connections
  async cleanupInactive(thresholdMs: number = 3600000) {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [projectId, connection] of this.connections) {
      if (
        !connection.isConnected &&
        now - connection.lastActivity.getTime() > thresholdMs
      ) {
        toRemove.push(projectId);
      }
    }

    for (const projectId of toRemove) {
      await this.removeAdapter(projectId);
    }

    if (toRemove.length > 0) {
      this.logger.log(
        `Cleaned up ${toRemove.length} inactive Discord connections`,
      );
    }
  }

  // PlatformAdapter interface methods
  async start(): Promise<void> {
    // Connections are managed in createAdapter
    this.logger.log('Discord provider/adapter started');
  }

  toEnvelope(msg: Message, projectId: string): MessageEnvelopeV1 {
    return makeEnvelope({
      channel: 'discord',
      projectId,
      threadId: msg.channelId,
      user: {
        providerUserId: msg.author.id,
        display: msg.author.username,
      },
      message: {
        text: msg.content,
      },
      provider: {
        eventId: msg.id,
        raw: {
          channelId: msg.channelId,
          guildId: msg.guildId,
        },
      },
    });
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
      return { providerMessageId: 'discord-no-platform-id' };
    }

    const connectionKey = `${env.projectId}:${platformId}`;
    const connection = this.connections.get(connectionKey);

    if (!connection || !connection.client.isReady()) {
      this.logger.warn(
        `Discord client not ready for ${connectionKey}, cannot send message`,
      );
      return { providerMessageId: 'discord-not-ready' };
    }

    try {
      const channelId = reply.threadId ?? env.threadId;
      if (!channelId) {
        throw new Error('No channel ID provided');
      }

      // Validate message content
      const messageText = reply.text?.trim();
      const hasAttachments = reply.attachments && reply.attachments.length > 0;

      if (!messageText && !hasAttachments) {
        this.logger.error(
          `Discord message has no content - reply.text: "${reply.text}", attachments: ${hasAttachments}`,
        );
        throw new Error('Message must have text or attachments');
      }

      this.logger.debug(
        `Sending Discord message to channel ${channelId}: "${messageText}", attachments: ${hasAttachments && reply.attachments ? reply.attachments.length : 0}`,
      );

      const channel = await connection.client.channels.fetch(channelId);
      if (!channel || !('send' in channel)) {
        throw new Error('Invalid channel or channel type');
      }

      // Process attachments if present
      const files: AttachmentBuilder[] = [];
      if (hasAttachments && reply.attachments) {
        for (const attachment of reply.attachments) {
          try {
            let attachmentData: string | Buffer;
            let filename: string;

            // Handle URL-based attachments
            if (attachment.url) {
              await AttachmentUtil.validateAttachmentUrl(attachment.url);
              attachmentData = attachment.url;
              filename =
                attachment.filename ||
                AttachmentUtil.getFilenameFromUrl(attachment.url);
            }
            // Handle base64 data attachments
            else if (attachment.data) {
              AttachmentUtil.validateBase64Data(attachment.data);
              attachmentData = AttachmentUtil.base64ToBuffer(attachment.data);
              filename = attachment.filename || 'file';
            } else {
              this.logger.warn('Attachment has no url or data, skipping');
              continue;
            }

            const discordAttachment = new AttachmentBuilder(attachmentData, {
              name: filename,
            });
            files.push(discordAttachment);
          } catch (error) {
            this.logger.error(`Failed to process attachment: ${error.message}`);
            // Continue with other attachments
          }
        }
      }

      // Send message with text and/or attachments
      const sent = await (channel as any).send({
        content: messageText || undefined,
        files: files.length > 0 ? files : undefined,
      });

      this.logger.log(
        `Discord message sent successfully to ${channelId}: ${sent.id} (${files.length} attachments)`,
      );
      return { providerMessageId: sent.id };
    } catch (error) {
      this.logger.error(
        `Failed to send Discord message to ${env.threadId}:`,
        error.message,
      );
      return { providerMessageId: 'discord-send-failed' };
    }
  }

  private async handleMessage(msg: Message, projectId: string) {
    if (msg.author.bot) return;

    // Find the platform ID for this connection
    const connection = Array.from(this.connections.values()).find(
      (conn) => conn.projectId === projectId,
    );

    if (!connection) {
      this.logger.error(`No Discord connection found for project ${projectId}`);
      return;
    }

    try {
      // Store message in database
      const storedMessage = await this.prisma.receivedMessage.create({
        data: {
          projectId,
          platformId: connection.platformId,
          platform: 'discord',
          providerMessageId: msg.id,
          providerChatId: msg.channelId,
          providerUserId: msg.author.id,
          userDisplay: msg.author.displayName || msg.author.username,
          messageText: msg.content,
          messageType: 'text',
          rawData: {
            id: msg.id,
            channelId: msg.channelId,
            guildId: msg.guildId,
            author: {
              id: msg.author.id,
              username: msg.author.username,
              displayName: msg.author.displayName,
              discriminator: msg.author.discriminator,
            },
            content: msg.content,
            timestamp: msg.createdTimestamp,
            attachments: msg.attachments.map((att) => ({
              id: att.id,
              url: att.url,
              name: att.name,
              size: att.size,
            })),
          },
        },
      });

      this.logger.debug(
        `Discord message stored: ${storedMessage.id} from ${msg.author.username}`,
      );
    } catch (error) {
      this.logger.error(`Failed to store Discord message: ${error.message}`);
    }

    // Also publish to EventBus for real-time processing
    const env = this.toEnvelope(msg, projectId);
    await this.eventBus.publish(env);
  }
}
