# GateKit Backend - Semantic Playbook

## Purpose

This document defines the **standardized conventions and patterns** for GateKit backend development to ensure consistency, maintainability, and seamless contract-driven development across the entire codebase.

---

## Table of Contents

1. [File Organization](#file-organization)
2. [DTO Patterns](#dto-patterns)
3. [Response Type Patterns](#response-type-patterns)
4. [@SdkContract Decorator Usage](#sdkcontract-decorator-usage)
5. [Naming Conventions](#naming-conventions)
6. [Type Definition Strategy](#type-definition-strategy)
7. [Security Context Patterns](#security-context-patterns)
8. [Migration Guide](#migration-guide)

---

## File Organization

### Input DTOs

**Location**: `src/<module>/dto/`

**Pattern**:

```
src/
└── <module>/
    └── dto/
        ├── create-<entity>.dto.ts
        ├── update-<entity>.dto.ts
        ├── query-<entity>.dto.ts
        └── <specific-action>.dto.ts
```

**Examples**:

- `src/projects/dto/create-project.dto.ts`
- `src/platforms/dto/update-platform.dto.ts`
- `src/messages/dto/query-messages.dto.ts`
- `src/platforms/dto/send-message.dto.ts`

### Response Types

**Location**: `src/<module>/dto/`

**Pattern**:

```
src/
└── <module>/
    └── dto/
        └── <entity>-response.dto.ts
```

**Examples**:

- `src/webhooks/dto/webhook-response.dto.ts`
- `src/platforms/dto/platform-response.dto.ts`
- `src/messages/dto/message-response.dto.ts`

### Shared Response Types

**Location**: `src/common/types/api-responses.ts`

**Usage**: Only for truly generic responses used across multiple unrelated modules.

**Approved Shared Types**:

- `MessageResponse` - Generic `{ message: string }` response
- Common error response types

---

## DTO Patterns

### Input DTOs (Request Bodies/Query Params)

**MUST use classes** with `class-validator` decorators:

```typescript
import { IsString, IsOptional, IsEnum } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ProjectEnvironment)
  environment?: ProjectEnvironment;
}
```

**Why classes?**

- Required for NestJS validation pipe
- Runtime type checking
- Automatic request validation

### Complex Nested DTOs

For complex nested structures (like SendMessageDto), define all sub-DTOs in the same file:

```typescript
// src/platforms/dto/send-message.dto.ts

export class TargetDto {
  @IsString()
  platformId: string;

  @IsEnum(TargetType)
  type: TargetType;

  @IsString()
  id: string;
}

export class ContentDto {
  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}

export class SendMessageDto {
  @ValidateNested({ each: true })
  @Type(() => TargetDto)
  targets: TargetDto[];

  @ValidateNested()
  @Type(() => ContentDto)
  content: ContentDto;
}
```

---

## Response Type Patterns

### Standard Response Types

**MUST use classes** for all response types referenced in `@SdkContract`:

```typescript
// src/webhooks/dto/webhook-response.dto.ts

export class WebhookResponse {
  id: string;
  projectId: string;
  name: string;
  url: string;
  events: WebhookEventType[];
  secret: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class WebhookDetailResponse extends WebhookResponse {
  stats: {
    total: number;
    successful: number;
    failed: number;
    pending: number;
    successRate: string;
  };
}
```

**Why classes?**

- Consistent with input DTOs
- Better for contract extraction
- Enables future validation decorators if needed
- Supports inheritance patterns

### Entity-Based Responses

For responses that directly map to Prisma entities, create explicit response classes:

```typescript
// src/projects/dto/project-response.dto.ts

export class Project {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  environment: ProjectEnvironment;
  isDefault: boolean;
  settings: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    apiKeys: number;
  };
}
```

**Do NOT** rely on Prisma-generated types in controller signatures.

### List/Paginated Responses

Use consistent pagination response pattern:

```typescript
export class MessageListResponse {
  messages: ReceivedMessage[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}
```

---

## @SdkContract Decorator Usage

### Required Fields

Every API endpoint that should be available in SDK/CLI **MUST** have `@SdkContract`:

```typescript
@Post()
@RequireScopes('platforms:write')
@SdkContract({
  command: 'platforms create',           // REQUIRED: CLI command name
  description: 'Create platform config', // REQUIRED: Human-readable description
  category: 'Platforms',                 // REQUIRED: Grouping for docs/CLI
  requiredScopes: ['platforms:write'],   // REQUIRED: Permission scopes
  inputType: 'CreatePlatformDto',        // OPTIONAL: For request body endpoints
  outputType: 'PlatformResponse',        // REQUIRED: Response type name
  options: { /* ... */ },                // OPTIONAL: CLI option definitions
  examples: [ /* ... */ ],               // REQUIRED: At least one example
})
async create(@Body() dto: CreatePlatformDto) {
  // ...
}
```

### Category Naming

Use these standard category names:

- `Projects` - Project management
- `ApiKeys` - API key operations
- `Platforms` - Platform configuration
- `Messages` - Message sending/receiving
- `Webhooks` - Webhook subscriptions
- `Members` - Team member management
- `Identities` - Identity resolution

### Command Naming Convention

Pattern: `<category-singular> <action>`

**Examples**:

- `projects create`
- `platforms list`
- `messages send`
- `webhooks delete`
- `keys roll`

**Actions**: `create`, `list`, `get`, `update`, `delete`, `send`, `status`, etc.

### Options Definition

Define all CLI options with clear descriptions:

```typescript
options: {
  name: {
    required: true,
    description: 'Platform friendly name',
    type: 'string',
  },
  platform: {
    required: true,
    description: 'Platform type',
    type: 'string',
    choices: ['discord', 'telegram', 'whatsapp-evo'],
  },
  isActive: {
    description: 'Enable platform',
    type: 'boolean',
    default: true,
  },
}
```

### Examples

Provide at least 2-3 practical examples:

```typescript
examples: [
  {
    description: 'Create Discord platform',
    command:
      'gatekit platforms create --platform discord --name "Main Bot" --credentials \'{"token":"BOT_TOKEN"}\'',
  },
  {
    description: 'Create Telegram in test mode',
    command:
      'gatekit platforms create --platform telegram --name "Test Bot" --credentials \'{"token":"BOT_TOKEN"}\' --testMode true',
  },
];
```

---

## Naming Conventions

### Files

| Type         | Pattern                    | Example                   |
| ------------ | -------------------------- | ------------------------- |
| Input DTO    | `<action>-<entity>.dto.ts` | `create-project.dto.ts`   |
| Update DTO   | `update-<entity>.dto.ts`   | `update-platform.dto.ts`  |
| Query DTO    | `query-<entity>.dto.ts`    | `query-messages.dto.ts`   |
| Response DTO | `<entity>-response.dto.ts` | `webhook-response.dto.ts` |
| Controller   | `<module>.controller.ts`   | `platforms.controller.ts` |
| Service      | `<module>.service.ts`      | `platforms.service.ts`    |

### Classes/Interfaces

| Type             | Pattern                  | Example                      |
| ---------------- | ------------------------ | ---------------------------- |
| Input DTO        | `<Action><Entity>Dto`    | `CreateProjectDto`           |
| Update DTO       | `Update<Entity>Dto`      | `UpdatePlatformDto`          |
| Query DTO        | `Query<Entity>Dto`       | `QueryMessagesDto`           |
| Response Type    | `<Entity>Response`       | `WebhookResponse`            |
| List Response    | `<Entity>ListResponse`   | `MessageListResponse`        |
| Detail Response  | `<Entity>DetailResponse` | `WebhookDetailResponse`      |
| Nested Input DTO | `<Entity>Dto`            | `AttachmentDto`, `TargetDto` |

**CRITICAL RULES:**

- ✅ **Input DTOs MUST end with `Dto`** (e.g., `SendMessageDto`, `CreateProjectDto`)
- ✅ **Response types MUST end with `Response`** (e.g., `WebhookResponse`, `MessageListResponse`)
- ❌ **NEVER mix suffixes** (e.g., don't use `MessageDto` for responses or `WebhookRequest` for inputs)

**Why these suffixes?**

- Clear distinction between input and output types
- Prevents accidental misuse (sending a response as input)
- Industry standard (NestJS, Spring Boot, ASP.NET all use this pattern)
- Type safety at compile time

### Enums

```typescript
export enum WebhookEventType {
  MESSAGE_RECEIVED = 'message.received',
  MESSAGE_SENT = 'message.sent',
  MESSAGE_FAILED = 'message.failed',
  BUTTON_CLICKED = 'button.clicked',
  REACTION_ADDED = 'reaction.added',
  REACTION_REMOVED = 'reaction.removed',
}
```

**Pattern**:

- Enum name: PascalCase
- Enum values: SCREAMING_SNAKE_CASE
- String values: kebab-case or dot.notation

---

## Type Definition Strategy

### When to Create Response DTOs

**ALWAYS create explicit response DTOs when**:

1. Type is referenced in `@SdkContract` `outputType`
2. Type is used across multiple controllers
3. Type has complex nested structure
4. Type differs from database entity (transformations applied)

**Example**:

```typescript
// ❌ BAD: Using Prisma type directly in contract
@SdkContract({
  outputType: 'PlatformConfig', // Prisma-generated type
})

// ✅ GOOD: Explicit response DTO
@SdkContract({
  outputType: 'PlatformResponse', // src/platforms/dto/platform-response.dto.ts
})
```

### Type Export Strategy

**Module DTO Index**: Create `index.ts` for easy imports:

```typescript
// src/platforms/dto/index.ts
export * from './create-platform.dto';
export * from './update-platform.dto';
export * from './platform-response.dto';
```

**Usage**:

```typescript
import { CreatePlatformDto, PlatformResponse } from './dto';
```

---

## Security Context Patterns

### AuthContext Requirement

All controller methods accessing project-scoped resources **MUST** use `@AuthContextParam()`:

```typescript
@Post()
@RequireScopes('platforms:write')
async create(
  @Param('projectId') projectId: string,
  @Body() createPlatformDto: CreatePlatformDto,
  @AuthContextParam() authContext: AuthContext,  // REQUIRED
) {
  return this.platformsService.create(projectId, createPlatformDto, authContext);
}
```

### Service Method Signatures

All service methods performing project access **MUST** require `AuthContext`:

```typescript
async create(
  projectId: string,
  dto: CreatePlatformDto,
  authContext: AuthContext,  // REQUIRED: Not optional
): Promise<PlatformResponse> {
  // First line: Validate project access
  const project = await SecurityUtil.getProjectWithAccess(
    this.prisma,
    projectId,
    authContext,
    'platform creation',
  );

  // Rest of implementation...
}
```

**Why mandatory?**

- Defense-in-depth security
- Prevents guard bypass scenarios
- Consistent audit logging
- Type safety enforces usage

---

## Migration Guide

### Current Inconsistencies

| Issue                                              | Current State                        | Target State                                               |
| -------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------- |
| Response types in `api-responses.ts` as interfaces | 15+ types                            | Move to module-specific `dto/*-response.dto.ts` as classes |
| Response types defined inline in controllers       | `PermissionResponse`, `AddMemberDto` | Extract to `dto/*-response.dto.ts`                         |
| Missing `@SdkContract` on some endpoints           | Partial coverage                     | 100% coverage on public endpoints                          |
| Prisma types used directly in contracts            | `Project`, `PlatformConfig`          | Explicit response DTOs                                     |

### Migration Steps

#### Step 1: Audit Current Response Types

```bash
# Find all @SdkContract outputType references
grep -r "outputType:" src/**/*.controller.ts
```

#### Step 2: Create Missing Response DTOs

For each type in `api-responses.ts`:

1. Create `src/<module>/dto/<entity>-response.dto.ts`
2. Convert interface → class
3. Update imports in controllers
4. Verify contract extraction: `npm run extract:contracts:standalone`

**Example Migration**:

```typescript
// BEFORE: src/common/types/api-responses.ts
export interface PlatformResponse {
  id: string;
  platform: string;
  isActive: boolean;
  // ...
}

// AFTER: src/platforms/dto/platform-response.dto.ts
export class PlatformResponse {
  id: string;
  platform: string;
  isActive: boolean;
  // ...
}
```

#### Step 3: Update Controller Imports

```typescript
// BEFORE
import { PlatformResponse } from '../common/types/api-responses';

// AFTER
import { PlatformResponse } from './dto/platform-response.dto';
```

#### Step 4: Verify Contract Extraction

```bash
npm run extract:contracts:standalone
npm run generate:all
```

All types must be found without errors.

---

## Verification Checklist

Before committing code, verify:

- [ ] All input DTOs are **classes** with validation decorators
- [ ] All response types referenced in `@SdkContract` are **classes** in module `dto/` folders
- [ ] No response types defined inline in controllers
- [ ] All `@SdkContract` decorators have required fields
- [ ] All examples in contracts are valid and tested
- [ ] All service methods have `authContext: AuthContext` parameter
- [ ] Contract extraction succeeds: `npm run extract:contracts:standalone`
- [ ] All tests pass: `npm test`

---

## Questions & Clarifications

### Q: Can I use interfaces for response types?

**A**: No. Always use classes for consistency and future extensibility.

### Q: When should I put types in `api-responses.ts`?

**A**: Only for truly generic responses like `MessageResponse` used across many unrelated modules. Module-specific types belong in module DTOs.

### Q: Do I need `@SdkContract` on every endpoint?

**A**: Yes, for all public API endpoints. Internal-only or health check endpoints may skip it.

### Q: Can I use Prisma types directly in contracts?

**A**: No. Always create explicit response DTOs. Prisma types are for database layer only.

### Q: Should nested DTOs be in separate files?

**A**: No. Keep related nested DTOs in the same file as their parent DTO.

---

## Enforcement

This playbook is **mandatory** for:

- All new endpoints
- All new modules
- All response type definitions
- All contract definitions

**CI/CD**: Future enforcement via ESLint rules and contract extraction validation.

---

## Enum Handling for Contract Extraction

### Prisma Enums Must Be Re-exported

Enums from Prisma cannot be directly discovered by the contract extractor. **Always re-export** Prisma enums in a dedicated file:

```typescript
// src/common/types/enums.ts
// Re-export Prisma enums for SDK generation

export enum ProjectRole {
  owner = 'owner',
  admin = 'admin',
  member = 'member',
  viewer = 'viewer',
}

export enum ProjectEnvironment {
  development = 'development',
  staging = 'staging',
  production = 'production',
}
```

**DTOs must import from this file, NOT from @prisma/client:**

```typescript
// ❌ BAD
import { ProjectRole } from '@prisma/client';

// ✅ GOOD
import { ProjectRole } from '../../common/types/enums';
```

**Why?**

- Contract extractor cannot access node_modules/.prisma/client
- Enums need to be in src/ to be auto-discovered
- This pattern works for any external enum types

---

## Module DTO Index Files (Optional Enhancement)

While not required, creating `dto/index.ts` files improves import ergonomics:

```typescript
// src/platforms/dto/index.ts
export * from './create-platform.dto';
export * from './update-platform.dto';
export * from './platform-response.dto';
export * from './send-message.dto';
```

**Usage**:

```typescript
// Without index
import { CreatePlatformDto } from './dto/create-platform.dto';
import { PlatformResponse } from './dto/platform-response.dto';

// With index
import { CreatePlatformDto, PlatformResponse } from './dto';
```

**Current Status**: Not implemented project-wide (optional future enhancement)

---

## Related Documentation

- [CONTRACT_DRIVEN_DEVELOPMENT.md](CONTRACT_DRIVEN_DEVELOPMENT.md) - Contract-first development workflow
- [SDK_SPECIFICATION.md](SDK_SPECIFICATION.md) - TypeScript SDK architecture
- [CLI_SPECIFICATION.md](CLI_SPECIFICATION.md) - CLI design patterns
- [test/CLAUDE.md](test/CLAUDE.md) - Testing conventions

---

**Last Updated**: 2025-10-01
**Version**: 1.0.0
**Status**: Active Standard
