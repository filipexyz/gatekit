# Contract-Driven Development Guide

## Overview

GateKit implements a revolutionary **contract-driven architecture** where SDK and CLI packages are auto-generated from backend API contracts using `@SdkContract` decorators. This ensures perfect synchronization, eliminates duplication, and enables permission-aware dynamic behavior.

## Architecture Flow

```
Backend Controllers (@SdkContract decorators)
    ↓ npm run extract:contracts
Generated Contracts (JSON)
    ↓ npm run generate:sdk
@gatekit/sdk Package (TypeScript API Client)
    ↓ npm run generate:cli
@gatekit/cli Package (Permission-Aware CLI)
    ↓ npm publish
Published NPM Packages
```

## Development Workflow

### 1. Adding New API Endpoints

When adding new controller methods, enhance them with `@SdkContract` decorators:

```typescript
// src/platforms/platforms.controller.ts
import { SdkContract } from '../common/decorators/sdk-contract.decorator';

@Post()
@RequireScopes('platforms:write')
@SdkContract({
  command: 'platforms create',
  description: 'Configure a new platform integration',
  category: 'Platforms',
  requiredScopes: ['platforms:write'],
  options: {
    platform: {
      required: true,
      description: 'Platform type',
      choices: ['discord', 'telegram'],
      type: 'string'
    },
    token: {
      required: true,
      description: 'Platform bot token',
      type: 'string'
    },
    testMode: {
      description: 'Enable test mode',
      default: false,
      type: 'boolean'
    }
  },
  examples: [
    {
      description: 'Add Discord bot',
      command: 'gatekit platforms create --platform discord --token "bot-token"'
    }
  ]
})
async create(@Body() createPlatformDto: CreatePlatformDto) {
  return this.platformsService.create(createPlatformDto);
}
```

### 2. Regenerating Packages

After adding/modifying `@SdkContract` decorators:

```bash
# Regenerate everything
npm run generate:all

# Or step by step
npm run extract:contracts    # Parse controllers → contracts.json
npm run generate:sdk        # Contracts → @gatekit/sdk package
npm run generate:cli        # Contracts → @gatekit/cli package
```

### 3. Publishing Packages

```bash
# Build and publish SDK
cd generated/sdk
npm run build
npm publish

# Build and publish CLI
cd ../cli
npm run build
npm publish
```

## Generated Package Structure

### SDK Package (`generated/sdk/`)
```
@gatekit/sdk/
├── src/
│   ├── client.ts           # Main GateKit class with namespaced APIs
│   ├── types.ts            # TypeScript interfaces
│   ├── errors.ts           # Custom error classes
│   └── index.ts            # Public exports
├── dist/                   # Compiled JavaScript
├── package.json            # NPM package metadata
└── tsconfig.json           # TypeScript configuration
```

**Generated API Structure:**
```typescript
export class GateKit {
  readonly projects: ProjectsAPI;
  readonly platforms: PlatformsAPI;
  readonly messages: MessagesAPI;

  constructor(config: GateKitConfig) { /* ... */ }
}

// Usage:
const gk = new GateKit({ apiKey: 'xxx' });
await gk.projects.create({ name: 'Test' });
await gk.platforms.list();
await gk.messages.send(projectSlug, messageData);
```

### CLI Package (`generated/cli/`)
```
@gatekit/cli/
├── src/
│   ├── index.ts            # CLI entry point with command registration
│   ├── commands/           # Generated command files by category
│   │   ├── projects.ts     # Projects commands
│   │   ├── platforms.ts    # Platform commands
│   │   └── messages.ts     # Message commands
│   └── lib/
│       └── utils.ts        # Config, formatting, error handling
├── dist/                   # Compiled JavaScript
├── package.json            # NPM package with CLI binary
└── tsconfig.json           # TypeScript configuration
```

**Generated CLI Features:**
- **Permission Checking**: Calls `/api/v1/auth/whoami` before every command
- **Dynamic Commands**: Only shows commands user can execute
- **AI Optimization**: `--json`, `--wait`, proper exit codes
- **Error Handling**: Converts API errors to user-friendly messages

## Contract Decorator Reference

### Full `@SdkContract` Options

```typescript
@SdkContract({
  command: string;              // CLI command structure ('platforms create')
  description: string;          // Human-readable description
  category?: string;            // Grouping (becomes API namespace)
  requiredScopes?: string[];    // Permission requirements
  options?: {                   // CLI options/flags
    [key: string]: {
      required?: boolean;       // Required option
      description?: string;     // Help text
      choices?: string[];       // Valid values
      default?: any;           // Default value
      type?: 'string' | 'number' | 'boolean';
    };
  };
  examples?: Array<{           // CLI help examples
    description: string;
    command: string;
  }>;
})
```

