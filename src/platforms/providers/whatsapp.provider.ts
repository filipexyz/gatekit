import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
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
@PlatformProviderDecorator('whatsapp-evo')
export class WhatsAppProvider implements PlatformProvider, PlatformAdapter {
  private readonly logger = new Logger(WhatsAppProvider.name);
  private readonly connections = new Map<string, WhatsAppConnection>();

  readonly name = 'whatsapp-evo';
  readonly displayName = 'WhatsApp (Evolution API)';
  readonly connectionType = 'webhook' as const;
  readonly channel = 'whatsapp-evo' as const;

  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
    private readonly prisma: PrismaService,
    private readonly platformLogsService: PlatformLogsService,
  ) {}

  async initialize(): Promise<void> {
    this.logger.log('WhatsApp provider initialized');
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
      // Delete Evolution API instance
      await this.deleteEvolutionInstance(connection);

      this.logger.debug(`WhatsApp instance deleted for ${connectionKey}`);
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

        if (!platformConfig || platformConfig.platform !== 'whatsapp-evo') {
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
          `Processed WhatsApp webhook for project: ${platformConfig.project.slug}`,
          {
            event: body.event || 'unknown',
            instanceName: body.instance || 'unknown',
          },
        );

        this.logger.log(
          `Processed WhatsApp webhook for project: ${platformConfig.project.slug}`,
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

  private async deleteEvolutionInstance(
    connection: WhatsAppConnection,
  ): Promise<void> {
    try {
      const response = await fetch(
        `${connection.evolutionApiUrl}/instance/delete/${connection.instanceName}`,
        {
          method: 'DELETE',
          headers: {
            apikey: connection.evolutionApiKey,
          },
        },
      );

      if (!response.ok) {
        this.logger.warn(
          `Failed to delete Evolution instance ${connection.instanceName}: ${response.statusText}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Error deleting Evolution instance ${connection.instanceName}: ${error.message}`,
      );
    }
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

      // Store message in database
      if (platformId) {
        try {
          const storedMessage = await this.prisma.receivedMessage.create({
            data: {
              projectId: connection.projectId,
              platformId,
              platform: 'whatsapp-evo',
              providerMessageId: msg.key?.id || msg.id || `evo-${Date.now()}`,
              providerChatId: msg.key?.remoteJid || msg.remoteJid || 'unknown',
              providerUserId:
                msg.sender || msg.key?.remoteJid || msg.remoteJid || 'unknown',
              userDisplay: msg.pushName || msg.senderName || 'WhatsApp User',
              messageText: this.extractEvolutionMessageText(msg),
              messageType: 'text',
              rawData: msg,
            },
          });
          this.logger.debug(
            `Stored WhatsApp message ${storedMessage.id} from ${msg.pushName || 'WhatsApp User'}`,
          );
        } catch (error) {
          if (error.code === 'P2002') {
            this.logger.debug(`Message already stored (duplicate)`);
          } else {
            this.logger.error(`Failed to store message: ${error.message}`);
          }
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
      channel: 'whatsapp-evo',
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
      channel: 'whatsapp-evo',
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
      text?: string;
      attachments?: any[];
      buttons?: any[];
      embeds?: any[];
      threadId?: string;
      replyTo?: string;
      silent?: boolean;
    },
  ): Promise<{ providerMessageId: string }> {
    const platformId = (env.provider?.raw as any)?.platformId;
    if (!platformId) {
      this.logger.error('No platformId in envelope, cannot route message');
      return { providerMessageId: 'whatsapp-evo-no-platform-id' };
    }

    const connectionKey = `${env.projectId}:${platformId}`;
    const connection = this.connections.get(connectionKey);

    if (!connection || !connection.isConnected) {
      this.logger.warn(
        `WhatsApp not connected for ${connectionKey}, cannot send message`,
      );
      return { providerMessageId: 'whatsapp-evo-not-connected' };
    }

    try {
      const chatId = reply.threadId ?? env.threadId;
      if (!chatId) {
        throw new Error('No chat ID provided');
      }

      const payload = {
        number: chatId,
        text: reply.text || '',
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
      const messageId = result.key?.id || 'unknown';

      const platformLogger = this.createPlatformLogger(
        env.projectId,
        platformId,
      );
      platformLogger.logMessage(`Message sent successfully to ${chatId}`, {
        messageId,
        chatId,
        messageLength: reply.text?.length || 0,
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
      return { providerMessageId: 'whatsapp-evo-send-failed' };
    }
  }
}
