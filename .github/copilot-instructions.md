# GateKit Backend - Copilot Instructions

## Project Overview

**GateKit** is a universal omni-channel messaging gateway providing a single API to send/receive messages across Discord, Telegram, and WhatsApp.

**Tech Stack:** NestJS (Node.js 20), TypeScript, Prisma ORM, PostgreSQL, Redis, Bull Queue

**Architecture:** Contract-driven development where `@SdkContract` decorators auto-generate SDK, CLI, and n8n packages.

## Critical Code Review Rules

### NEVER Accept Unplanned Features

- Reject code that adds features not explicitly discussed in the issue/PR description
- Reject speculative or "nice-to-have" additions
- Reject new features added to documentation before implementation

### DTO and Response Type Patterns (CRITICAL!)

**Must follow SEMANTIC_PLAYBOOK.md exactly:**

- ✅ **Input DTOs:** Must end with `Dto` suffix (e.g., `CreateProjectDto`)
- ✅ **Response types:** Must end with `Response` suffix (e.g., `ProjectResponse`)
- ❌ **NEVER** mix suffixes (reject `ProjectDto` for responses)
- ✅ All DTOs must be **classes**, never interfaces
- ✅ Input DTOs must use `class-validator` decorators
- ✅ Response DTOs go in `src/<module>/dto/<entity>-response.dto.ts`

**Examples to flag:**

```typescript
// ❌ BAD - Response with Dto suffix
export class AuthResponseDto {}

// ✅ GOOD - Response with Response suffix
export class AuthResponse {}

// ❌ BAD - Interface instead of class
export interface ProjectResponse {}

// ✅ GOOD - Class
export class ProjectResponse {}
```

### @SdkContract Decorator Requirements

Every API endpoint MUST have complete `@SdkContract` metadata:

**Required fields:**

- `command` - CLI command name (e.g., 'projects create')
- `description` - Human-readable description
- `category` - Grouping for docs/CLI (e.g., 'Projects')
- `requiredScopes` - Array of scopes or [] for public
- `outputType` - Response class name
- `examples` - At least one example with command

**Required for POST/PATCH endpoints:**

- `inputType` - Input DTO class name
- `options` - Object defining all CLI flags with `required`, `description`, `type`

**Example to accept:**

```typescript
@SdkContract({
  command: 'projects create',
  description: 'Create a new project',
  category: 'Projects',
  requiredScopes: ['projects:write'],
  inputType: 'CreateProjectDto',
  outputType: 'ProjectResponse',
  options: {
    name: {
      required: true,
      description: 'Project name',
      type: 'string'
    }
  },
  examples: [
    {
      description: 'Create project',
      command: 'gatekit projects create --name "My Project"'
    }
  ]
})
```

**Examples to flag:**

```typescript
// ❌ Missing options field (CLI won't work)
@SdkContract({
  command: 'auth signup',
  outputType: 'AuthResponse'
  // Missing: options, examples, requiredScopes
})

// ❌ Using Dto suffix for response
@SdkContract({
  outputType: 'AuthResponseDto'  // Should be AuthResponse
})
```

### Security Patterns (Defense-in-Depth)

**Every protected endpoint MUST have:**

1. **Guards on controller:**

```typescript
@UseGuards(AppAuthGuard, ProjectAccessGuard)
@RequireScopes(['scope:write'])
```

2. **AuthContext parameter:**

```typescript
async method(
  @Param('projectId') projectId: string,
  @Body() dto: InputDto,
  @AuthContextParam() authContext: AuthContext  // REQUIRED
)
```

3. **Service receives and validates AuthContext:**

```typescript
async method(
  projectId: string,
  dto: InputDto,
  authContext: AuthContext  // REQUIRED, not optional
): Promise<ResponseType> {
  // FIRST LINE: Validate access
  const project = await SecurityUtil.getProjectWithAccess(
    this.prisma,
    projectId,
    authContext,
    'operation description'
  );
  // ... implementation
}
```

**Flag these security violations:**

```typescript
// ❌ Missing AuthContext parameter
async create(@Body() dto: CreateDto) { }

// ❌ Optional AuthContext (defeats security)
async create(dto: CreateDto, authContext?: AuthContext) { }

// ❌ Not validating project access
async create(dto: CreateDto, authContext: AuthContext) {
  // Missing SecurityUtil.getProjectWithAccess()
  return this.prisma.create(...);
}
```

## Testing Patterns

### Unit Tests

- All service methods must provide mock `authContext`
- Never bypass security by calling services directly without auth context

### Integration Tests

- Must use real databases (cleaned between tests)
- **NEVER** run generators (`generate:*`) in tests
- Must expect exact status codes (never `[401, 403]`)
- Must expect exact error messages

**Flag these test violations:**

```typescript
// ❌ Running generators in test
await execAsync('npm run generate:cli');

// ❌ Non-deterministic assertions
expect([401, 403]).toContain(res.status);

// ❌ Missing auth context in service test
await service.create(projectId, data); // Should include mockAuthContext
```

## Project Architecture

### Key Directories

- `src/auth/` - Authentication (Auth0 + local JWT)
- `src/projects/` - Project management
- `src/platforms/` - Platform integrations (Discord, Telegram, WhatsApp)
- `src/messages/` - Message queue and delivery
- `src/webhooks/` - Outgoing webhook notifications
- `src/common/` - Guards, decorators, utilities
- `test/integration/` - E2E tests
- `tools/` - Contract extraction and code generation

### Key Files to Reference

- `SEMANTIC_PLAYBOOK.md` - DTO and contract conventions (READ THIS!)
- `test/CLAUDE.md` - Testing guidelines
- `prisma/schema.prisma` - Database schema

### Generated Code

- **NEVER** accept edits to `generated/` directory
- Generated code comes from `@SdkContract` decorators
- Changes must be made in controllers, not generated files

## Common Violations to Flag

1. ❌ Response type with `Dto` suffix instead of `Response`
2. ❌ Missing `options` field in @SdkContract for POST/PATCH endpoints
3. ❌ Missing `requiredScopes` or `examples` in @SdkContract
4. ❌ Optional `authContext` parameter (must be required)
5. ❌ Missing `SecurityUtil.getProjectWithAccess()` in services
6. ❌ Running generators in test files
7. ❌ Non-deterministic test assertions
8. ❌ Manual `package.json` edits (use npm commands)
9. ❌ Interface instead of class for DTOs
10. ❌ Adding unplanned features

## When Reviewing Code

1. Check DTO naming follows `Dto`/`Response` pattern
2. Verify @SdkContract has all required fields
3. Confirm security context flows through all layers
4. Ensure tests don't run generators
5. Validate exact error message expectations in tests
6. Reject any code adding features not in PR description
