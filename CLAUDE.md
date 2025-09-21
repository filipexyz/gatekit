# CLAUDE.md - GateKit Backend API

## Project Overview

**GateKit** is a universal messaging gateway that provides a single API to send messages across 100+ platforms (Discord, Telegram, Slack, WhatsApp, etc.). It solves the problem of developers wasting 70% of their time on platform-specific integrations.

## Technology Stack

- **Framework**: NestJS
- **Runtime**: Node.js
- **Language**: TypeScript
- **ORM**: Prisma
- **Database**: PostgreSQL

## Authentication

Two credential types:

1. **JWT Token (Auth0)**
   - Header: `Authorization: Bearer <jwt_token>`

2. **API Keys**
   - Header: `X-API-Key: <api_key>`

## API Versioning

- URL-based versioning: `/api/v1/...`

## Development Rules

### SUPER IMPORTANT
- **NEVER** include features, concepts, or implementations that have not been explicitly discussed
- **NEVER** add speculative or "nice-to-have" features to documentation or CLAUDE.md
- **ONLY** document what has been explicitly requested and implemented

### Package Management
- **NEVER** write dependencies directly in package.json
- **ALWAYS** use CLI commands to install packages

## Current Implementation

### Endpoints
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

## Testing Guidelines

### Test Structure
Tests are organized as:
- Unit tests: Located alongside source files (`*.spec.ts`)
- Integration tests: Located in `test/integration/`
- Fixtures: Reusable test data generators in `test/fixtures/`

### Running Tests
```bash
npm test                  # Run all tests
npm run test:watch       # Run tests in watch mode
npm run test:cov         # Run tests with coverage
npm run test:e2e         # Run integration tests
```

### Writing Tests
- **ONLY test what exists** - Don't write tests for unimplemented features
- Use fixtures for consistent test data generation
- Mock external dependencies in unit tests
- Clean database state between tests
- Test actual behavior, not implementation details

### Test Coverage Requirements
- Minimum 80% coverage for services
- All endpoints must have integration tests
- Test both success and error cases

See `test/test-guidelines.md` for detailed testing guidelines