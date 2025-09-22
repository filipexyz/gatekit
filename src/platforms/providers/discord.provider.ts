import { Injectable, Logger, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Client, GatewayIntentBits, Message } from 'discord.js';
import { PlatformProvider } from '../interfaces/platform-provider.interface';
import { PlatformAdapter } from '../interfaces/platform-adapter.interface';
import type { IEventBus } from '../interfaces/event-bus.interface';
import { EVENT_BUS } from '../interfaces/event-bus.interface';
import { PlatformProviderDecorator } from '../decorators/platform-provider.decorator';
import { MessageEnvelopeV1 } from '../interfaces/message-envelope.interface';
import { makeEnvelope } from '../utils/envelope.factory';

interface DiscordConnection {
  projectId: string;
  client: Client;
  token: string;
  isConnected: boolean;
  lastActivity: Date;
  eventCleanup?: () => void;
}

@Injectable()
@PlatformProviderDecorator('discord')
export class DiscordProvider implements PlatformProvider, PlatformAdapter {
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
  ) {}

  async initialize(): Promise<void> {
    this.logger.log('Discord provider initialized');
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

  async createAdapter(projectId: string, credentials: any): Promise<PlatformAdapter> {
    const existingConnection = this.connections.get(projectId);

    if (existingConnection) {
      if (existingConnection.token === credentials.token) {
        // Same token, return existing connection
        existingConnection.lastActivity = new Date();
        return this;
      } else {
        // Token changed, recreate connection
        this.logger.log(`Token changed for project ${projectId}, recreating connection`);
        await this.removeAdapter(projectId);
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

    const connection: DiscordConnection = {
      projectId,
      client,
      token: credentials.token,
      isConnected: false,
      lastActivity: new Date(),
    };

    // Store connection
    this.connections.set(projectId, connection);

    try {
      // Set up Discord event handlers
      this.setupEventHandlers(connection);

      // Login to Discord
      await client.login(credentials.token);

      connection.isConnected = true;

      this.logger.log(`Discord connection established for project ${projectId}`);
      return this; // Provider IS the adapter
    } catch (error) {
      this.logger.error(`Failed to create Discord connection for ${projectId}: ${error.message}`);

      // Clean up on failure
      this.connections.delete(projectId);
      try {
        await client.destroy();
      } catch {}

      throw error;
    }
  }

  getAdapter(projectId: string): PlatformAdapter | undefined {
    const connection = this.connections.get(projectId);
    return connection ? this : undefined; // Provider IS the adapter
  }

  async removeAdapter(projectId: string): Promise<void> {
    const connection = this.connections.get(projectId);
    if (!connection) return; // Already removed or never existed

    // Remove from map immediately to prevent concurrent cleanup
    this.connections.delete(projectId);

    this.logger.log(`Removing Discord connection for project ${projectId}`);

    try {
      // Clean up event listeners first (prevents memory leaks)
      if (connection.eventCleanup) {
        connection.eventCleanup();
        this.logger.debug(`Event listeners cleaned up for project ${projectId}`);
      }

      // Destroy the Discord client
      await connection.client.destroy();
      this.logger.debug(`Discord client destroyed for project ${projectId}`);
    } catch (error) {
      this.logger.error(`Error closing Discord connection for ${projectId}: ${error.message}`);
    }
  }

  private setupEventHandlers(connection: DiscordConnection) {
    const { client, projectId } = connection;

    // Store handler functions for proper cleanup
    const onReady = () => {
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
    client.on('ready', onReady);
    client.on('messageCreate', onMessageCreate);
    client.on('interactionCreate', onInteractionCreate);
    client.on('error', onError);
    client.on('disconnect', onDisconnect);

    // Store cleanup function to remove ALL listeners
    connection.eventCleanup = () => {
      client.off('ready', onReady);
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
      connections: Array.from(this.connections.entries()).map(([projectId, conn]) => ({
        projectId,
        isConnected: conn.isConnected,
        lastActivity: conn.lastActivity,
        guilds: conn.client.guilds?.cache.size || 0,
        uptime: conn.client.uptime || 0,
      })),
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
      if (!connection.isConnected &&
          now - connection.lastActivity.getTime() > thresholdMs) {
        toRemove.push(projectId);
      }
    }

    for (const projectId of toRemove) {
      await this.removeAdapter(projectId);
    }

    if (toRemove.length > 0) {
      this.logger.log(`Cleaned up ${toRemove.length} inactive Discord connections`);
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
    reply: { text?: string; attachments?: any[]; threadId?: string },
  ): Promise<{ providerMessageId: string }> {
    const connection = this.connections.get(env.projectId);

    if (!connection || !connection.client.isReady()) {
      this.logger.warn('Discord client not ready, cannot send message');
      return { providerMessageId: 'discord-not-ready' };
    }

    try {
      const channelId = reply.threadId ?? env.threadId;
      if (!channelId) {
        throw new Error('No channel ID provided');
      }

      const channel = await connection.client.channels.fetch(channelId);
      if (!channel || !('send' in channel)) {
        throw new Error('Invalid channel or channel type');
      }

      const sent = await (channel as any).send(reply.text ?? '');
      return { providerMessageId: sent.id };
    } catch (error) {
      this.logger.error('Failed to send Discord message:', error.message);
      return { providerMessageId: 'discord-send-failed' };
    }
  }

  private async handleMessage(msg: Message, projectId: string) {
    if (msg.author.bot) return;

    const env = this.toEnvelope(msg, projectId);
    await this.eventBus.publish(env);
  }
}