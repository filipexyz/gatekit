# CLAUDE.md - GateKit Backend API

## Project Overview

**GateKit** is a universal messaging gateway that provides a single API to send messages across multiple platforms (Discord, Telegram, WhatsApp via Evolution API, etc.). It solves the problem of developers wasting 70% of their time on platform-specific integrations.

## Community

Join our Discord community for support and discussions: https://discord.gg/bQPsvycW

## Technology Stack

- **Framework**: NestJS
- **Runtime**: Node.js
- **Language**: TypeScript
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Queue**: Bull with Redis
- **Cache**: Redis

## Authentication & Security

### Industry-Grade Security Architecture

GateKit implements **defense-in-depth security** with multiple overlapping layers to ensure bulletproof protection against unauthorized access.

#### **Authentication Methods**

1. **JWT Token (Auth0)**
   - Header: `Authorization: Bearer <jwt_token>`
   - Requires Auth0 configuration (AUTH0_DOMAIN, AUTH0_AUDIENCE)
   - When not configured, returns error asking for API key authentication

2. **API Keys**
   - Header: `X-API-Key: <api_key>`
   - Primary authentication method
   - Works independently of Auth0 configuration

#### **Multi-Layer Security Implementation**

**Layer 1: Controller Guards**

```typescript
@UseGuards(AppAuthGuard, ProjectAccessGuard)
```

- `AppAuthGuard` - Validates API keys or JWT tokens
- `ProjectAccessGuard` - Ensures authenticated user has access to target project

**Layer 2: Service-Level Validation (Defense-in-Depth)**

```typescript
SecurityUtil.getProjectWithAccess(prisma, projectId, authContext, operation);
```

- Mandatory validation at service level prevents bypass scenarios
- Validates project access even if guards are bypassed
- Provides detailed security error messages for debugging

**Layer 3: Type Safety**

```typescript
authContext: AuthContext; // Required, not optional
```

- TypeScript enforces security context passing
- Prevents accidental omission of security validation
- Compile-time safety for critical security operations

#### **Security Features**

- ✅ **Guard Bypass Detection** - Missing auth context triggers security errors
- ✅ **Project Isolation** - API keys and JWT users can only access their projects
- ✅ **Mandatory Validation** - No optional security parameters
- ✅ **Comprehensive Logging** - All security events are logged
- ✅ **Zero Single Points of Failure** - Multiple overlapping validations

## API Versioning

- URL-based versioning: `/api/v1/...`

## Development Rules

### SUPER IMPORTANT

- **NEVER** include features, concepts, or implementations that have not been explicitly discussed
- **NEVER** add speculative or "nice-to-have" features to documentation or CLAUDE.md
- **ONLY** document what has been explicitly requested and implemented

### Documentation Structure

- **Keep domain-specific documentation separate** - Testing docs in `test/CLAUDE.md`, not in main CLAUDE.md
- **Main CLAUDE.md is for project overview only** - Reference other CLAUDE.md files for specific areas
- **Each major area should have its own CLAUDE.md** - Tests, infrastructure, etc. have separate documentation

### Package Management

- **NEVER** write dependencies directly in package.json
- **ALWAYS** use CLI commands to install packages

### Commit Messages

- **NEVER** include "Generated with [Claude Code]" messages in commits
- **Keep Co-Authored-By: Claude <noreply@anthropic.com>** for attribution

## Current Implementation

### Core Endpoints

- `GET /api/v1/health` - Public health check
- `POST /api/v1/projects` - Create project
- `GET /api/v1/projects` - List all projects
- `GET /api/v1/projects/:id` - Get project details
- `PATCH /api/v1/projects/:id` - Update project
- `DELETE /api/v1/projects/:id` - Delete project
- `POST /api/v1/projects/:id/keys` - Generate API key
- `GET /api/v1/projects/:id/keys` - List API keys
- `DELETE /api/v1/projects/:id/keys/:keyId` - Revoke key
- `POST /api/v1/projects/:id/keys/:keyId/roll` - Roll key

### Platform Configuration

- `GET /api/v1/projects/:id/platforms` - List configured platforms
- `POST /api/v1/projects/:id/platforms` - Configure platform (Discord, Telegram, WhatsApp-Evo)
- `PATCH /api/v1/projects/:id/platforms/:id` - Update platform
- `DELETE /api/v1/projects/:id/platforms/:id` - Delete platform
- `POST /api/v1/projects/:id/platforms/:id/register-webhook` - Register webhook with provider
- `GET /api/v1/projects/:id/platforms/:id/qr-code` - Get QR code for WhatsApp authentication

### Messaging (Queue-based)

