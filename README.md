# GateKit Backend

Universal messaging gateway API that provides a single interface to send messages across 100+ platforms.

## Tech Stack

- **Framework**: NestJS
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis
- **Runtime**: Node.js 20
- **Authentication**: Auth0 (JWT) + API Keys

## Quick Start

1. Copy environment variables:
```bash
cp .env.example .env
```

2. Start services with Docker Compose:
```bash
docker compose up -d
```

3. Access the health endpoint:
```bash
curl http://localhost:3000/api/v1/health
```

## API Endpoints

- `GET /api/v1/health` - Health check endpoint

## Authentication

Two methods supported:

1. **JWT Token (Auth0)**
   - Header: `Authorization: Bearer <jwt_token>`

2. **API Keys**
   - Header: `X-API-Key: <api_key>`

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run start:dev

# Run with Docker
docker compose up -d
```

## Docker Services

- **app** - NestJS application (port 3000)
- **postgres** - PostgreSQL database (port 5432)
- **redis** - Redis cache (port 6379)