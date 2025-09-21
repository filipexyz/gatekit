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

### Health Endpoint
- `GET /api/v1/health` - Basic health check