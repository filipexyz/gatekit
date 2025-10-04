import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  Client,
  GatewayIntentBits,
  Partials,
  Message,
  MessageReaction,
  User,
  AttachmentBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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
import { PlatformCapability } from '../enums/platform-capability.enum';
import { PlatformType } from '../../common/enums/platform-type.enum';
import { UrlValidationUtil } from '../../common/utils/url-validation.util';
import { ProviderUtil } from './provider.util';
import { EmbedTransformerUtil } from '../utils/embed-transformer.util';
import {
  EmbedDto,
  ButtonDto,
  ButtonStyle as GKButtonStyle,
} from '../dto/send-message.dto';
import { WebhookDeliveryService } from '../../webhooks/services/webhook-delivery.service';
import { WebhookEventType } from '../../webhooks/types/webhook-event.types';
import { ReactionType } from '@prisma/client';
import { MessagesService } from '../messages/messages.service';
import { TranscriptionService } from '../../voice/services/transcription.service';

interface DiscordCredentials {
  token: string;
}

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
@PlatformProviderDecorator(PlatformType.DISCORD, [
  { capability: PlatformCapability.SEND_MESSAGE },
  { capability: PlatformCapability.RECEIVE_MESSAGE },
  {
    capability: PlatformCapability.ATTACHMENTS,
    limitations: 'Max 25MB per file, max 10 files per message',
  },
  {
    capability: PlatformCapability.EMBEDS,
    limitations: 'Max 6000 chars total, max 10 embeds per message',
  },
  {
    capability: PlatformCapability.BUTTONS,
    limitations: 'Max 25 buttons per message (5 rows × 5 buttons)',
  },
  {
    capability: PlatformCapability.REACTIONS,
  },
  {
    capability: PlatformCapability.VOICE_RECEIVE,
    limitations: 'Automatically transcribes voice messages',
  },
])
export class DiscordProvider
  implements PlatformProvider, PlatformAdapter, OnModuleInit
{
  private readonly logger = new Logger(DiscordProvider.name);
  private readonly connections = new Map<string, DiscordConnection>();
  private readonly MAX_CONNECTIONS = 100;

  readonly name = PlatformType.DISCORD;
  readonly displayName = 'Discord';
  readonly connectionType = 'websocket' as const;
  readonly channel = PlatformType.DISCORD;

  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
    private readonly webhookDeliveryService: WebhookDeliveryService,
    private readonly messagesService: MessagesService,
    private readonly transcriptionService: TranscriptionService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log(
      'Discord provider module initialized - checking for active platforms...',
    );

    try {
      // Query for all active Discord platforms
      const activePlatforms = await this.prisma.projectPlatform.findMany({
        where: {
          platform: PlatformType.DISCORD,
          isActive: true,
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
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
          const credentials =
            ProviderUtil.decryptPlatformCredentials<DiscordCredentials>(
              platform.credentialsEncrypted,
            );

          await this.createAdapter(connectionKey, credentials);
          this.logger.log(
            `Discord bot auto-connected for project ${platform.project.id} (${connectionKey})`,
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
        GatewayIntentBits.GuildMessageReactions,
      ],
      partials: [Partials.Message, Partials.Channel, Partials.Reaction],
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
      // Handle button interactions asynchronously (fire-and-forget)
      if (interaction.isButton()) {
        // Handle button interaction with webhook delivery
        void this.handleButtonInteraction(
          interaction,
          projectId,
          connection.platformId,
        ).catch((err) => {
          this.logger.error(
            `Error handling button interaction: ${err.message}`,
          );
        });
      }

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

    const onMessageReactionAdd = (reaction: MessageReaction, user: User) => {
      // Handle reaction add asynchronously (fire-and-forget)
      void this.handleReactionAdd(
        reaction,
        user,
        projectId,
        connection.platformId,
      ).catch((err) => {
        this.logger.error(`Error handling reaction add: ${err.message}`);
      });
      connection.lastActivity = new Date();
    };

    const onMessageReactionRemove = (reaction: MessageReaction, user: User) => {
      // Handle reaction remove asynchronously (fire-and-forget)
      void this.handleReactionRemove(
        reaction,
        user,
        projectId,
        connection.platformId,
      ).catch((err) => {
        this.logger.error(`Error handling reaction remove: ${err.message}`);
      });
      connection.lastActivity = new Date();
    };

    // Register event listeners
    client.on('clientReady', onReady);
    client.on('messageCreate', onMessageCreate);
    client.on('interactionCreate', onInteractionCreate);
    client.on('messageReactionAdd', onMessageReactionAdd);
    client.on('messageReactionRemove', onMessageReactionRemove);
    client.on('error', onError);
    client.on('disconnect', onDisconnect);

    // Store cleanup function to remove ALL listeners
    connection.eventCleanup = () => {
      client.off('clientReady', onReady);
      client.off('messageCreate', onMessageCreate);
      client.off('interactionCreate', onInteractionCreate);
      client.off('messageReactionAdd', onMessageReactionAdd);
      client.off('messageReactionRemove', onMessageReactionRemove);
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
      channel: PlatformType.DISCORD,
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
      subject?: string;
      text?: string;
      markdown?: string;
      html?: string;
      attachments?: any[];
      buttons?: any[];
      embeds?: any[];
      platformOptions?: Record<string, any>;
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

    if (!connection || !connection.client.isReady()) {
      throw new Error(
        `Discord client not ready for ${connectionKey}, cannot send message`,
      );
    }

    try {
      const channelId = reply.threadId ?? env.threadId;
      if (!channelId) {
        throw new Error('No channel ID provided');
      }

      // Validate message content
      const messageText = reply.text?.trim();
      const hasAttachments = reply.attachments && reply.attachments.length > 0;
      const hasEmbeds = reply.embeds && reply.embeds.length > 0;

      if (!messageText && !hasAttachments && !hasEmbeds) {
        this.logger.error(
          `Discord message has no content - reply.text: "${reply.text}", attachments: ${hasAttachments}, embeds: ${hasEmbeds}`,
        );
        throw new Error('Message must have text, attachments, or embeds');
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

      // Transform embeds if present (Discord max: 10 embeds per message)
      let discordEmbeds: EmbedBuilder[] | undefined;
      if (reply.embeds && reply.embeds.length > 0) {
        const embedsToSend = reply.embeds.slice(0, 10);

        if (reply.embeds.length > 10) {
          this.logger.warn(
            `Message has ${reply.embeds.length} embeds, Discord limit is 10. Truncating.`,
          );
        }

        discordEmbeds = await Promise.all(
          embedsToSend.map((embed) => this.transformToDiscordEmbed(embed)),
        );
      }

      // Transform buttons if present (Discord max: 25 buttons per message)
      let components: ActionRowBuilder<ButtonBuilder>[] | undefined;
      if (reply.buttons && reply.buttons.length > 0) {
        components = this.transformToDiscordButtons(reply.buttons);
      }

      // Send message with text, attachments, embeds, and/or buttons
      const sent = await (channel as any).send({
        content: messageText || undefined,
        files: files.length > 0 ? files : undefined,
        embeds:
          discordEmbeds && discordEmbeds.length > 0 ? discordEmbeds : undefined,
        components:
          components && components.length > 0 ? components : undefined,
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
      throw error; // Re-throw to propagate error to processor
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

    // Check for voice/audio attachments
    const voiceAttachment = msg.attachments.find(
      (att) =>
        att.contentType?.startsWith('audio/') ||
        /\.(mp3|wav|ogg|opus|webm|m4a|flac)$/i.test(att.name || ''),
    );

    let messageText = msg.content;
    let messageType: 'text' | 'voice' = 'text';
    let transcription: string | undefined;

    // If voice attachment found, transcribe it
    if (voiceAttachment) {
      messageType = 'voice';
      try {
        this.logger.log(
          `🎙️ Voice message detected from ${msg.author.username}: ${voiceAttachment.url}`,
        );

        const transcriptResult = await this.transcriptionService.transcribe(
          voiceAttachment.url,
          {
            format: voiceAttachment.name?.split('.').pop(),
            projectId: connection.projectId,
          },
        );

        transcription = transcriptResult.text;
        messageText = `🎙️ Voice: ${transcription}`;

        this.logger.log(
          `✅ Transcribed: "${transcription.substring(0, 100)}..."`,
        );
      } catch (error) {
        this.logger.error(`❌ Voice transcription failed: ${error.message}`);
        messageText = `🎙️ Voice message (transcription failed: ${error.message})`;
      }
    }

    try {
      // Store message in database using centralized service
      await this.messagesService.storeIncomingMessage({
        projectId,
        platformId: connection.platformId,
        platform: PlatformType.DISCORD,
        providerMessageId: msg.id,
        providerChatId: msg.channelId,
        providerUserId: msg.author.id,
        userDisplay: msg.author.displayName || msg.author.username,
        messageText,
        messageType,
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
            contentType: att.contentType,
          })),
          transcription: transcription || undefined,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to store Discord message: ${error.message}`);
    }

    // Also publish to EventBus for real-time processing
    const env = this.toEnvelope(msg, projectId);
    await this.eventBus.publish(env);
  }

  /**
   * Transform universal EmbedDto to Discord native EmbedBuilder
   * Platform-specific transformation with validation
   */
  private async transformToDiscordEmbed(
    embed: EmbedDto,
  ): Promise<EmbedBuilder> {
    // Use centralized validation utility
    const embedData = await EmbedTransformerUtil.validateAndProcessEmbed(
      embed,
      this.logger,
    );

    const builder = new EmbedBuilder();

    // Set basic properties
    if (embedData.title) {
      builder.setTitle(embedData.title);
    }

    if (embedData.description) {
      builder.setDescription(embedData.description);
    }

    // Parse and set color (supports both hex #FF5733 and decimal 16734003)
    const colorValue = EmbedTransformerUtil.parseDiscordColor(
      embedData.color,
      this.logger,
    );
    if (colorValue !== null) {
      builder.setColor(colorValue);
    }

    // Set validated URLs
    if (embedData.titleUrl) {
      builder.setURL(embedData.titleUrl);
    }

    if (embedData.imageUrl) {
      builder.setImage(embedData.imageUrl);
    }

    if (embedData.thumbnailUrl) {
      builder.setThumbnail(embedData.thumbnailUrl);
    }

    // Set author with validated URLs
    if (embedData.author) {
      const authorOptions: { name: string; url?: string; iconURL?: string } = {
        name: embedData.author.name,
      };

      if (embedData.author.url) {
        authorOptions.url = embedData.author.url;
      }

      if (embedData.author.iconUrl) {
        authorOptions.iconURL = embedData.author.iconUrl;
      }

      builder.setAuthor(authorOptions);
    }

    // Set footer with validated URLs
    if (embedData.footer) {
      const footerOptions: { text: string; iconURL?: string } = {
        text: embedData.footer.text,
      };

      if (embedData.footer.iconUrl) {
        footerOptions.iconURL = embedData.footer.iconUrl;
      }

      builder.setFooter(footerOptions);
    }

    // Set timestamp
    if (embedData.timestamp) {
      builder.setTimestamp(embedData.timestamp);
    }

    // Add fields (Discord limit: 25 fields max)
    if (embedData.fields.length > 0) {
      const fieldsToAdd = embedData.fields.slice(0, 25);

      if (embedData.fields.length > 25) {
        this.logger.warn(
          `Embed has ${embedData.fields.length} fields, Discord limit is 25. Truncating.`,
        );
      }

      builder.addFields(fieldsToAdd);
    }

    this.logger.debug(
      `Transformed embed to Discord format: ${embedData.title || 'Untitled'}`,
    );

    return builder;
  }

  /**
   * Transform universal ButtonDto array to Discord ActionRow components
   * Platform-specific transformation with validation
   */
  private transformToDiscordButtons(
    buttons: ButtonDto[],
  ): ActionRowBuilder<ButtonBuilder>[] {
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    const maxButtons = Math.min(buttons.length, 25); // Discord limit: 25 buttons total

    if (buttons.length > 25) {
      this.logger.warn(
        `Message has ${buttons.length} buttons, Discord limit is 25. Truncating.`,
      );
    }

    // Create rows of up to 5 buttons each
    for (let i = 0; i < maxButtons; i += 5) {
      const row = new ActionRowBuilder<ButtonBuilder>();
      const rowButtons = buttons.slice(i, Math.min(i + 5, maxButtons));

      for (const btn of rowButtons) {
        try {
          const builder = new ButtonBuilder().setLabel(btn.text);

          if (btn.url) {
            // Link button
            builder.setURL(btn.url).setStyle(ButtonStyle.Link);
          } else if (btn.value) {
            // Callback button
            builder
              .setCustomId(btn.value)
              .setStyle(this.mapButtonStyle(btn.style));
          } else {
            this.logger.warn(
              `Button "${btn.text}" has no value or url, skipping`,
            );
            continue;
          }

          row.addComponents(builder);
        } catch (error) {
          this.logger.error(
            `Failed to create button "${btn.text}": ${error.message}`,
          );
        }
      }

      if (row.components.length > 0) {
        rows.push(row);
      }
    }

    this.logger.debug(
      `Transformed ${buttons.length} buttons to ${rows.length} Discord action rows`,
    );

    return rows;
  }

  /**
   * Map universal button style to Discord ButtonStyle
   */
  private mapButtonStyle(style?: GKButtonStyle): ButtonStyle {
    switch (style) {
      case GKButtonStyle.SECONDARY:
        return ButtonStyle.Secondary;
      case GKButtonStyle.SUCCESS:
        return ButtonStyle.Success;
      case GKButtonStyle.DANGER:
        return ButtonStyle.Danger;
      case GKButtonStyle.LINK:
        return ButtonStyle.Link;
      case GKButtonStyle.PRIMARY:
      default:
        return ButtonStyle.Primary;
    }
  }

  /**
   * Handle button interaction and deliver webhook event
   */
  private async handleButtonInteraction(
    interaction: any,
    projectId: string,
    platformId: string,
  ): Promise<void> {
    try {
      // Store button click using centralized service
      await this.messagesService.storeIncomingButtonClick({
        projectId,
        platformId,
        platform: PlatformType.DISCORD,
        providerMessageId: `interaction_${interaction.id}`,
        providerChatId: interaction.channelId,
        providerUserId: interaction.user.id,
        userDisplay: interaction.user.username,
        buttonValue: interaction.customId,
        rawData: {
          id: interaction.id,
          customId: interaction.customId,
          componentType: interaction.componentType,
          channelId: interaction.channelId,
          guildId: interaction.guildId,
          user: {
            id: interaction.user.id,
            username: interaction.user.username,
            discriminator: interaction.user.discriminator,
          },
          message: interaction.message
            ? { id: interaction.message.id }
            : undefined,
        },
      });

      // Acknowledge the interaction to Discord
      await interaction.deferUpdate();
    } catch (error) {
      this.logger.error(
        `Failed to handle button interaction: ${error.message}`,
      );
    }
  }

  /**
   * Helper: Parse Discord emoji format
   * Converts stored format <:name:id> or <a:name:id> to what Discord.js expects
   * Supports emoji names with hyphens, spaces, and special characters
   */
  private parseDiscordEmoji(emoji: string): string {
    // Check if it's a custom emoji in format <:name:id> or <a:name:id>
    // Pattern: <(a)?:([^:]+):(\d+)> - allows any characters in name except colons
    const customEmojiMatch = emoji.match(/^<(a)?:([^:]+):(\d+)>$/);
    if (customEmojiMatch) {
      // Discord.js expects just the emoji ID for custom emojis
      return customEmojiMatch[3]; // ID is now in group 3
    }
    // Unicode emoji - use as-is
    return emoji;
  }

  /**
   * Send a reaction to a message on Discord
   */
  async sendReaction(
    connectionKey: string,
    channelId: string,
    messageId: string,
    emoji: string,
    fromMe?: boolean,
  ): Promise<void> {
    const connection = this.connections.get(connectionKey);

    if (!connection || !connection.client.isReady()) {
      throw new Error(
        `Discord client not ready for ${connectionKey}, cannot send reaction`,
      );
    }

    try {
      const channel = await connection.client.channels.fetch(channelId);

      if (!channel || !channel.isTextBased()) {
        throw new Error(`Channel ${channelId} not found or not a text channel`);
      }

      const message = await channel.messages.fetch(messageId);
      const parsedEmoji = this.parseDiscordEmoji(emoji);
      await message.react(parsedEmoji);

      this.logger.debug(
        `Discord reaction sent: ${emoji} to message ${messageId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send Discord reaction [${connectionKey}]: ${error.message}`,
      );
      throw error;
    }
  }

  async unreactFromMessage(
    connectionKey: string,
    channelId: string,
    messageId: string,
    emoji: string,
    fromMe?: boolean,
  ): Promise<void> {
    const connection = this.connections.get(connectionKey);

    if (!connection || !connection.client.isReady()) {
      throw new Error(
        `Discord client not ready for ${connectionKey}, cannot remove reaction`,
      );
    }

    try {
      const channel = await connection.client.channels.fetch(channelId);

      if (!channel || !channel.isTextBased()) {
        throw new Error(`Channel ${channelId} not found or not a text channel`);
      }

      const message = await channel.messages.fetch(messageId);
      const parsedEmoji = this.parseDiscordEmoji(emoji);
      const reactions = message.reactions.cache.get(parsedEmoji);

      if (reactions) {
        await reactions.users.remove(connection.client.user.id);
        this.logger.debug(
          `Discord reaction removed: ${emoji} from message ${messageId}`,
        );
      } else {
        this.logger.debug(
          `No reaction ${emoji} found on message ${messageId} to remove`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to remove Discord reaction [${connectionKey}]: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Handle reaction added to a message
   */
  private async handleReactionAdd(
    reaction: MessageReaction,
    user: User,
    projectId: string,
    platformId: string,
  ): Promise<void> {
    try {
      if (reaction.partial) await reaction.fetch();
      if (user.bot) return;

      const emoji = reaction.emoji.id
        ? `<:${reaction.emoji.name}:${reaction.emoji.id}>`
        : reaction.emoji.name;

      if (!emoji) throw new Error(`Missing emoji in Discord reaction event`);

      const success = await this.messagesService.storeIncomingReaction({
        projectId,
        platformId,
        platform: PlatformType.DISCORD,
        providerMessageId: reaction.message.id,
        providerChatId: reaction.message.channelId,
        providerUserId: user.id,
        userDisplay: user.username,
        emoji,
        reactionType: ReactionType.added,
        rawData: {
          message_id: reaction.message.id,
          emoji: {
            id: reaction.emoji.id,
            name: reaction.emoji.name,
            animated: reaction.emoji.animated,
          },
          user: {
            id: user.id,
            username: user.username,
            discriminator: user.discriminator,
          },
        },
      });

      if (success) {
        this.logger.debug(
          `Discord reaction added: ${emoji} by ${user.username}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle Discord reaction add: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Handle reaction removed from a message
   */
  private async handleReactionRemove(
    reaction: MessageReaction,
    user: User,
    projectId: string,
    platformId: string,
  ): Promise<void> {
    try {
      if (reaction.partial) await reaction.fetch();
      if (user.bot) return;

      const emoji = reaction.emoji.id
        ? `<:${reaction.emoji.name}:${reaction.emoji.id}>`
        : reaction.emoji.name;

      if (!emoji) throw new Error(`Missing emoji in Discord reaction event`);

      const success = await this.messagesService.storeIncomingReaction({
        projectId,
        platformId,
        platform: PlatformType.DISCORD,
        providerMessageId: reaction.message.id,
        providerChatId: reaction.message.channelId,
        providerUserId: user.id,
        userDisplay: user.username,
        emoji,
        reactionType: ReactionType.removed,
        rawData: {
          message_id: reaction.message.id,
          emoji: {
            id: reaction.emoji.id,
            name: reaction.emoji.name,
            animated: reaction.emoji.animated,
          },
          user: {
            id: user.id,
            username: user.username,
            discriminator: user.discriminator,
          },
        },
      });

      if (success) {
        this.logger.debug(
          `Discord reaction removed: ${emoji} by ${user.username}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle Discord reaction remove: ${error.message}`,
      );
      throw error;
    }
  }
}