- `POST /api/v1/projects/:id/messages/send` - Queue message for delivery
- `GET /api/v1/projects/:id/messages/status/:jobId` - Check message status
- `GET /api/v1/projects/:id/messages/queue/metrics` - Queue metrics
- `POST /api/v1/projects/:id/messages/retry/:jobId` - Retry failed message

### Message Reception & Storage

- `GET /api/v1/projects/:id/messages` - List received messages with filtering
- `GET /api/v1/projects/:id/messages/stats` - Get message statistics
- `GET /api/v1/projects/:id/messages/:messageId` - Get specific message
- `DELETE /api/v1/projects/:id/messages/cleanup` - Delete old messages

### Platform Webhooks (Incoming - Dynamic & UUID-secured)

- `POST /api/v1/webhooks/:platform/:webhookToken` - Dynamic webhook handler for any platform
- `GET /api/v1/platforms/health` - Platform provider health status
- `GET /api/v1/platforms/supported` - List supported platforms (discord, telegram, whatsapp-evo)
- `GET /api/v1/platforms/webhook-routes` - Available webhook routes

### Webhook Notifications (Outgoing - Event Subscriptions)

- `POST /api/v1/projects/:id/webhooks` - Create webhook subscription
- `GET /api/v1/projects/:id/webhooks` - List webhook subscriptions
- `GET /api/v1/projects/:id/webhooks/:webhookId` - Get webhook details with stats
- `PATCH /api/v1/projects/:id/webhooks/:webhookId` - Update webhook
- `DELETE /api/v1/projects/:id/webhooks/:webhookId` - Delete webhook
- `GET /api/v1/projects/:id/webhooks/:webhookId/deliveries` - List delivery attempts

## Platform Integrations

### **WhatsApp via Evolution API (whatsapp-evo)**

GateKit integrates with WhatsApp through the Evolution API, providing robust WhatsApp messaging capabilities:

#### **Features:**

- **QR Code Authentication** - Secure connection setup via QR code scanning
- **Real-time Messaging** - Webhook-based message reception and sending
- **Multi-format Support** - Handles various Evolution API payload formats
- **Auto-Connection** - Dynamic connection creation on incoming webhooks
- **Message Persistence** - Complete message history with raw data storage

#### **Setup Process:**

1. **Configure Platform** - Add WhatsApp-Evo platform with Evolution API credentials
2. **QR Code Flow** - Use `/platforms/:id/qr-code` endpoint for authentication
3. **Webhook Registration** - Automatic webhook setup with Evolution API
4. **Message Flow** - Send/receive messages through unified GateKit API

#### **Credentials Required:**

