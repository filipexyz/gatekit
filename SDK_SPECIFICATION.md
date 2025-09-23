# GateKit SDK Specification

## Overview

The **GateKit SDK** (`@gatekit/sdk`) is a pure TypeScript API client for the GateKit universal messaging gateway. It provides a clean, type-safe interface to all GateKit API endpoints without any CLI-specific concerns.

## Architecture Principles

### Design Goals
1. **Pure API Client** - Zero dependencies on CLI, file system, or environment
2. **Type Safety** - Complete TypeScript coverage with no `any` types
3. **Dependency Injection** - All configuration explicitly provided
4. **Framework Agnostic** - Works in Node.js, browsers, serverless, etc.
5. **Testing Friendly** - Easy to mock and test in isolation
6. **Performance Optimized** - Minimal bundle size, tree-shakeable

### Package Structure
```
@gatekit/sdk/
├── src/
│   ├── client/          # Core API client
│   ├── types/           # TypeScript interfaces
│   ├── errors/          # Custom error classes
│   ├── utils/           # Pure utility functions
│   └── index.ts         # Public API exports
├── __tests__/           # Test suite
├── docs/               # API documentation
└── examples/           # Usage examples
```

## Core API Reference

### Configuration
```typescript
interface GateKitConfig {
  apiUrl: string;
  apiKey?: string;
  jwtToken?: string;
  timeout?: number;
  retries?: number;
}
```

### Main Client Class
```typescript
class GateKit {
  constructor(config: GateKitConfig);

  // Health & System
  health(): Promise<HealthResponse>;

  // Projects
  projects.list(): Promise<Project[]>;
  projects.get(slug: string): Promise<Project>;
  projects.create(data: CreateProjectData): Promise<Project>;
  projects.update(slug: string, data: UpdateProjectData): Promise<Project>;
  projects.delete(slug: string): Promise<void>;

  // API Keys
  apiKeys.list(projectSlug: string): Promise<ApiKey[]>;
  apiKeys.create(projectSlug: string, data: CreateApiKeyData): Promise<ApiKeyResult>;
  apiKeys.revoke(projectSlug: string, keyId: string): Promise<void>;
  apiKeys.roll(projectSlug: string, keyId: string): Promise<ApiKeyResult>;

  // Platforms
  platforms.list(projectSlug: string): Promise<Platform[]>;
  platforms.get(projectSlug: string, platformId: string): Promise<Platform>;
  platforms.create(projectSlug: string, data: CreatePlatformData): Promise<Platform>;
  platforms.update(projectSlug: string, platformId: string, data: UpdatePlatformData): Promise<Platform>;
  platforms.delete(projectSlug: string, platformId: string): Promise<void>;
  platforms.getWebhook(projectSlug: string, platformId: string): Promise<WebhookInfo>;
  platforms.getSupported(): Promise<SupportedPlatform[]>;
  platforms.getHealth(): Promise<PlatformHealthStatus>;

  // Messages
  messages.send(projectSlug: string, data: SendMessageData): Promise<MessageJob>;
  messages.getStatus(projectSlug: string, jobId: string): Promise<MessageStatus>;
  messages.retry(projectSlug: string, jobId: string): Promise<MessageJob>;
  messages.getQueueMetrics(projectSlug: string): Promise<QueueMetrics>;
}
```

## Type System

### Core Types
Based on backend API responses at `/root/gatekit/dev/backend/src/platforms/dto/`:

```typescript
// From src/projects/dto/create-project.dto.ts
export interface Project {
  id: string;
  name: string;
  slug: string;
  environment: 'development' | 'staging' | 'production';
  isDefault: boolean;
  settings?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// From src/platforms/dto/send-message.dto.ts
export interface SendMessageData {
  targets: MessageTarget[];
  content: MessageContent;
  options?: MessageOptions;
  metadata?: MessageMetadata;
}

export interface MessageTarget {
  platformId: string;
  type: 'user' | 'channel' | 'group';
  id: string;
}

export interface MessageContent {
  text?: string;
  attachments?: Attachment[];
  buttons?: Button[];
  embeds?: Embed[];
}

// From src/platforms/dto/create-platform.dto.ts
export interface Platform {
  id: string;
  platform: 'discord' | 'telegram';
  credentials: Record<string, unknown>;
  isActive: boolean;
  testMode: boolean;
  webhookToken?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Error Types
```typescript
export class GateKitError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {}
}

export class AuthenticationError extends GateKitError {}
export class RateLimitError extends GateKitError {}
export class ValidationError extends GateKitError {}
```

## Implementation Strategy

### Phase 1: Core SDK
**Reference Implementation from `/root/gatekit-cli/src/lib/api.ts`**

```typescript
// Extract and clean up existing API client
export class GateKit {
  private client: AxiosInstance;

