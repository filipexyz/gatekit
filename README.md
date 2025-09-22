# GateKit Backend API

Universal messaging gateway that provides a unified API to send messages across 100+ platforms.

## Overview

GateKit solves the problem of platform-specific integrations by providing a single, consistent API to communicate across Discord, Telegram, Slack, WhatsApp, and many other platforms. Instead of learning and maintaining multiple SDKs, use one simple API for all your messaging needs.

## Features

- 🔐 **Dual Authentication**: JWT (Auth0) and API Keys
- 🚀 **Multi-Platform Support**: Single API for 100+ messaging platforms
- 🛡️ **Enterprise Security**: Rate limiting, CORS, encryption, scope-based permissions
- 📊 **Usage Analytics**: Track API usage across projects and platforms
- 🔑 **API Key Management**: Create, revoke, and roll keys with granular permissions
- 🏗️ **Multi-Environment**: Support for test, production, and restricted environments
- ⚡ **Async Message Queue**: Redis-backed Bull queue for reliable message delivery
- 🔗 **Webhook Support**: Secure UUID-based webhook endpoints for platform callbacks

## Tech Stack

- **Framework**: NestJS
- **Database**: PostgreSQL with Prisma ORM
- **Cache/Queue**: Redis with Bull
- **Authentication**: Auth0 (JWT) + API Keys
- **Language**: TypeScript
- **Container**: Docker

## Prerequisites

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 16
- Redis 7

## Installation

### 1. Clone the repository
```bash
git clone https://github.com/GateKit/backend.git
cd backend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
```bash
cp .env.example .env
```

Edit `.env` and add required values:
```env
# Generate encryption key with: openssl rand -hex 32
ENCRYPTION_KEY=your-32-character-min-key-here

# Database
DATABASE_URL=postgresql://gatekit:password@localhost:5432/gatekit

# Redis
REDIS_URL=redis://:password@localhost:6379

# Auth0 (optional - enables JWT authentication)
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://api.gatekit.dev
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
```

### 4. Start infrastructure
```bash
# Start PostgreSQL and Redis
docker compose up -d postgres redis
```

### 5. Run database migrations
```bash
npx prisma migrate dev
```

### 6. Start the application
```bash
npm run start:dev
```

The API will be available at `http://localhost:3000`

## API Documentation

### Authentication

The API supports dual authentication methods:

#### API Keys (Primary)
```bash
curl -H "X-API-Key: your-api-key" http://localhost:3000/api/v1/projects
```

#### JWT Tokens (Auth0)
```bash
curl -H "Authorization: Bearer your-jwt-token" http://localhost:3000/api/v1/projects
```

Note: JWT authentication requires Auth0 configuration. If not configured, use API keys.

### Available Endpoints

#### Health Check
```bash
GET /api/v1/health
```

#### Projects
```bash
# List all projects
GET /api/v1/projects

# Create a project
POST /api/v1/projects
{
  "name": "My Project",
  "environment": "development"
}

# Get project details
GET /api/v1/projects/:slug

# Update project
PATCH /api/v1/projects/:slug

# Delete project
DELETE /api/v1/projects/:slug
```

#### API Keys
```bash
# List project API keys
GET /api/v1/projects/:slug/keys

# Create API key
POST /api/v1/projects/:slug/keys
{
  "name": "Production Key",
  "environment": "production",
  "scopes": ["messages:send", "messages:read"]
}

# Revoke API key
DELETE /api/v1/projects/:slug/keys/:keyId

# Roll API key (generate new key, revoke old)
POST /api/v1/projects/:slug/keys/:keyId/roll
```

#### Platform Management
```bash
# List configured platforms for project
GET /api/v1/projects/:slug/platforms

# Configure a platform (Discord, Telegram, etc.)
POST /api/v1/projects/:slug/platforms
{
  "platform": "discord",
  "credentials": {
    "token": "your-bot-token"
  }
}

# Update platform configuration
PATCH /api/v1/projects/:slug/platforms/:platform

# Remove platform
DELETE /api/v1/projects/:slug/platforms/:platform

# Get webhook URL for platform
GET /api/v1/projects/:slug/platforms/:platform/webhook
```

#### Platform Health & Discovery
```bash
# Check health of all platform providers
GET /api/v1/platforms/health

# List supported platforms
GET /api/v1/platforms/supported

# Get available webhook routes
GET /api/v1/platforms/webhook-routes
```

#### Messaging (Queue-based)
```bash
# Send message (queued for async delivery)
POST /api/v1/projects/:slug/messages/send
{
  "platform": "discord",
  "target": {
    "type": "channel",
    "id": "channel-id"
  },
  "content": {
    "text": "Hello, world!"
  }
}

# Check message delivery status
GET /api/v1/projects/:slug/messages/status/:jobId

# Get queue metrics
GET /api/v1/projects/:slug/messages/queue/metrics

# Retry failed message
POST /api/v1/projects/:slug/messages/retry/:jobId

# Revoke API key
DELETE /api/v1/projects/:slug/keys/:keyId

# Roll API key (generate new, revoke old)
POST /api/v1/projects/:slug/keys/:keyId/roll
```

