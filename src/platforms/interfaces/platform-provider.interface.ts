import { MessageEnvelopeV1 } from './message-envelope.interface';
import { PlatformAdapter } from './platform-adapter.interface';

export interface WebhookConfig {
  path: string; // e.g., 'telegram/:webhookToken'
  handler: (params: any, body: any, headers: any) => Promise<any>;
}

export interface PlatformLifecycleEvent {
  type: 'created' | 'updated' | 'activated' | 'deactivated' | 'deleted';
  projectId: string;
  platformId: string;
  platform: string;
  credentials: any;
  webhookToken?: string;
}

export interface PlatformProvider {
  // Platform metadata
  readonly name: string; // e.g., 'discord', 'telegram'
  readonly displayName: string; // e.g., 'Discord', 'Telegram'
  readonly connectionType: 'websocket' | 'webhook' | 'polling' | 'http';

  // Lifecycle methods
  initialize(): Promise<void>;
  shutdown(): Promise<void>;

  // Adapter management (using composite connectionKey: "projectId:platformId")
  createAdapter(
    connectionKey: string,
    credentials: any,
  ): Promise<PlatformAdapter>;
  getAdapter(connectionKey: string): PlatformAdapter | undefined;
  removeAdapter(connectionKey: string): Promise<void>;

  // Connection management (optional - for platforms that manage connections)
  getConnectionStats?(): any;

  // Webhook configuration (optional - for webhook-based platforms)
  getWebhookConfig?(): WebhookConfig;

  // Health check
  isHealthy(): Promise<boolean>;

  // Platform lifecycle events (optional)
  onPlatformEvent?(event: PlatformLifecycleEvent): Promise<void>;

  // Reactions (optional - for platforms that support reactions)
  sendReaction?(
    connectionKey: string,
    chatId: string,
    messageId: string,
    emoji: string,
    fromMe?: boolean, // For WhatsApp: indicates if message is from us
  ): Promise<void>;

  unreactFromMessage?(
    connectionKey: string,
    chatId: string,
    messageId: string,
    emoji: string,
    fromMe?: boolean, // For WhatsApp: indicates if message is from us
  ): Promise<void>;
}