- `evolutionApiUrl` - Evolution API server URL (e.g., https://evo.example.com)
- `evolutionApiKey` - Evolution API authentication key

#### **Example Configuration:**

```bash
curl -X POST "/api/v1/projects/my-project/platforms" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "platform": "whatsapp-evo",
    "credentials": {
      "evolutionApiUrl": "https://evo.example.com",
      "evolutionApiKey": "your-evolution-api-key"
    }
  }'
```

### **Platform Capability System**

GateKit implements a decorator-based capability system to track which features each platform supports.

#### **How It Works**

Platforms declare their capabilities using the `@PlatformProviderDecorator`:

```typescript
@PlatformProviderDecorator('discord', [
  { capability: PlatformCapability.SEND_MESSAGE },
  { capability: PlatformCapability.RECEIVE_MESSAGE },
  { capability: PlatformCapability.ATTACHMENTS },
])
export class DiscordProvider implements PlatformProvider
```

#### **Querying Capabilities**

**Via API:**

```bash
GET /api/v1/platforms/health
```

**Via Registry Service:**

```typescript
platformRegistry.hasCapability('discord', PlatformCapability.SEND_MESSAGE);
platformRegistry.getCapabilityInfo('telegram', PlatformCapability.ATTACHMENTS);
platformRegistry.getProviderCapabilities(provider);
```

#### **Current Capabilities**

All platforms (Discord, Telegram, WhatsApp-Evo) support:

- `send-message` - Send messages to users/channels
- `receive-message` - Receive incoming messages
- `attachments` - Send/receive media files

#### **Future Capabilities (In Enum)**

Capabilities defined but not yet implemented:

- `edit-message` - Edit previously sent messages
- `delete-message` - Delete sent messages
- `embeds` - Rich embedded content
- `buttons` - Interactive buttons
- `reactions` - Message reactions
- `threads` - Threaded conversations

#### **Implementation Details**

- **Enum**: `src/platforms/enums/platform-capability.enum.ts`
- **Decorator**: `src/platforms/decorators/platform-provider.decorator.ts`
- **Registry**: `src/platforms/services/platform-registry.service.ts`
- **Endpoint**: `src/platforms/controllers/platform-health.controller.ts`

## Architecture Highlights

### Dynamic Platform System

- **Plugin-based architecture** - Platforms auto-register via `@PlatformProviderDecorator`
- **Complete isolation** - Each platform provider manages its own connections and logic
- **Thread-safe design** - No shared state between projects or platforms
- **Connection strategies** - WebSocket (Discord), Webhook (Telegram, WhatsApp-Evo), easily extensible
- **Auto-discovery** - New platforms require only a single provider class

### Message Queue System

- **All messages are queued** - No synchronous message sending
- **Bull queue with Redis backend** - Reliable, scalable message processing
- **Dynamic platform routing** - Queue processor uses platform registry
- **Automatic retries** - Exponential backoff for failed messages
- **Job tracking** - Monitor message status via job IDs

### Security Features

- **UUID-based webhook tokens** - No exposure of project IDs in URLs
- **AES-256-GCM encryption** - For sensitive credentials
- **Platform isolation** - Each project gets dedicated platform connections
- **Thread-safe message routing** - No race conditions between projects
- **Scope-based authorization** - Granular API key permissions
- **Message deduplication** - Unique constraints prevent duplicate storage

### Security Utilities

#### **SecurityUtil Class**

Central utility for all security operations with zero-duplication patterns:

```typescript
// Get project and validate access in one step
const project = await SecurityUtil.getProjectWithAccess(
  prisma,
  projectId,
  authContext,
  'operation',
);

// Standalone validation
SecurityUtil.validateProjectAccess(authContext, projectId, 'operation');

// Extract auth context from request
const authContext = SecurityUtil.extractAuthContext(request);
```

#### **AuthContext Interface**

Type-safe authentication context passed between layers:

```typescript
interface AuthContext {
  authType: 'api-key' | 'jwt';
  project?: { id: string };
  user?: { userId: string; email?: string };
}
```

#### **Security Decorators**

```typescript
// Controller method parameter decorator
@AuthContextParam() authContext: AuthContext

// Service method signature
async method(projectId: string, data: any, authContext: AuthContext)
```

#### **Error Handling**

- **Guard Bypass Detection**: `SECURITY ERROR: Authentication context missing for {operation}. This indicates a guard bypass.`
- **Project Access Denial**: `API key does not have access to perform {operation}`
- **Invalid Authentication**: `Invalid authentication type for {operation}`

### Platform Provider Features

- **One connection per project** - Discord: dedicated WebSocket per project, WhatsApp-Evo: Evolution API integration
- **Resource management** - Connection limits, cleanup, health monitoring
- **Error resilience** - Graceful degradation when platforms unavailable
- **Hot-swappable** - Providers can be added/removed without restarting
- **Webhook auto-registration** - Telegram and WhatsApp-Evo webhooks configured automatically
- **QR Code Authentication** - WhatsApp-Evo supports QR code flow for connection setup
- **Message persistence** - All incoming messages stored with full raw data

### Webhook Notification System

**Events**: `message.received`, `message.sent`, `message.failed`

**Features**:

- HMAC SHA-256 signatures for validation
- SSRF protection (double validation)
- Auto-retry with exponential backoff (1s, 2s, 4s - max 3 attempts)
- Concurrency control (max 10 concurrent)
- Delivery tracking with stats
- Max 50 webhooks per project

**Maintenance**: Periodic cleanup required (deliveries stored indefinitely)

## Development Setup

### Local Development

```bash
# Start databases only (PostgreSQL, Redis)
docker compose up -d postgres redis

# Run application locally
npm run start:dev
```

### Docker Usage

- **Docker is for production deployment only**
- **Never run tests inside Docker containers during development**
- Use local Node.js for all development and testing

## Testing

### IMPORTANT: Testing Documentation

**All testing guidelines, rules, and examples are documented in `test/CLAUDE.md`**

When writing or modifying tests:

1. **ALWAYS read `test/CLAUDE.md` first**
2. Follow the testing rules exactly as specified
3. Never deviate from the testing patterns documented there

### Quick Commands

```bash
npm test         # Run all tests (544 tests)
npm test:e2e     # Run integration tests
npm test -- webhook  # Run webhook tests (36 tests)
```

### Test Coverage Summary

**Total Tests**: 544 tests (all passing)

#### **Key Test Coverage**

- **Webhooks**: 36 tests (delivery, retry logic, HMAC signatures, stats, cleanup)
- **Security**: Complete auth guard and context validation coverage
- **Platforms**: Discord, Telegram, WhatsApp-Evo providers fully tested
- **Messages**: Queue processing, delivery, storage, and retrieval

#### **Security Testing Requirements**

When writing tests for services with project access:

```typescript
// REQUIRED: All service tests must provide auth context
const mockAuthContext = {
  authType: 'api-key' as const,
  project: { id: 'project-id' },
};

// Service call with auth context
await service.method(projectId, data, mockAuthContext);
```

For detailed testing guidelines, see: **[test/CLAUDE.md](test/CLAUDE.md)**

## Platform-Specific Documentation

- **[WHATSAPP_EVO.md](WHATSAPP_EVO.md)** - Complete WhatsApp via Evolution API integration guide

## GateKit Client Architecture

### **Revolutionary Contract-Driven System**

GateKit implements a next-generation architecture where **SDK** and **CLI** are auto-generated from backend API contracts, ensuring perfect sync and zero duplication.

### **Core Architecture Specifications**

- **[SDK_SPECIFICATION.md](SDK_SPECIFICATION.md)** - Pure TypeScript API client architecture
- **[CLI_SPECIFICATION.md](CLI_SPECIFICATION.md)** - Permission-aware CLI design
- **[PERMISSION_AWARE_CLI.md](PERMISSION_AWARE_CLI.md)** - Dynamic command system based on user permissions
- **[DEVELOPMENT_PRIORITIZATION.md](DEVELOPMENT_PRIORITIZATION.md)** - Implementation roadmap and effort matrix
- **[DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md)** - Multi-agent collaboration system

### **Key Innovation: Single Source → Quintuple Outputs**

```
Backend Controllers (@SdkContract decorators)
    ↓
┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐
│ @gatekit/sdk│ @gatekit/cli│ n8n-nodes-  │  OpenAPI    │ Live Docs   │
│ (TypeScript)│ (Commands)  │ gatekit     │ Spec        │ (/docs/*)   │
│             │             │ (Visual UI) │ (Standard)  │ (Runtime)   │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘
```

### **Strategic Advantages**

- **Perfect Sync** - API changes automatically update SDK & CLI
- **Source Protection** - Only compiled packages published, backend source stays private
- **Permission Intelligence** - CLI shows only commands user can execute
- **Zero Duplication** - Single contract definition generates everything

### **Current Implementation Status**

- ✅ Backend API fully functional with Discord, Telegram, and WhatsApp-Evo support
- ✅ Revolutionary contract-driven architecture complete and production-ready
- ✅ Permission Discovery API (`/auth/whoami`) operational
- ✅ Recursive type auto-discovery system (20 types extracted automatically)
- ✅ Zero `any` types throughout entire system with perfect type safety
- ✅ 14 contracts across 4 controllers with complete API coverage
- ✅ Quintuple-generation pipeline: SDK + CLI + n8n + OpenAPI + Docs
- ✅ Self-documenting API with live OpenAPI endpoints (/docs/openapi.json)
- ✅ n8n community node for visual automation (300k+ potential users)
- ✅ Production tested: All generated packages compile and deploy successfully

### **Contract-Driven Development**

**Complete Implementation Guide:** **[CONTRACT_DRIVEN_DEVELOPMENT.md](CONTRACT_DRIVEN_DEVELOPMENT.md)**

**Daily Workflow:**

```bash
# 1. Add @SdkContract decorators to controllers
# 2. Regenerate all packages (quintuple generation)
npm run generate:all
# 3. Test and publish all packages
cd generated/sdk && npm publish
cd ../cli && npm publish
cd ../n8n && npm publish
# 4. OpenAPI available at /docs/openapi.json
```

## Deployment

```bash
# Deploy to Fly.io (migrations run automatically)
fly deploy

# Check status
fly status

# View logs (recent, no tailing)
fly logs --no-tail

# View logs (last 100 lines)
fly logs --no-tail | head -100

# Monitor live logs (use Ctrl+C to stop)
fly logs -f

# SSH into container
fly ssh console
```

## Code Quality & Development Tools

### ESLint & Code Quality

- **All ESLint errors must be fixed** - Zero tolerance for lint errors in production
- **Codex CLI integration** - Use `codex exec` for complex linting analysis and systematic error resolution
- **Pre-commit hooks** - Husky + lint-staged automatically format and lint on commit
- **CI/CD validation** - GitHub Actions pipeline validates code quality on every PR

### Codex CLI for Deep Analysis

**Use when you need additional expertise on complex problems:**

```bash
codex exec "Find and fix the remaining ESLint errors with solid solutions"
```
