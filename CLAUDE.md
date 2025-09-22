# CLAUDE.md - GateKit Backend API

## Project Overview

**GateKit** is a universal messaging gateway that provides a single API to send messages across 100+ platforms (Discord, Telegram, Slack, WhatsApp, etc.). It solves the problem of developers wasting 70% of their time on platform-specific integrations.

## Technology Stack

- **Framework**: NestJS
- **Runtime**: Node.js
- **Language**: TypeScript
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Queue**: Bull with Redis
- **Cache**: Redis

## Authentication

Dual authentication support:

1. **JWT Token (Auth0)**
   - Header: `Authorization: Bearer <jwt_token>`
   - Requires Auth0 configuration (AUTH0_DOMAIN, AUTH0_AUDIENCE)
   - When not configured, returns error asking for API key authentication

2. **API Keys**
   - Header: `X-API-Key: <api_key>`
   - Primary authentication method
   - Works independently of Auth0 configuration

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

## Current Implementation

### Core Endpoints
- `GET /api/v1/health` - Public health check
- `POST /api/v1/projects` - Create project
- `GET /api/v1/projects` - List all projects
- `GET /api/v1/projects/:slug` - Get project details
- `PATCH /api/v1/projects/:slug` - Update project
- `DELETE /api/v1/projects/:slug` - Delete project
- `POST /api/v1/projects/:slug/keys` - Generate API key
- `GET /api/v1/projects/:slug/keys` - List API keys
- `DELETE /api/v1/projects/:slug/keys/:keyId` - Revoke key
- `POST /api/v1/projects/:slug/keys/:keyId/roll` - Roll key

### Platform Configuration
- `GET /api/v1/projects/:slug/platforms` - List configured platforms
- `POST /api/v1/projects/:slug/platforms` - Configure platform
- `PATCH /api/v1/projects/:slug/platforms/:platform` - Update platform
- `DELETE /api/v1/projects/:slug/platforms/:platform` - Delete platform
- `GET /api/v1/projects/:slug/platforms/:platform/webhook` - Get webhook URL

### Messaging (Queue-based)
- `POST /api/v1/projects/:slug/messages/send` - Queue message for delivery
- `GET /api/v1/projects/:slug/messages/status/:jobId` - Check message status
- `GET /api/v1/projects/:slug/messages/queue/metrics` - Queue metrics
- `POST /api/v1/projects/:slug/messages/retry/:jobId` - Retry failed message

### Webhooks (Dynamic & UUID-secured)
- `POST /api/v1/webhooks/:platform/:webhookToken` - Dynamic webhook handler for any platform
- `GET /api/v1/platforms/health` - Platform provider health status
- `GET /api/v1/platforms/supported` - List supported platforms
- `GET /api/v1/platforms/webhook-routes` - Available webhook routes

## Architecture Highlights

### Dynamic Platform System
- **Plugin-based architecture** - Platforms auto-register via `@PlatformProviderDecorator`
- **Complete isolation** - Each platform provider manages its own connections and logic
- **Thread-safe design** - No shared state between projects or platforms
- **Connection strategies** - WebSocket (Discord), Webhook (Telegram), easily extensible
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

### Platform Provider Features
- **One connection per project** - Discord: dedicated WebSocket per project
- **Resource management** - Connection limits, cleanup, health monitoring
- **Error resilience** - Graceful degradation when platforms unavailable
- **Hot-swappable** - Providers can be added/removed without restarting

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
npm test         # Run unit tests
npm test:e2e     # Run integration tests
```

For detailed testing guidelines, see: **[test/CLAUDE.md](test/CLAUDE.md)**

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