  constructor(config: GateKitConfig) {
    this.client = axios.create({
      baseURL: config.apiUrl,
      timeout: config.timeout || 30000,
      headers: { 'Content-Type': 'application/json' }
    });

    this.setupAuthentication(config);
    this.setupErrorHandling();
  }
}
```

### Phase 2: Namespaced API Groups
```typescript
// Clean separation by domain
export class ProjectsAPI {
  constructor(private client: AxiosInstance) {}

  async list(): Promise<Project[]> {
    const response = await this.client.get<Project[]>('/api/v1/projects');
    return response.data;
  }
}

export class MessagesAPI {
  constructor(private client: AxiosInstance) {}

  async send(projectSlug: string, data: SendMessageData): Promise<MessageJob> {
    const response = await this.client.post<MessageJob>(
      `/api/v1/projects/${projectSlug}/messages/send`,
      data
    );
    return response.data;
  }
}
```

## Usage Examples

### Basic Usage
```typescript
import { GateKit } from '@gatekit/sdk';

const gk = new GateKit({
  apiUrl: 'https://api.gatekit.dev',
  apiKey: 'gk_live_your_key_here'
});

// Send message
const job = await gk.messages.send('my-project', {
  targets: [{ platformId: 'platform-id', type: 'channel', id: '123' }],
  content: { text: 'Hello world!' }
});

// Check status
const status = await gk.messages.getStatus('my-project', job.jobId);
```

### Advanced Usage
```typescript
// Error handling
try {
  await gk.projects.create({ name: 'New Project' });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.log('Invalid API key');
  } else if (error instanceof RateLimitError) {
    console.log('Rate limited, retry after:', error.retryAfter);
  }
}

// Streaming responses (future)
for await (const status of gk.messages.watchStatus('proj', 'job-123')) {
  console.log('Status:', status.state);
  if (status.state === 'completed') break;
}
```

## Testing Strategy

### SDK Testing (Pure, Fast)
```typescript
// No mocking needed - dependency injection
test('sends message with correct payload', async () => {
  const mockClient = createMockAxios();
  const gk = new GateKit({ apiUrl: 'test', apiKey: 'test' });

  await gk.messages.send('proj', messageData);

  expect(mockClient.post).toHaveBeenCalledWith(
    '/api/v1/projects/proj/messages/send',
    messageData
  );
});
```

## Package Dependencies

### Minimal Dependencies
```json
{
  "dependencies": {
    "axios": "^1.6.0"
  },
  "peerDependencies": {
    "typescript": ">=4.5.0"
  }
}
```

### Bundle Analysis
- **Target**: <50KB gzipped
- **Tree-shakeable**: Import only needed modules
- **Zero CLI dependencies**: No commander, inquirer, chalk, etc.

## Development Workflow

### Source References
- **API Endpoints**: `/root/gatekit/dev/backend/src/**/*.controller.ts`
- **DTOs**: `/root/gatekit/dev/backend/src/**/*.dto.ts`
- **Types**: `/root/gatekit/dev/backend/src/@types/`
- **Current Implementation**: `/root/gatekit-cli/src/lib/api.ts`

### Build Process
1. **TypeScript Compilation**: Pure ESM + CommonJS builds
2. **Bundle Analysis**: Webpack bundle analyzer
3. **Type Generation**: Auto-generate from OpenAPI spec
4. **Documentation**: Auto-generate API docs from JSDoc

## Integration Points

### With GateKit Backend
- **Authentication**: X-API-Key header or Bearer token
- **Rate Limiting**: Respects 429 responses with retry-after
- **Error Handling**: Maps HTTP status codes to typed errors
- **Versioning**: URL-based API versioning support

### With GateKit CLI
- CLI imports SDK as dependency
- CLI handles only user interaction concerns
- SDK handles all API communication
- Clean separation of responsibilities

## Publishing Strategy

### NPM Packages
1. **@gatekit/sdk** - Core API client (this spec)
2. **@gatekit/cli** - Command line interface (depends on SDK)

### Versioning
- **SDK**: Semantic versioning based on API changes
- **CLI**: Independent versioning for UX improvements
- **Compatibility**: CLI major version tied to SDK major version

## Future Extensibility

### Plugin System
```typescript
// Platform-specific helpers
import { GateKit } from '@gatekit/sdk';
import { DiscordHelpers } from '@gatekit/sdk/discord';

const gk = new GateKit(config);
const discord = new DiscordHelpers(gk);

await discord.sendToChannel('channel-id', 'message');
```

### Framework Integrations
```typescript
// React hooks
import { useGateKit } from '@gatekit/react';

// Express middleware
import { gatekitWebhook } from '@gatekit/express';

// Next.js API routes
import { withGateKit } from '@gatekit/nextjs';
```

This specification provides a complete blueprint for building a professional-grade SDK that can power multiple client applications while maintaining clean architecture principles.