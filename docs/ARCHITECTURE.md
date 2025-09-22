# GateKit Architecture

## System Overview

GateKit is a universal messaging gateway built with NestJS that provides a unified API for sending messages across multiple platforms. The system uses an asynchronous, queue-based architecture for reliable message delivery.

## Core Components

### 1. API Layer
- **NestJS Controllers**: Handle HTTP requests
- **Guards**: Authentication (JWT/API Key) and authorization (scope-based)
- **DTOs**: Input validation and transformation
- **Decorators**: Custom decorators for scopes and authentication

### 2. Message Queue System

#### Overview
All message sending is handled asynchronously through a Redis-backed Bull queue system.

```
Client Request → API → Queue → Processor → Platform Adapter → Platform API
```

#### Components

**MessageQueue Service** (`src/queues/message.queue.ts`)
- Manages job lifecycle
- Provides job status tracking
- Handles retries and failures
- Exposes queue metrics

**MessageProcessor** (`src/queues/processors/message.processor.ts`)
- Processes queued messages asynchronously
- Manages platform adapter instances
- Handles adapter lifecycle (initialization, cleanup)
- Reports job progress

#### Flow
1. Client sends message request to API
2. API validates request and platform configuration
3. Message is queued in Bull/Redis with job ID
4. API returns job ID immediately (non-blocking)
5. MessageProcessor picks up job from queue
6. Processor initializes/reuses platform adapter
7. Adapter sends message to platform
8. Job status updated (completed/failed)
9. Failed jobs automatically retry with exponential backoff

### 3. Platform Adapters

Each platform (Discord, Telegram, etc.) has its own adapter that implements the `PlatformAdapter` interface.

**Key Features:**
- **Isolation**: Each project gets its own adapter instance
- **Credential Management**: Encrypted storage in database
- **Event Handling**: Bidirectional communication via EventBus
- **Lifecycle Management**: Proper initialization and cleanup

**Factory Pattern:**
```typescript
AdapterFactory.createAdapter(platform) → new DiscordAdapter()
```

### 4. Security Layer

#### Encryption
- **Algorithm**: AES-256-GCM
- **Key Management**: Environment variable (32+ characters)
- **Usage**: Platform credentials encryption

#### Authentication
- **Dual Support**: JWT (Auth0) and API Keys
- **API Key Storage**: SHA-256 hashed in database
- **Scope System**: Granular permissions per key

#### Webhooks
- **UUID Tokens**: Each platform config gets unique webhook token
- **No ID Exposure**: Project IDs never exposed in URLs
- **Validation**: Platform-specific signature verification

### 5. Database Schema

Key models:
- **Project**: Core organizational unit
- **ProjectPlatform**: Platform configurations with encrypted credentials
- **ApiKey**: Hashed keys with scopes
- **ApiKeyScope**: Permission assignments
- **ApiKeyUsage**: Usage tracking

## Data Flow Examples

### Sending a Message
```
1. POST /api/v1/projects/:slug/messages/send
2. Validate API key and scopes
3. Validate project and platform config
4. Queue message in Bull
5. Return job ID to client
6. [Async] Process message
7. [Async] Initialize/reuse adapter
8. [Async] Send to platform
9. [Async] Update job status
```

### Webhook Processing
```
1. POST /webhooks/discord/:webhookToken
2. Look up platform config by UUID token
3. Validate webhook signature
4. Create message envelope
5. Emit event to EventBus
6. Platform adapter handles event
7. Process based on message type
```

## Scalability Considerations

### Horizontal Scaling
- **Stateless API**: Can run multiple instances
- **Queue Workers**: Can scale processor instances
- **Redis Cluster**: Supports queue distribution

### Performance Optimizations
- **Adapter Reuse**: Adapters cached per project/platform
- **Connection Pooling**: Database and Redis connections
- **Queue Configuration**: Configurable concurrency and rate limits

### Reliability Features
- **Automatic Retries**: Exponential backoff for failures
- **Job Persistence**: Redis persistence for queue durability
- **Graceful Shutdown**: Proper cleanup on termination
- **Circuit Breakers**: Platform-specific failure handling (planned)

## Monitoring & Observability

### Metrics Available
- Queue depth (waiting/active/completed/failed)
- Message delivery success rate
- Platform-specific metrics
- API usage per project/key

### Logging
- Structured logging with NestJS Logger
- Job processing logs with job IDs
- Error tracking with stack traces

## Future Enhancements

### Planned Features
- WebSocket support for real-time messaging
- Message batching for bulk sends
- Platform-specific rate limiting
- Advanced retry strategies
- Dead letter queue handling

### Platform Expansion
- Slack integration
- WhatsApp Business API
- Email gateway
- SMS providers
- Custom webhook platforms

## Development Guidelines

### Adding New Platforms
1. Create adapter in `src/platforms/adapters/[platform]/`
2. Implement `PlatformAdapter` interface
3. Add to `AdapterFactory`
4. Create webhook controller if needed
5. Add platform-specific DTOs
6. Update documentation

### Testing Strategy
- Unit tests for business logic
- Integration tests for API endpoints
- Mock adapters for testing
- Queue testing with test containers

## Security Best Practices

1. **Never log credentials** - Even encrypted ones
2. **Validate all inputs** - Use DTOs and class-validator
3. **Sanitize webhook data** - Prevent injection attacks
4. **Rotate encryption keys** - Regular key rotation
5. **Audit API usage** - Track and monitor usage patterns
6. **Rate limit by key** - Prevent abuse
7. **Validate webhook signatures** - Platform-specific validation
8. **Use prepared statements** - Via Prisma ORM

## Dependencies

### Core
- NestJS 10.x
- TypeScript 5.x
- Node.js 18+

### Data
- PostgreSQL 16
- Redis 7
- Prisma ORM

### Queue
- Bull (Redis-based queue)
- bull-board (monitoring UI - optional)

### Security
- bcrypt (API key hashing)
- crypto (built-in encryption)

### Platform SDKs
- discord.js
- node-telegram-bot-api
- (others as needed)