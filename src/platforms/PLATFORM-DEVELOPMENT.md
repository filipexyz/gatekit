# Platform Development Guide

## Adding New Platforms to GateKit

GateKit uses a dynamic, plugin-based architecture that makes adding new messaging platforms extremely simple. Each platform is completely self-contained in a single provider class.

## Quick Start: Adding a New Platform

### 1. Create Platform Provider

Create a new file: `src/platforms/providers/{platform}.provider.ts`

```typescript
import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  PlatformProvider,
  WebhookConfig,
} from '../interfaces/platform-provider.interface';
import { PlatformAdapter } from '../interfaces/platform-adapter.interface';
import { MessageEnvelopeV1 } from '../interfaces/message-envelope.interface';
import { EVENT_BUS, type IEventBus } from '../interfaces/event-bus.interface';
import { PlatformProviderDecorator } from '../decorators/platform-provider.decorator';
import { makeEnvelope } from '../utils/envelope.factory';

@Injectable()
@PlatformProviderDecorator('your-platform') // Auto-registers platform
export class YourPlatformProvider implements PlatformProvider, PlatformAdapter {
  private readonly logger = new Logger(YourPlatformProvider.name);
  private readonly connections = new Map<string, any>();

  // Platform metadata
  readonly name = 'your-platform';
  readonly displayName = 'Your Platform';
  readonly connectionType = 'webhook' as const; // or 'websocket' | 'polling' | 'http'
  readonly channel = 'your-platform' as const;

  constructor(@Inject(EVENT_BUS) private readonly eventBus: IEventBus) {}

  // Platform Provider methods
  async initialize(): Promise<void> {
    this.logger.log('Your platform provider initialized');
  }

  async shutdown(): Promise<void> {
    // Clean up all connections
    const promises: Promise<void>[] = [];
    for (const projectId of this.connections.keys()) {
      promises.push(this.removeAdapter(projectId));
    }
    await Promise.all(promises);
  }

  async createAdapter(
    projectId: string,
    credentials: any,
  ): Promise<PlatformAdapter> {
    // Create platform-specific connection/client
    // Store connection info
    // Return this as the adapter
    return this;
  }

  getAdapter(projectId: string): PlatformAdapter | undefined {
    const connection = this.connections.get(projectId);
    return connection ? this : undefined;
  }

  async removeAdapter(projectId: string): Promise<void> {
    // Clean up platform-specific resources
    this.connections.delete(projectId);
  }

  async isHealthy(): Promise<boolean> {
    // Platform-specific health check
    return true;
  }

  // Platform Adapter methods
  async start(): Promise<void> {
    this.logger.log('Platform adapter started');
  }

  toEnvelope(msg: any, projectId?: string): MessageEnvelopeV1 {
    return makeEnvelope({
      channel: 'your-platform',
      projectId: projectId || '',
      threadId: msg.conversationId,
      user: {
        providerUserId: msg.userId,
        display: msg.userName,
      },
      message: {
        text: msg.content,
      },
      provider: {
        eventId: msg.id,
        raw: msg,
      },
    });
  }

  async sendMessage(
    env: MessageEnvelopeV1,
    reply: { text?: string; attachments?: any[]; threadId?: string },
  ): Promise<{ providerMessageId: string }> {
    const connection = this.connections.get(env.projectId);

    if (!connection) {
      return { providerMessageId: 'platform-not-ready' };
    }

    try {
      // Platform-specific message sending logic
      const result = await connection.client.send(reply.text);
      return { providerMessageId: result.id };
    } catch (error) {
      this.logger.error('Failed to send message:', error.message);
      return { providerMessageId: 'send-failed' };
    }
  }

  // Optional: For webhook-based platforms
  getWebhookConfig?(): WebhookConfig {
    return {
      path: 'your-platform/:webhookToken',
      handler: async (params, body, headers) => {
        // Webhook validation and processing logic
        return { ok: true };
      },
    };
  }
}
```

### 2. Register in Module

Add to `src/platforms/platforms.module.ts`:

```typescript
// Import your provider
import { YourPlatformProvider } from './providers/your-platform.provider';

@Module({
  providers: [
    // ... existing providers
    YourPlatformProvider, // Add here
  ],
})
export class PlatformsModule {}
```

### 3. That's It!

Your platform is now:

- ✅ Auto-discovered and registered
- ✅ Available in `/api/v1/platforms/supported`
- ✅ Usable for message sending via `/api/v1/projects/:id/messages/send`
- ✅ Health monitored via `/api/v1/platforms/health`
- ✅ Webhook-enabled (if configured) via `/api/v1/webhooks/your-platform/:token`

## Connection Strategies

### WebSocket Platforms (like Discord)

```typescript
readonly connectionType = 'websocket' as const;

async createAdapter(projectId: string, credentials: any) {
  // Create WebSocket client
  const client = new YourPlatformClient();

  // Set up event handlers
  client.on('message', (msg) => {
    this.handleMessage(msg, projectId);
  });

  // Connect
  await client.connect(credentials.token);

  // Store connection
  this.connections.set(projectId, { client, projectId });

  return this;
}
```

### Webhook Platforms (like Telegram)

```typescript
readonly connectionType = 'webhook' as const;

getWebhookConfig(): WebhookConfig {
  return {
    path: 'your-platform/:webhookToken',
    handler: async (params, body, headers) => {
      // 1. Validate webhook token (must be UUID)
      // 2. Find project by webhook token
      // 3. Process webhook update
      await this.processWebhookUpdate(projectId, body);
      return { ok: true };
    },
  };
}
```

### Polling Platforms

```typescript
readonly connectionType = 'polling' as const;

async createAdapter(projectId: string, credentials: any) {
  // Set up polling interval
  const pollInterval = setInterval(async () => {
    const messages = await this.fetchNewMessages(credentials);
    for (const msg of messages) {
      await this.handleMessage(msg, projectId);
    }
  }, 5000);

  this.connections.set(projectId, { pollInterval, projectId });
  return this;
}
```

## Best Practices

### Thread Safety

- **Never use shared state** across projects
- **Always pass projectId** to methods that need it
- **Use connection-specific state** stored in `connections` Map

### Error Handling

- **Always wrap in try/catch** blocks
- **Return fallback message IDs** on errors (e.g., 'platform-not-ready')
- **Log errors with context** (projectId, error details)

### Resource Management

- **Implement proper cleanup** in `removeAdapter()`
- **Handle connection limits** if applicable
- **Clean up on shutdown** in `shutdown()`

### Testing

- **Test thread safety** - concurrent operations across projects
- **Test project isolation** - verify no cross-contamination
- **Test connection management** - reuse, limits, cleanup
- **Mock external clients** - don't make real API calls in tests

## Connection Types

| Type        | Use Case                          | Examples            | Webhook Support  |
| ----------- | --------------------------------- | ------------------- | ---------------- |
| `websocket` | Real-time, persistent connections | Discord, Slack RTM  | No (uses events) |
| `webhook`   | Event-driven, stateless           | Telegram, WhatsApp  | Yes (required)   |
| `polling`   | Simple, stateless polling         | Email, SMS services | No               |
| `http`      | Request/response only             | REST APIs           | No               |

## Platform Capabilities

Each platform provider automatically exposes:

- **Health monitoring** - Available at `/api/v1/platforms/health`
- **Auto-discovery** - Listed in `/api/v1/platforms/supported`
- **Dynamic routing** - Messages routed via platform registry
- **Connection stats** - Via `getConnectionStats()` method
- **Lifecycle management** - Initialize/shutdown hooks

## Example: Real Platform Implementation

See existing implementations:

- **Discord**: `src/platforms/providers/discord.provider.ts` (WebSocket)
- **Telegram**: `src/platforms/providers/telegram.provider.ts` (Webhook)

These serve as complete examples showing:

- Connection management patterns
- Message envelope creation
- Error handling strategies
- Thread-safe operations
- Resource cleanup

## Migration from Legacy

If migrating from old adapter patterns:

1. Move connection logic from separate connection managers into provider
2. Move message logic from separate adapters into provider
3. Implement both `PlatformProvider` and `PlatformAdapter` interfaces
4. Use `@PlatformProviderDecorator` for auto-registration
5. Remove old adapter/factory references from modules

The new architecture eliminates:

- ❌ Separate adapter classes
- ❌ Connection manager services
- ❌ Manual factory registration
- ❌ Complex dependency injection
- ❌ Shared state between projects

And provides:

- ✅ Single-file platform implementation
- ✅ Auto-discovery and registration
- ✅ Complete isolation between platforms
- ✅ Thread-safe operations
- ✅ Easy testing and maintenance
