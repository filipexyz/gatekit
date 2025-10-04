import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import {
  PlatformProvider,
  WebhookConfig,
  PlatformLifecycleEvent,
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
import { AttachmentDto, EmbedDto } from '../dto/send-message.dto';
import { PlatformCapability } from '../enums/platform-capability.enum';
import { PlatformType } from '../../common/enums/platform-type.enum';
import { UrlValidationUtil } from '../../common/utils/url-validation.util';
import { WebhookDeliveryService } from '../../webhooks/services/webhook-delivery.service';
import { WebhookEventType } from '../../webhooks/types/webhook-event.types';
import { ProviderUtil } from './provider.util';
import { EmbedTransformerUtil } from '../utils/embed-transformer.util';
import { ReactionType } from '@prisma/client';
import { MessagesService } from '../messages/messages.service';
import { TranscriptionService } from '../../voice/services/transcription.service';

interface WhatsAppCredentials {
  evolutionApiUrl: string;
  evolutionApiKey: string;
  instanceName: string;
}

interface WhatsAppConnection {
  connectionKey: string; // projectId:platformId
  projectId: string;
  platformId: string;
  instanceName: string; // Evolution API instance name
  evolutionApiUrl: string;
  evolutionApiKey: string;
  isConnected: boolean;
  qrCode?: string;
  connectionState: 'close' | 'connecting' | 'open';
  lastActivity: Date;
}

interface EvolutionMessage {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message: {
    conversation?: string;
    extendedTextMessage?: {
      text: string;
    };
  };
  messageTimestamp: string;
  pushName?: string;
}

@Injectable()
@PlatformProviderDecorator(PlatformType.WHATSAPP_EVO, [
  { capability: PlatformCapability.SEND_MESSAGE },
  { capability: PlatformCapability.RECEIVE_MESSAGE },
  {
    capability: PlatformCapability.ATTACHMENTS,
    limitations: 'Depends on Evolution API limits, typically 16MB',
  },
  {
    capability: PlatformCapability.EMBEDS,
    limitations:
      'Max 3000 chars for caption (converted to markdown text + first embed image only)',
  },
  {
    capability: PlatformCapability.REACTIONS,
  },
  {
    capability: PlatformCapability.VOICE_RECEIVE,
  },
])
export class WhatsAppProvider implements PlatformProvider, PlatformAdapter {
  private readonly logger = new Logger(WhatsAppProvider.name);
  private readonly connections = new Map<string, WhatsAppConnection>();

  readonly name = PlatformType.WHATSAPP_EVO;
  readonly displayName = 'WhatsApp (Evolution API)';
  readonly connectionType = 'webhook' as const;
  readonly channel = PlatformType.WHATSAPP_EVO;

  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
    private readonly prisma: PrismaService,
    private readonly platformLogsService: PlatformLogsService,
    private readonly webhookDeliveryService: WebhookDeliveryService,
    private readonly messagesService: MessagesService,
    private readonly transcriptionService: TranscriptionService,
  ) {}

  async initialize(): Promise<void> {
    this.logger.log('WhatsApp provider initialized');
  }

  async onPlatformEvent(event: PlatformLifecycleEvent): Promise<void> {
    this.logger.log(
      `WhatsApp platform event: ${event.type} for ${event.projectId}:${event.platformId}`,
    );

    if (event.type === 'created' || event.type === 'activated') {
      // Automatically set up webhook when platform is created or activated
      await this.setupWebhookForPlatform(event);
    } else if (event.type === 'updated') {
      // Re-setup webhook in case credentials changed
      await this.setupWebhookForPlatform(event);
    } else if (event.type === 'deactivated' || event.type === 'deleted') {
      // Clean up connection if it exists
      const connectionKey = `${event.projectId}:${event.platformId}`;
      await this.removeAdapter(connectionKey);
    }
  }

  private async setupWebhookForPlatform(
    event: PlatformLifecycleEvent,
  ): Promise<void> {
    if (!event.webhookToken) {
      this.logger.warn(
        `No webhook token provided for platform ${event.platformId}`,
      );
      return;
    }

    try {
      const connectionKey = `${event.projectId}:${event.platformId}`;

      // Create a temporary connection object for webhook setup
      const tempConnection: WhatsAppConnection = {
        connectionKey,
        projectId: event.projectId,
        platformId: event.platformId,
        instanceName: 'gatekit', // Use shared instance
        evolutionApiUrl: event.credentials.evolutionApiUrl,
        evolutionApiKey: event.credentials.evolutionApiKey,
        isConnected: false,
        connectionState: 'close',
        lastActivity: new Date(),
      };

      // Set up webhook without creating full adapter
      await this.setupWebhook(tempConnection, event.webhookToken);

      const platformLogger = this.createPlatformLogger(
        event.projectId,
        event.platformId,
      );
      platformLogger.logConnection(
        `WhatsApp webhook automatically configured on platform ${event.type}`,
        {
          connectionKey,
          webhookToken: event.webhookToken,
          evolutionApiUrl: event.credentials.evolutionApiUrl,
        },
      );

      this.logger.log(
        `WhatsApp webhook automatically set up for ${connectionKey} on ${event.type}`,
      );
    } catch (error) {
      const platformLogger = this.createPlatformLogger(
        event.projectId,
        event.platformId,
      );
      platformLogger.errorConnection(
        `Failed to auto-setup WhatsApp webhook on platform ${event.type}`,
        error,
        {
          platformId: event.platformId,
          eventType: event.type,
        },
      );

      this.logger.error(
        `Failed to auto-setup WhatsApp webhook: ${error.message}`,
      );
      // Don't throw - webhook setup failure shouldn't prevent platform creation
    }
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
    this.logger.log('Shutting down WhatsApp provider...');

    const promises: Promise<void>[] = [];
    for (const connectionKey of this.connections.keys()) {
      promises.push(this.removeAdapter(connectionKey));
    }

    await Promise.all(promises);
    this.logger.log('WhatsApp provider shut down');
  }

  async createAdapter(
    connectionKey: string,
    credentials: any,
  ): Promise<PlatformAdapter> {
    const existingConnection = this.connections.get(connectionKey);

    if (existingConnection) {
      return this;
    }

    // Parse connectionKey to get projectId and platformId
    const [projectId, platformId] = connectionKey.split(':');
    const instanceName = `gatekit-${projectId}-${platformId}`;

    const connection: WhatsAppConnection = {
      connectionKey,
      projectId,
      platformId,
      instanceName,
      evolutionApiUrl: credentials.evolutionApiUrl,
      evolutionApiKey: credentials.evolutionApiKey,
      isConnected: false,
      connectionState: 'close',
      lastActivity: new Date(),
    };

    // Store connection
    this.connections.set(connectionKey, connection);

    try {
      // Set up webhook with Evolution API instance
      await this.setupWebhook(connection, credentials.webhookToken);

      // Check current connection status from Evolution API
      await this.refreshConnectionStatus(connection);

      const platformLogger = this.createPlatformLogger(projectId, platformId);
      platformLogger.logConnection(
        `WhatsApp connection created for ${connectionKey}`,
        {
          connectionKey,
          instanceName,
          evolutionApiUrl: credentials.evolutionApiUrl,
        },
      );

      this.logger.log(`WhatsApp connection created for ${connectionKey}`);
      return this;
    } catch (error) {
      const platformLogger = this.createPlatformLogger(projectId, platformId);
      platformLogger.errorConnection(
        `Failed to create WhatsApp connection for ${connectionKey}`,
        error,
        {
          connectionKey,
          instanceName,
        },
      );

      this.logger.error(
        `Failed to create WhatsApp connection for ${connectionKey}: ${error.message}`,
      );
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

    this.logger.log(`Removing WhatsApp connection for ${connectionKey}`);

    try {
      // Note: We don't delete Evolution API instances as they may be shared
      // and contain important chat history. Instance management should be manual.
      this.logger.debug(
        `WhatsApp connection removed for ${connectionKey} (instance preserved)`,
      );
    } catch (error) {
      this.logger.error(
        `Error removing WhatsApp connection for ${connectionKey}: ${error.message}`,
      );
    } finally {
      this.connections.delete(connectionKey);
      this.logger.debug(
        `Connection removed from registry for ${connectionKey}`,
      );
    }
  }

  getWebhookConfig(): WebhookConfig {
    return {
      path: 'whatsapp-evo/:webhookToken',
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

        const platformType = platformConfig?.platform as PlatformType;
        if (!platformConfig || platformType !== PlatformType.WHATSAPP_EVO) {
          throw new NotFoundException('Webhook not found');
        }

        if (!platformConfig.isActive) {
          return { ok: false, error: 'Platform disabled' };
        }

        // Process the webhook update
        await this.processEvolutionWebhook(
          platformConfig.projectId,
          body,
          platformConfig.id,
        );

        const platformLogger = this.createPlatformLogger(
          platformConfig.projectId,
          platformConfig.id,
        );
        platformLogger.logWebhook(
          `Processed WhatsApp webhook for project: ${platformConfig.project.id}`,
          {
            event: body.event || 'unknown',
            instanceName: body.instance || 'unknown',
          },
        );

        this.logger.log(
          `Processed WhatsApp webhook for project: ${platformConfig.project.id}`,
        );
        return { ok: true };
      },
    };
  }

  async isHealthy(): Promise<boolean> {
    // Check if we have any active connections
    for (const connection of this.connections.values()) {
      if (connection.isConnected) {
        return true;
      }
    }
    return true; // Provider is healthy even without connections
  }

  getConnectionStats() {
    return {
      totalConnections: this.connections.size,
      connections: Array.from(this.connections.entries()).map(
        ([connectionKey, conn]) => ({
          connectionKey,
          instanceName: conn.instanceName,
          isConnected: conn.isConnected,
          connectionState: conn.connectionState,
          lastActivity: conn.lastActivity,
        }),
      ),
    };
  }

  // Get QR code for connection
  async getQRCode(connectionKey: string): Promise<string | null> {
    const connection = this.connections.get(connectionKey);
    return connection?.qrCode || null;
  }

  // Evolution API methods
  private async refreshConnectionStatus(
    connection: WhatsAppConnection,
  ): Promise<void> {
    try {
      const response = await fetch(
        `${connection.evolutionApiUrl}/instance/fetchInstances`,
        {
          method: 'GET',
          headers: {
            apikey: connection.evolutionApiKey,
          },
        },
      );

      if (!response.ok) {
        this.logger.warn(
          `Failed to fetch instance status: ${response.statusText}`,
        );
        return;
      }

      const instances = await response.json();
      const instance = instances.find(
        (inst: any) => inst.name === connection.instanceName,
      );

      if (instance) {
        connection.connectionState = instance.connectionStatus || 'close';
        connection.isConnected = instance.connectionStatus === 'open';
        this.logger.log(
          `Updated connection status for ${connection.connectionKey}: ${connection.connectionState}`,
        );
      } else {
        this.logger.warn(
          `Instance ${connection.instanceName} not found in Evolution API`,
        );
      }
    } catch (error) {
      this.logger.warn(`Failed to refresh connection status: ${error.message}`);
    }
  }

  private async setupWebhook(
    connection: WhatsAppConnection,
    webhookToken: string,
  ): Promise<void> {
    // Use existing "gatekit" instance instead of creating new ones
    connection.instanceName = 'gatekit';

    const baseUrl = process.env.API_BASE_URL || 'https://api.gatekit.dev';
    const webhookUrl = `${baseUrl}/api/v1/webhooks/whatsapp-evo/${webhookToken}`;

    const payload = {
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        events: [
          'QRCODE_UPDATED',
          'CONNECTION_UPDATE',
          'MESSAGES_UPSERT',
          'SEND_MESSAGE',
        ],
      },
    };

    const response = await fetch(
      `${connection.evolutionApiUrl}/webhook/set/${connection.instanceName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: connection.evolutionApiKey,
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to setup webhook: ${error}`);
    }

    this.logger.log(
      `Evolution API webhook configured for instance: ${connection.instanceName}`,
    );
  }

  private async processEvolutionWebhook(
    projectId: string,
    body: any,
    platformId?: string,
  ): Promise<void> {
    this.logger.debug(
      `Processing Evolution API webhook: ${body.event} for project ${projectId}`,
    );

    const connectionKey = platformId ? `${projectId}:${platformId}` : projectId;
    let connection = this.connections.get(connectionKey);

    // Auto-create connection if needed
    if (!connection && platformId) {
      this.logger.log(
        `Auto-creating WhatsApp connection for incoming webhook - project: ${projectId}`,
      );

      try {
        const platformConfig = await this.prisma.projectPlatform.findUnique({
          where: { id: platformId },
        });

        if (platformConfig && platformConfig.isActive) {
          const credentials = JSON.parse(
            CryptoUtil.decrypt(platformConfig.credentialsEncrypted),
          );
          await this.createAdapter(connectionKey, {
            ...credentials,
            webhookToken: platformConfig.webhookToken,
          });
          connection = this.connections.get(connectionKey);
          this.logger.log(
            `✅ Auto-created WhatsApp connection for webhook processing`,
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
      return;
    }

    // Handle different webhook events
    switch (body.event) {
      case 'qrcode.updated':
        await this.handleQRCodeUpdate(connection, body);
        break;
      case 'connection.update':
        await this.handleConnectionUpdate(connection, body);
        break;
      case 'messages.upsert':
        await this.handleMessageUpsert(connection, body, platformId);
        break;
      case 'send.message':
        this.logger.debug(
          `Message sent confirmation for ${connection.instanceName}`,
        );
        break;
      default:
        this.logger.warn(
          `Unknown webhook event: ${body.event} for ${connection.instanceName}`,
        );
    }
  }

  private async handleQRCodeUpdate(
    connection: WhatsAppConnection,
    body: any,
  ): Promise<void> {
    const qrCode = body.data?.qrcode || body.qrcode;
    connection.qrCode = qrCode;
    this.logger.log(`QR code updated for instance ${connection.instanceName}`);
  }

  private async handleConnectionUpdate(
    connection: WhatsAppConnection,
    body: any,
  ): Promise<void> {
    const state = body.data?.state || body.state;
    connection.connectionState = state;
    connection.isConnected = state === 'open';
    connection.lastActivity = new Date();

    this.logger.log(
      `Connection state updated for ${connection.instanceName}: ${state}`,
    );
  }

  private async handleMessageUpsert(
    connection: WhatsAppConnection,
    body: any,
    platformId?: string,
  ): Promise<void> {
    // Evolution API sends messages in different formats - extract them properly
    let messages: any[] = [];

    // Evolution API structure has message data in various locations
    if (body.remoteJid && body.sender) {
      // Evolution API's flat message format
      messages = [body];
    } else if (body.data?.messages) {
      messages = body.data.messages;
    } else if (body.messages) {
      messages = body.messages;
    } else if (body.data && typeof body.data === 'object') {
      // Single message in body.data
      if (body.data.key || body.data.message || body.data.remoteJid) {
        messages = [body.data];
      }
    } else if (body.key) {
      // Direct message format
      messages = [body];
    }

    if (messages.length === 0) {
      this.logger.warn(`No messages found in Evolution API webhook payload`);
      return;
    }

    this.logger.debug(
      `Processing ${messages.length} messages from Evolution API`,
    );

    for (const msg of messages) {
      if (msg.key?.fromMe) {
        continue; // Skip own messages
      }

      // Check if this is a reaction message (Evolution API sends reactions in messages.upsert)
      if (msg.message?.reactionMessage && platformId) {
        const reaction = msg.message.reactionMessage;
        const reactionKey = reaction.key;

        // Extract user info
        const userId = msg.key?.participant || msg.key?.remoteJid || 'unknown';
        const chatId =
          msg.key?.remoteJid || reactionKey?.remoteJid || 'unknown';
        const userDisplay = msg.pushName || userId;

        // Determine if it's add or remove (empty text means remove)
        const isRemove = !reaction.text || reaction.text === '';

        // Get the emoji - for removals, look up the last added reaction
        // NOTE: WhatsApp only allows one reaction per user per message (unlike Discord/Telegram).
        // When a user changes their reaction, WhatsApp automatically removes the previous one.
        // Evolution API sends removal events without emoji data, so we look up the last added reaction.
        let emoji = reaction.text;
        if (isRemove) {
          // Find the most recent "added" reaction by this user on this message
          const lastReaction = await this.prisma.receivedReaction.findFirst({
            where: {
              projectId: connection.projectId,
              providerMessageId: reactionKey.id,
              providerUserId: userId,
              reactionType: 'added',
            },
            orderBy: {
              receivedAt: 'desc',
            },
          });
          emoji = lastReaction?.emoji;
        }

        if (!emoji) {
          throw new Error(
            `Missing emoji in WhatsApp reaction event - ${isRemove ? 'no previous reaction found for removal' : 'add event missing emoji'}`,
          );
        }

        try {
          const success = await this.messagesService.storeIncomingReaction({
            projectId: connection.projectId,
            platformId,
            platform: PlatformType.WHATSAPP_EVO,
            providerMessageId: reactionKey.id,
            providerChatId: chatId,
            providerUserId: userId,
            userDisplay,
            emoji,
            reactionType: isRemove ? ReactionType.removed : ReactionType.added,
            rawData: msg,
          });

          if (success) {
            this.logger.debug(
              `WhatsApp reaction ${isRemove ? 'removed' : 'added'}: ${emoji} by ${userDisplay}`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Failed to handle WhatsApp reaction ${isRemove ? 'remove' : 'add'}: ${error.message}`,
          );
        }

        continue; // Skip to next message - this was a reaction, not a text message
      }

      // Store message in database using centralized service
      if (platformId) {
        try {
          let messageType = 'text';
          let messageText = this.extractEvolutionMessageText(msg);
          let transcription: string | undefined;

          // Detect voice messages (Evolution API: audioMessage or ptt)
          if (msg.message?.audioMessage || msg.message?.ptt) {
            messageType = 'voice';
            const audioMsg = msg.message.audioMessage || msg.message.ptt;

            this.logger.log(
              `🎙️ Voice message detected from ${msg.pushName || msg.senderName}: ${audioMsg.url || 'no URL'}`,
            );

            try {
              // Download and transcribe voice message
              const mediaBuffer = await this.getMediaUrl(
                connection,
                msg.key?.id || msg.id,
              );

              if (mediaBuffer) {
                const transcriptResult =
                  await this.transcriptionService.transcribe(mediaBuffer, {
                    projectId: connection.projectId,
                    format: 'ogg', // WhatsApp typically uses ogg/opus
                  });
                transcription = transcriptResult.text;
                messageText = `🎙️ Voice: ${transcription}`;

                this.logger.log(
                  `✅ Transcribed: "${transcription.substring(0, 100)}..."`,
                );
              } else {
                this.logger.warn(
                  'Could not get media buffer for voice message',
                );
                messageText = '🎙️ Voice message (no media available)';
              }
            } catch (error) {
              this.logger.error(
                `❌ Voice transcription failed: ${error.message}`,
              );
              messageText = `🎙️ Voice message (transcription failed: ${error.message})`;
            }
          }

          await this.messagesService.storeIncomingMessage({
            projectId: connection.projectId,
            platformId,
            platform: PlatformType.WHATSAPP_EVO,
            providerMessageId: msg.key?.id || msg.id || `evo-${Date.now()}`,
            providerChatId: msg.key?.remoteJid || msg.remoteJid || 'unknown',
            providerUserId:
              msg.sender || msg.key?.remoteJid || msg.remoteJid || 'unknown',
            userDisplay: msg.pushName || msg.senderName || 'WhatsApp User',
            messageText,
            messageType,
            rawData: {
              ...msg,
              transcription: transcription || undefined,
            },
          });
        } catch (error) {
          this.logger.error(`Failed to store message: ${error.message}`);
        }
      }

      // Convert to envelope and publish
      const envelope = this.toEvolutionEnvelope(msg, connection.projectId);
      await this.eventBus.publish(envelope);
    }
  }

  private extractMessageText(msg: EvolutionMessage): string {
    return (
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      '[Media message]'
    );
  }

  private extractEvolutionMessageText(msg: any): string {
    // Handle Evolution API's various message formats
    if (msg.message?.conversation) {
      return msg.message.conversation;
    }
    if (msg.message?.extendedTextMessage?.text) {
      return msg.message.extendedTextMessage.text;
    }
    if (msg.conversation) {
      return msg.conversation;
    }
    if (msg.text) {
      return msg.text;
    }
    if (msg.body) {
      return msg.body;
    }
    return '[Media message]';
  }

  private toEnvelopeWithProject(
    msg: EvolutionMessage,
    projectId: string,
  ): MessageEnvelopeV1 {
    return makeEnvelope({
      channel: PlatformType.WHATSAPP_EVO,
      projectId,
      threadId: msg.key.remoteJid,
      user: {
        providerUserId: msg.key.remoteJid,
        display: (msg as any).pushName || 'WhatsApp User',
      },
      message: {
        text: this.extractMessageText(msg),
      },
      provider: {
        eventId: msg.key.id,
        raw: msg,
      },
    });
  }

  private toEvolutionEnvelope(msg: any, projectId: string): MessageEnvelopeV1 {
    return makeEnvelope({
      channel: PlatformType.WHATSAPP_EVO,
      projectId,
      threadId: msg.key?.remoteJid || msg.remoteJid || 'unknown',
      user: {
        providerUserId:
          msg.sender || msg.key?.remoteJid || msg.remoteJid || 'unknown',
        display: msg.pushName || msg.senderName || 'WhatsApp User',
      },
      message: {
        text: this.extractEvolutionMessageText(msg),
      },
      provider: {
        eventId: msg.key?.id || msg.id || `evo-${Date.now()}`,
        raw: msg,
      },
    });
  }

  // PlatformAdapter interface methods
  async start(): Promise<void> {
    this.logger.log('WhatsApp provider/adapter started');
  }

  toEnvelope(msg: EvolutionMessage, projectId: string): MessageEnvelopeV1 {
    return this.toEnvelopeWithProject(msg, projectId);
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
    const platformId = (env.provider?.raw as any)?.platformId;
    if (!platformId) {
      this.logger.error('No platformId in envelope, cannot route message');
      throw new Error('No platformId in envelope, cannot route message');
    }

    const connectionKey = `${env.projectId}:${platformId}`;
    const connection = this.connections.get(connectionKey);

    if (!connection || !connection.isConnected) {
      throw new Error(
        `WhatsApp not connected for ${connectionKey}, cannot send message`,
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

      let messageId: string;
      let finalText = reply.text;

      // Transform embeds to WhatsApp format (markdown text + optional media)
      // Note: WhatsApp doesn't have native embeds, so we convert to markdown text + separate media
      let embedImage: AttachmentDto | undefined;

      if (hasEmbeds && reply.embeds) {
        const embedResults = await Promise.all(
          reply.embeds.map((embed) => this.transformToWhatsAppEmbed(embed)),
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

        // Extract ONLY FIRST embed image (WhatsApp doesn't have native embeds)
        // Platform limitation: Only the first embed image is sent
        // Use AttachmentUtil to detect MIME types from URLs
        const firstEmbedImage = embedResults.find((result) => result.media);

        if (firstEmbedImage?.media) {
          // Use AttachmentUtil for MIME type detection (no blocking HEAD request)
          const mimeType = AttachmentUtil.detectMimeType({
            url: firstEmbedImage.media,
          });
          const filename = AttachmentUtil.getFilenameFromUrl(
            firstEmbedImage.media,
          );

          embedImage = {
            url: firstEmbedImage.media,
            mimeType,
            filename,
          };

          platformLogger.logMessage(
            'Extracted first embed image (platform limitation)',
            { embedImageUrl: firstEmbedImage.media },
          );
        }
      }

      // Combine user attachments + embed image (without mutating reply)
      const allMedia: AttachmentDto[] = [
        ...(reply.attachments || []),
        ...(embedImage ? [embedImage] : []),
      ];

      const hasMedia = allMedia.length > 0;

      // Handle media (attachments + embed images)
      if (hasMedia) {
        // Send first media with caption (including embed text if present), rest without
        messageId = await this.sendAttachment(
          connection,
          chatId,
          allMedia[0],
          finalText,
        );

        // Send additional media items
        for (let i = 1; i < allMedia.length; i++) {
          await this.sendAttachment(
            connection,
            chatId,
            allMedia[i],
            allMedia[i].caption,
          );
        }
      } else {
        // Text-only message (or text with embeds converted to markdown)
        const payload = {
          number: chatId,
          text: finalText || '',
        };

        const response = await fetch(
          `${connection.evolutionApiUrl}/message/sendText/${connection.instanceName}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: connection.evolutionApiKey,
            },
            body: JSON.stringify(payload),
          },
        );

        if (!response.ok) {
          throw new Error(`Evolution API error: ${response.statusText}`);
        }

        const result = await response.json();
        messageId = result.key?.id || 'unknown';
      }

      platformLogger.logMessage(`Message sent successfully to ${chatId}`, {
        messageId,
        chatId,
        messageLength: reply.text?.length || 0,
        mediaCount: allMedia.length,
        userAttachments: reply.attachments?.length || 0,
        embedImages: embedImage ? 1 : 0,
      });

      return { providerMessageId: messageId };
    } catch (error) {
      const platformLogger = this.createPlatformLogger(
        env.projectId,
        platformId,
      );
      platformLogger.errorMessage(
        `Failed to send WhatsApp message to ${reply.threadId ?? env.threadId}`,
        error,
        {
          chatId: reply.threadId ?? env.threadId,
          messageText: reply.text?.substring(0, 100),
        },
      );

      this.logger.error('Failed to send WhatsApp message:', error.message);
      throw error;
    }
  }

  /**
   * Sends a single attachment via WhatsApp Evolution API
   */
  private async sendAttachment(
    connection: WhatsAppConnection,
    chatId: string,
    attachment: AttachmentDto,
    caption?: string,
  ): Promise<string> {
    let media: string;
    let filename: string;

    // Process attachment data
    if (attachment.url) {
      await AttachmentUtil.validateAttachmentUrl(attachment.url);
      media = attachment.url;
      filename =
        attachment.filename ||
        AttachmentUtil.getFilenameFromUrl(attachment.url);
    } else if (attachment.data) {
      AttachmentUtil.validateBase64Data(attachment.data, 16 * 1024 * 1024); // 16MB WhatsApp limit
      // Evolution API expects raw base64 string (not data URI)
      media = AttachmentUtil.extractBase64String(attachment.data);
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
    const messageCaption = attachment.caption || caption || '';

    // Map attachment type to Evolution API mediatype
    let mediatype: string;
    switch (attachmentType) {
      case 'image':
        mediatype = 'image';
        break;
      case 'video':
        mediatype = 'video';
        break;
      case 'audio':
        mediatype = 'audio';
        break;
      default:
        mediatype = 'document';
        break;
    }

    const payload = {
      number: chatId,
      mediatype,
      mimetype: mimeType,
      caption: messageCaption,
      media,
      fileName: filename,
    };

    const response = await fetch(
      `${connection.evolutionApiUrl}/message/sendMedia/${connection.instanceName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: connection.evolutionApiKey,
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Evolution API error: ${response.statusText} - ${errorText}`,
      );
    }

    const result = await response.json();
    return result.key?.id || 'unknown';
  }

  /**
   * Transform universal EmbedDto to WhatsApp markdown format
   * Platform-specific: WhatsApp has minimal formatting, so we convert to markdown text + media
   * Supports graceful degradation for author, url, fields, footer, and timestamp
   * Includes SSRF protection for all URLs and Markdown escaping
   */
  private async transformToWhatsAppEmbed(
    embed: EmbedDto,
  ): Promise<{ text: string; media?: string }> {
    // Use centralized validation utility
    const embedData = await EmbedTransformerUtil.validateAndProcessEmbed(
      embed,
      this.logger,
    );

    const parts: string[] = [];

    // Author (header section)
    if (embedData.author) {
      if (embedData.author.url) {
        parts.push(
          `📬 *${this.escapeMarkdown(embedData.author.name)}*\n${embedData.author.url}`,
        );
      } else {
        parts.push(`📬 *${this.escapeMarkdown(embedData.author.name)}*`);
      }
      parts.push('━━━━━━━━━━━━━━━━━');
    }

    // Title in bold with optional URL
    if (embedData.title) {
      if (embedData.titleUrl) {
        parts.push(
          `*${this.escapeMarkdown(embedData.title)}*\n🔗 ${embedData.titleUrl}`,
        );
      } else {
        parts.push(`*${this.escapeMarkdown(embedData.title)}*`);
      }
    }

    // Description
    if (embedData.description) {
      parts.push(this.escapeMarkdown(embedData.description));
    }

    // Fields (structured data)
    if (embedData.fields.length > 0) {
      parts.push('━━━━━━━━━━━━━━━━━');

      const fieldLines: string[] = [];
      let inlineBuffer: string[] = [];

      for (const field of embedData.fields) {
        const fieldText = `*${this.escapeMarkdown(field.name)}:* ${this.escapeMarkdown(field.value)}`;

        if (field.inline) {
          inlineBuffer.push(fieldText);

          // WhatsApp doesn't have real inline, so we group inline fields on same line (max 2)
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
    if (embedData.footer || embedData.timestamp) {
      parts.push('━━━━━━━━━━━━━━━━━');

      if (embedData.timestamp) {
        const formattedDate = embedData.timestamp.toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        parts.push(`⏰ ${formattedDate}`);
      }

      if (embedData.footer) {
        parts.push(`💡 ${this.escapeMarkdown(embedData.footer.text)}`);
      }
    }

    const text = parts.join('\n\n');
    const media = embedData.imageUrl || embedData.thumbnailUrl;

    this.logger.debug(
      `Transformed embed to WhatsApp format: ${embedData.title || 'Untitled'}, media: ${!!media}`,
    );

    return { text, media };
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
   * Escape Markdown special characters for WhatsApp
   * Prevents formatting injection by escaping: * _ ` ~ \
   */
  private escapeMarkdown(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\*/g, '\\*')
      .replace(/_/g, '\\_')
      .replace(/`/g, '\\`')
      .replace(/~/g, '\\~');
  }

  /**
   * Send a reaction to a message on WhatsApp (Evolution API)
   */
  async sendReaction(
    connectionKey: string,
    remoteJid: string,
    messageId: string,
    emoji: string,
    fromMe: boolean = false,
  ): Promise<void> {
    // Get credentials using shared utility (no connection check needed - HTTP API)
    const { platformId, credentials } =
      await ProviderUtil.getPlatformCredentials<WhatsAppCredentials>(
        connectionKey,
        this.prisma,
        'WhatsApp',
      );

    const { evolutionApiUrl, evolutionApiKey, instanceName } = credentials;

    if (!evolutionApiUrl || !evolutionApiKey || !instanceName) {
      throw new Error(`WhatsApp credentials incomplete for ${platformId}`);
    }

    try {
      const url = `${evolutionApiUrl}/message/sendReaction/${instanceName}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: evolutionApiKey,
        },
        body: JSON.stringify({
          key: {
            remoteJid,
            fromMe,
            id: messageId,
          },
          reaction: emoji,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(
          `Evolution API reaction error: ${response.status} - ${error}`,
        );
      }

      // Validate response body
      const result = await response.json();
      if (result.error || (result.status !== undefined && !result.status)) {
        throw new Error(
          `Evolution API reaction failed: ${result.message || result.error || 'Unknown error'}`,
        );
      }

      this.logger.debug(
        `WhatsApp reaction sent: ${emoji} to message ${messageId} (fromMe: ${fromMe})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send WhatsApp reaction [${connectionKey}]: ${error.message}`,
      );
      throw error;
    }
  }

  async unreactFromMessage(
    connectionKey: string,
    remoteJid: string,
    messageId: string,
    emoji: string,
    fromMe: boolean = false,
  ): Promise<void> {
    // Get credentials using shared utility (no connection check needed - HTTP API)
    const { platformId, credentials } =
      await ProviderUtil.getPlatformCredentials<WhatsAppCredentials>(
        connectionKey,
        this.prisma,
        'WhatsApp',
      );

    const { evolutionApiUrl, evolutionApiKey, instanceName } = credentials;

    if (!evolutionApiUrl || !evolutionApiKey || !instanceName) {
      throw new Error(`WhatsApp credentials incomplete for ${platformId}`);
    }

    try {
      const url = `${evolutionApiUrl}/message/sendReaction/${instanceName}`;

      // WhatsApp Evolution API: send empty string to remove reaction
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: evolutionApiKey,
        },
        body: JSON.stringify({
          key: {
            remoteJid,
            fromMe,
            id: messageId,
          },
          reaction: '', // Empty string removes the reaction
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(
          `Evolution API unreact error: ${response.status} - ${error}`,
        );
      }

      // Validate response body
      const result = await response.json();
      if (result.error || (result.status !== undefined && !result.status)) {
        throw new Error(
          `Evolution API unreact failed: ${result.message || result.error || 'Unknown error'}`,
        );
      }

      this.logger.debug(
        `WhatsApp reaction removed: ${emoji} from message ${messageId} (fromMe: ${fromMe})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to remove WhatsApp reaction [${connectionKey}]: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get media buffer from Evolution API for voice message
   */
  private async getMediaUrl(
    connection: WhatsAppConnection,
    messageId: string,
  ): Promise<Buffer | null> {
    try {
      const url = `${connection.evolutionApiUrl}/chat/getBase64FromMediaMessage/${connection.instanceName}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: connection.evolutionApiKey,
        },
        body: JSON.stringify({
          message: {
            key: {
              id: messageId,
            },
          },
          convertToMp4: false,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(
          `Evolution API getBase64FromMediaMessage error: ${response.status} - ${error}`,
        );
        return null;
      }

      const result = await response.json();

      // Evolution API returns base64 data
      if (result.base64) {
        // Convert base64 directly to Buffer (more memory efficient than data URL)
        const audioBuffer = Buffer.from(result.base64, 'base64');

        // Clear base64 string from memory immediately
        result.base64 = null;

        return audioBuffer;
      }

      return null;
    } catch (error) {
      this.logger.error(
        `Failed to get media from Evolution API: ${error.message}`,
      );
      return null;
    }
  }
}