#### Platform Configuration
```bash
# List configured platforms
GET /api/v1/projects/:slug/platforms

# Configure platform (Discord, Telegram, etc.)
POST /api/v1/projects/:slug/platforms
{
  "platform": "discord",
  "credentials": {
    "token": "your-bot-token"
  },
  "config": {
    "guildId": "123456789"
  }
}

# Update platform configuration
PATCH /api/v1/projects/:slug/platforms/:platform

# Delete platform configuration
DELETE /api/v1/projects/:slug/platforms/:platform

# Get webhook URL for platform
GET /api/v1/projects/:slug/platforms/:platform/webhook
```

#### Messages
```bash
# Send message (queued for async delivery)
POST /api/v1/projects/:slug/messages/send
{
  "platform": "discord",
  "target": {
    "type": "channel",
    "id": "channel-id"
  },
  "text": "Hello from GateKit!",
  "attachments": [],
  "threadId": null
}
# Returns: { "success": true, "jobId": "123", "status": "queued" }

# Check message status
GET /api/v1/projects/:slug/messages/status/:jobId

# Get queue metrics
GET /api/v1/projects/:slug/messages/queue/metrics
# Returns: { "waiting": 5, "active": 2, "completed": 100, "failed": 3 }

# Retry failed message
POST /api/v1/projects/:slug/messages/retry/:jobId
```

#### Webhooks
```bash
# Platform webhooks (called by platforms like Discord/Telegram)
POST /webhooks/discord/:webhookToken
POST /webhooks/telegram/:webhookToken
```

### API Key Scopes

- `messages:send` - Send messages
- `messages:read` - Read message history
- `projects:read` - View projects
- `projects:write` - Create/update projects
- `keys:read` - View API keys
- `keys:manage` - Create/revoke/roll API keys

## Development

### Running locally
```bash
# Start dependencies
docker compose up -d postgres redis

# Run in watch mode
npm run start:dev
```

### Testing
```bash
# Unit tests
npm test

# Integration tests
npm run test:e2e

# Test coverage
npm run test:cov
```

See [test/CLAUDE.md](test/CLAUDE.md) for detailed testing guidelines.

### Building for production
```bash
# Build
npm run build

# Start production server
npm run start:prod
```

### Docker deployment
```bash
# Build and run everything
docker compose up -d

# View logs
docker compose logs -f app
```

## Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `ENCRYPTION_KEY` | Yes | 32+ char key for encryption | `openssl rand -hex 32` |
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://...` |
| `REDIS_URL` | Yes | Redis connection string | `redis://...` |
| `PORT` | No | Server port (default: 3000) | `3000` |
| `NODE_ENV` | No | Environment | `development`, `production` |
| `CORS_ORIGINS` | No | Allowed origins (comma-separated) | `http://localhost:3000` |
| `RATE_LIMIT_MAX` | No | Max requests per minute (default: 100) | `100` |
| `RATE_LIMIT_TTL` | No | Rate limit window in seconds (default: 60) | `60` |

## Security Features

- ✅ **API Key Authentication**: All endpoints protected by default
- ✅ **Scope-based Authorization**: Granular permissions per API key
- ✅ **Rate Limiting**: Global and per-endpoint limits
- ✅ **CORS Protection**: Configurable allowed origins
- ✅ **Encryption**: AES-256-GCM for sensitive data
- ✅ **Key Hashing**: SHA-256 for API keys in database
- ✅ **Input Validation**: DTO validation with class-validator
- ✅ **SQL Injection Protection**: Parameterized queries via Prisma

## Project Structure

```
src/
├── api-keys/          # API key management
├── auth/              # Authentication strategies
├── common/            # Shared utilities, guards, decorators
├── config/            # Application configuration
├── health/            # Health check endpoint
├── platforms/         # Platform adapters and messaging
│   ├── adapters/      # Discord, Telegram, etc.
│   ├── messages/      # Message sending service
│   └── webhooks/      # Webhook handlers
├── prisma/            # Database service and migrations
├── projects/          # Project management
├── queues/            # Bull queue management
│   ├── processors/    # Message processors
│   └── message.queue.ts
└── main.ts           # Application entry point

test/
├── fixtures/          # Test data generators
├── integration/       # E2E tests
└── CLAUDE.md         # Testing guidelines
```

## Contributing

1. Read [CLAUDE.md](CLAUDE.md) for development guidelines
2. Follow the testing rules in [test/CLAUDE.md](test/CLAUDE.md)
3. Ensure all tests pass before submitting PR
4. Never bypass security features in code or tests

## License

Proprietary - All rights reserved

## Support

For issues and questions, please visit [github.com/GateKit/backend/issues](https://github.com/GateKit/backend/issues)