### Contract Categories → API Namespaces

| Category | SDK Namespace | CLI Commands |
|----------|---------------|--------------|
| `Projects` | `gk.projects.*` | `gatekit projects *` |
| `Platforms` | `gk.platforms.*` | `gatekit platforms *` |
| `Messages` | `gk.messages.*` | `gatekit messages *` |
| `ApiKeys` | `gk.apiKeys.*` | `gatekit keys *` |

## Permission System Integration

### Permission Discovery API
```bash
GET /api/v1/auth/whoami
```

**Response:**
```json
{
  "authType": "api-key",
  "permissions": ["projects:read", "projects:write", "messages:send"],
  "project": { "id": "...", "slug": "default", "name": "..." },
  "apiKey": { "id": "...", "name": "..." }
}
```

### Permission-Aware CLI Behavior

1. **Startup**: CLI fetches user permissions
2. **Command Registration**: Only registers allowed commands
3. **Runtime Checks**: Double-checks permissions before API calls
4. **Error Handling**: Converts 403s to helpful messages

```typescript
// Generated permission check in every command
const hasPermission = await checkPermissions(config, ["projects:write"]);
if (!hasPermission) {
  console.error('❌ Insufficient permissions. Required: projects:write');
  console.error('💡 Contact your administrator to request additional permissions.');
  process.exit(1);
}
```

## Advanced Features

### AI Agent Optimization

**Quick Send Command** (generated automatically):
```bash
gatekit send --project prod --platform discord-123 --target channel:456 --text "Deploy complete" --wait --json
```

**Features:**
- **`--wait`**: Polls until message delivered
- **`--json`**: Machine-readable output
- **Exit codes**: 0 = success, 1 = failure
- **Minimal flags**: Optimized for automation

### Source Protection

**What Gets Published:**
- ✅ Compiled JavaScript packages only
- ✅ TypeScript definitions for IntelliSense
- ✅ Clean API interfaces

**What Stays Private:**
- ❌ Backend source code (never exported)
- ❌ Internal business logic
- ❌ Database schemas
- ❌ Build tools and generators

### Development Commands

| Command | Purpose | Output |
|---------|---------|---------|
| `npm run extract:contracts` | Parse controllers for `@SdkContract` | `generated/contracts/contracts.json` |
| `npm run generate:sdk` | Create TypeScript SDK package | `generated/sdk/` |
| `npm run generate:cli` | Create permission-aware CLI | `generated/cli/` |
| `npm run generate:all` | Full pipeline execution | Both packages |

## Maintenance Guidelines

### Daily Development Workflow

1. **Add/modify controller endpoints** with `@SdkContract` decorators
2. **Run `npm run generate:all`** to update packages
3. **Test generated packages** work correctly
4. **Commit backend changes** (generators create packages automatically)
5. **Publish packages** when ready for release

### Quality Gates

**Before Publishing:**
- ✅ All generated packages compile without errors
- ✅ SDK bundle size < 50KB
- ✅ CLI startup time < 200ms
- ✅ Zero backend source code in published packages
- ✅ All permission scopes properly configured

### Troubleshooting

**Contract extraction fails:**
- Check `@SdkContract` decorator syntax
- Verify controller imports are correct
- Ensure all referenced modules are available

**SDK compilation fails:**
- Check TypeScript types in generated code
- Verify import paths are correct
- Review API method generation logic

**CLI permission errors:**
- Verify `/api/v1/auth/whoami` endpoint works
- Check API key has required scopes
- Test permission caching logic

**Source code leakage:**
- Never modify generated packages manually
- Always regenerate from contracts
- Validate published packages contain only compiled code

## Future Enhancements

### Planned Features
- **Multi-environment support**: Different CLI builds per environment
- **Plugin system**: Extend CLI with custom commands
- **Interactive tutorials**: Guided setup workflows
- **Advanced caching**: Smart permission and API response caching
- **Bundle optimization**: Tree-shaking and size optimization

### MCP Integration (Future)
The contract system is designed to support multiple client types:
```
Contracts → SDK + CLI + MCP + Documentation + Tests
```

This architecture makes GateKit the most advanced API tooling system in the messaging space, with perfect synchronization and zero maintenance overhead.

## Success Metrics

- **Perfect Sync**: Backend changes automatically reflected in all clients
- **Zero Duplication**: Single source of truth for all API definitions
- **Developer Experience**: Intuitive APIs that feel natural to use
- **Enterprise Ready**: Permission-aware tools suitable for team environments
- **Market Leadership**: Most sophisticated API tooling in messaging space