# Permission-Aware Dynamic CLI Architecture

## 🎯 Vision: Intelligent CLI that Adapts to User Permissions

Instead of showing all commands and failing at runtime, the CLI dynamically shows only commands the user can actually execute based on their API key permissions.

## Current vs Future State

### Current Behavior (Static CLI)
```bash
gatekit --help
# Shows ALL commands regardless of permissions

gatekit projects create --name "Test"
# ❌ Error: Access denied. Please check your permissions.
```

### Target Behavior (Permission-Aware CLI)
```bash
gatekit --help
# Shows ONLY commands user can execute

# If user has 'projects:read' but not 'projects:write':
Commands:
  projects list    ✅ Available
  projects show    ✅ Available
  projects create  🚫 Hidden (no projects:write permission)
  projects delete  🚫 Hidden (no projects:write permission)
```

## Architecture Components

### 1. Permission Discovery System

#### Backend API Endpoint
```typescript
// src/auth/auth.controller.ts
@Controller('api/v1/auth')
export class AuthController {

  @Get('permissions')
  @Public() // Uses current token from header
  async getCurrentPermissions(@Req() request: Request): Promise<PermissionResponse> {
    const token = extractTokenFromRequest(request);
    const permissions = await this.authService.getTokenPermissions(token);

    return {
      scopes: permissions.scopes,
      projectAccess: permissions.projectAccess,
      features: permissions.features,
      expires: permissions.expires,
      keyInfo: {
        name: permissions.keyName,
        created: permissions.created,
        lastUsed: permissions.lastUsed
      }
    };
  }
}
```

#### Permission Response Type
```typescript
interface PermissionResponse {
  scopes: string[];                    // ['messages:send', 'projects:read']
  projectAccess: ProjectAccess[];      // Which projects user can access
  features: FeatureFlags;              // Feature-based permissions
  expires?: string;                    // Token expiration
  keyInfo: {
    name: string;
    created: string;
    lastUsed?: string;
  };
}

interface ProjectAccess {
  projectSlug: string;
  permissions: string[];               // Project-specific permissions
}

interface FeatureFlags {
  canCreateProjects: boolean;
  canManageApiKeys: boolean;
  canConfigurePlatforms: boolean;
  canSendMessages: boolean;
  canViewAnalytics: boolean;
}
```

### 2. Dynamic Command Registration

#### Permission-Based Command Builder
```typescript
// src/cli/command-builder.ts
export class PermissionAwareCommandBuilder {
  private permissions: PermissionResponse;

  constructor(permissions: PermissionResponse) {
    this.permissions = permissions;
  }

  buildCommands(): Command[] {
    const commands: Command[] = [];

    // Projects commands
    if (this.hasScope('projects:read')) {
      commands.push(this.buildProjectsListCommand());
      commands.push(this.buildProjectsShowCommand());
    }

    if (this.hasScope('projects:write')) {
      commands.push(this.buildProjectsCreateCommand());
      commands.push(this.buildProjectsUpdateCommand());
      commands.push(this.buildProjectsDeleteCommand());
    }

    // Messages commands
    if (this.hasScope('messages:send')) {
      commands.push(this.buildSendMessageCommand());
    }

    if (this.hasScope('messages:read')) {
      commands.push(this.buildMessageStatusCommand());
      commands.push(this.buildQueueMetricsCommand());
    }

    // API Keys commands (only if user can manage keys)
    if (this.hasScope('keys:manage')) {
      commands.push(this.buildApiKeysCommands());
    }

    return commands;
  }

  private hasScope(scope: string): boolean {
    return this.permissions.scopes.includes(scope);
  }

  private hasProjectAccess(projectSlug: string, permission: string): boolean {
    const project = this.permissions.projectAccess.find(p => p.projectSlug === projectSlug);
    return project?.permissions.includes(permission) ?? false;
  }
}
```

### 3. Intelligent Help System

#### Permission-Aware Help
```typescript
// Generated help output based on permissions
export class SmartHelpSystem {
  generateHelp(permissions: PermissionResponse): string {
    let help = `
GateKit CLI - Showing commands available with your current permissions

Authentication:
  API Key: ${permissions.keyInfo.name}
  Expires: ${permissions.expires || 'Never'}

Available Commands:
`;

    if (this.hasScope(permissions, 'projects:read')) {
      help += `
Projects (Read):
  gatekit projects list              List all projects
  gatekit projects show <slug>       Show project details
`;
    }

    if (this.hasScope(permissions, 'projects:write')) {
      help += `
  gatekit projects create            Create new project
  gatekit projects update <slug>     Update project
  gatekit projects delete <slug>     Delete project
`;
    }

    if (this.hasScope(permissions, 'messages:send')) {
      help += `
Messages:
  gatekit send                      Quick send message
  gatekit messages send             Interactive message sending
`;
    }

    // Show hidden commands with explanation
    const hiddenCommands = this.getHiddenCommands(permissions);
    if (hiddenCommands.length > 0) {
      help += `
Hidden Commands (insufficient permissions):
${hiddenCommands.map(cmd => `  ${cmd.command.padEnd(30)} Requires: ${cmd.requiredScope}`).join('\n')}

To access these commands, contact your administrator to update your API key permissions.
`;
    }

    return help;
  }
}
```

## 4. Caching & Performance

### Permission Caching Strategy
```typescript
// src/cli/permission-cache.ts
export class PermissionCache {
  private cache: Map<string, CachedPermissions> = new Map();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes

  async getPermissions(apiKey: string): Promise<PermissionResponse> {
    const cached = this.cache.get(apiKey);

    if (cached && Date.now() - cached.timestamp < this.TTL) {
      return cached.permissions;
    }

    // Fetch fresh permissions
    const permissions = await this.fetchPermissions(apiKey);

    this.cache.set(apiKey, {
      permissions,
      timestamp: Date.now()
    });

    return permissions;
  }

  invalidate(apiKey: string): void {
    this.cache.delete(apiKey);
  }
}
```

## 5. Contract-Driven Architecture

### Enhanced Controller Decorators
```typescript
// src/common/decorators/cli-contract.decorator.ts
export function CliContract(options: CliContractOptions) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const metadata: CliContractMetadata = {
      command: options.command,
      description: options.description,
      requiredScopes: options.requiredScopes,
      options: options.options,
      examples: options.examples,
      hidden: options.hidden || false
    };

    Reflect.defineMetadata('cli-contract', metadata, target, propertyKey);
  };
}

// Usage on controllers:
@Post('projects')
@RequireScopes('projects:write')
@CliContract({
  command: 'projects create',
  description: 'Create a new project',
  requiredScopes: ['projects:write'],
  options: {
    name: { required: true, description: 'Project name' },
    environment: { choices: ['development', 'staging', 'production'] }
  },
  examples: ['gatekit projects create --name "My Project"']
})
create(@Body() createProjectDto: CreateProjectDto) {
  return this.projectsService.create(createProjectDto);
}
```

## 6. Build System Architecture

### Source Protection via Compilation
```typescript
// tools/build-targets.ts
export async function buildSDK() {
  // 1. Extract contracts from backend controllers
  const contracts = await extractContracts('./src/**/*.controller.ts');

  // 2. Generate clean SDK (no backend source)
  const sdkCode = generateSDK(contracts);

  // 3. Compile to standalone package
  await compileToPackage('dist/sdk', {
    name: '@gatekit/sdk',
    code: sdkCode,
    types: generateSDKTypes(contracts),
    dependencies: ['axios']
  });
}

export async function buildCLI() {
  // 1. Use same contracts
  const contracts = await extractContracts('./src/**/*.controller.ts');

  // 2. Generate permission-aware CLI
  const cliCode = generatePermissionAwareCLI(contracts);

  // 3. Compile to standalone package
  await compileToPackage('dist/cli', {
    name: '@gatekit/cli',
    code: cliCode,
    dependencies: ['@gatekit/sdk', 'commander', 'inquirer'],
    bin: { gatekit: './index.js' }
  });
}
```

### What Gets Exported vs Hidden
```
Backend Source (NEVER EXPORTED):
├── src/controllers/     # Business logic - PRIVATE
├── src/services/       # Implementation - PRIVATE
├── src/guards/         # Security logic - PRIVATE
└── tools/generators/   # Build tools - PRIVATE

Published Packages (CLEAN):
├── @gatekit/sdk        # Generated API client - PUBLIC
├── @gatekit/cli        # Generated CLI tool - PUBLIC
└── Documentation       # Generated docs - PUBLIC
```

## Implementation Phases

### Phase 1: Permission Discovery (Backend)
**Reference: `/root/gatekit/dev/backend/src/common/guards/app-auth.guard.ts`**

```typescript
// Add to existing auth system
@Controller('api/v1/auth')
export class AuthController {
  @Get('whoami')
  async getCurrentUser(@GetCurrentUser() user: AuthenticatedUser): Promise<UserInfo> {
    return {
      permissions: user.scopes,
      projects: await this.getAccessibleProjects(user),
      keyInfo: user.keyInfo,
      limits: user.rateLimits
    };
  }
}
```

### Phase 2: Dynamic CLI Generation
```typescript
// Generated CLI startup sequence
async function initializeCLI() {
  try {
    // 1. Load config
    const config = await loadConfig();

    // 2. Fetch permissions (with caching)
    const permissions = await fetchUserPermissions(config);

    // 3. Build permission-aware command tree
    const commandTree = buildCommands(permissions);

    // 4. Register only available commands
    program.addCommands(commandTree);

  } catch (error) {
    // Graceful degradation: show all commands with warnings
    program.addCommands(buildAllCommands());
    warning('Could not verify permissions. Some commands may fail.');
  }
}
```

### Phase 3: Enhanced UX Features

#### Smart Error Messages
```typescript
// When user tries unavailable command
export function handlePermissionError(command: string, requiredScope: string) {
  error(`Command '${command}' requires permission: ${requiredScope}`);
  info(`Current permissions: ${getCurrentPermissions().join(', ')}`);
  info(`Contact your administrator to request '${requiredScope}' permission.`);

  // Suggest alternative commands
  const alternatives = suggestAlternativeCommands(command, getCurrentPermissions());
  if (alternatives.length > 0) {
    info(`Available alternatives: ${alternatives.join(', ')}`);
  }
}
```

#### Permission Status Command
```bash
gatekit auth status
# Output:
✅ Authenticated: Development Test Key
🔑 Permissions:
   ✅ messages:send    - Send messages
   ✅ messages:read    - View message status
   ✅ projects:read    - List and view projects
   ❌ projects:write   - Create/modify projects
   ❌ keys:manage      - Manage API keys

📊 Usage Stats:
   Messages sent: 1,247
   Last activity: 2 hours ago

⚠️  Missing permissions for 4 commands. Run 'gatekit auth permissions' for details.
```

## Contract-Driven Permission System

### Enhanced Controller Metadata
```typescript
// Reference: /root/gatekit/dev/backend/src/projects/projects.controller.ts
@Controller('api/v1/projects')
export class ProjectsController {

  @Get()
  @RequireScopes('projects:read')
  @CliContract({
    command: 'projects list',
    description: 'List all projects you have access to',
    requiredScopes: ['projects:read'],
    category: 'Projects',
    priority: 'high', // Show prominently in help
    alternatives: ['projects show'] // If this is hidden, suggest these
  })
  findAll() { /* ... */ }

  @Post()
  @RequireScopes('projects:write')
  @CliContract({
    command: 'projects create',
    description: 'Create a new project',
    requiredScopes: ['projects:write'],
    category: 'Projects',
    priority: 'medium',
    dangerLevel: 'low', // Visual indicator in CLI
    confirmationRequired: false
  })
  create(@Body() createProjectDto: CreateProjectDto) { /* ... */ }

  @Delete(':slug')
  @RequireScopes('projects:write')
  @CliContract({
    command: 'projects delete',
    description: 'Delete a project permanently',
    requiredScopes: ['projects:write'],
    category: 'Projects',
    priority: 'low',
    dangerLevel: 'high', // Visual warning
    confirmationRequired: true,
    alternatives: ['projects list', 'projects show']
  })
  remove(@Param('slug') slug: string) { /* ... */ }
}
```

## Advanced Permission Features

### Project-Scoped Permissions
```typescript
// Some users can only access specific projects
interface ProjectScopedPermissions {
  global: string[];                    // ['messages:send'] - all projects
  projects: {
    [projectSlug: string]: string[];   // { 'proj-1': ['messages:send'], 'proj-2': ['messages:read'] }
  };
}

// CLI adapts:
gatekit projects list
# Shows only projects user can access

gatekit send --project restricted-project
# ❌ Hidden if user has no access to this project
```

### Feature-Based Permissions
```typescript
interface FeaturePermissions {
  canCreateProjects: boolean;
  canManageTeamMembers: boolean;
  canAccessAnalytics: boolean;
  canConfigureBilling: boolean;
  maxProjectsAllowed: number;
  maxMessagesPerMonth: number;
}

// CLI shows different options based on features:
gatekit projects create
# Prompts for team members only if canManageTeamMembers = true
```

### Time-Based Permissions
```typescript
interface TimeBasedPermissions {
  businessHoursOnly: boolean;         // Hide commands outside business hours
  emergencyBypass: boolean;          // Show all commands during incidents
  maintenanceMode: boolean;          // Hide write operations during maintenance
}
```

## Build System for Source Protection

### Multi-Target Compilation
```typescript
// tools/build-system.ts
export class GateKitBuildSystem {

  async buildSDK(): Promise<void> {
    // 1. Extract pure API contracts
    const contracts = await this.extractAPIContracts();

    // 2. Generate clean SDK code (no backend implementation)
    const sdkCode = this.generateSDKFromContracts(contracts);

    // 3. Compile to standalone package
    await this.compilePackage('dist/sdk', {
      name: '@gatekit/sdk',
      main: 'index.js',
      types: 'index.d.ts',
      files: ['index.js', 'index.d.ts', 'README.md'], // Only compiled outputs
      source: sdkCode
    });
  }

  async buildCLI(): Promise<void> {
    // 1. Extract CLI contracts + permission metadata
    const cliContracts = await this.extractCLIContracts();

    // 2. Generate permission-aware CLI
    const cliCode = this.generatePermissionAwareCLI(cliContracts);

    // 3. Compile to standalone executable
    await this.compilePackage('dist/cli', {
      name: '@gatekit/cli',
      bin: { gatekit: './cli.js' },
      dependencies: { '@gatekit/sdk': '^1.0.0' },
      files: ['cli.js', 'README.md'],
      source: cliCode
    });
  }

  async buildDocs(): Promise<void> {
    // Generate docs from same contracts
    const contracts = await this.extractAllContracts();
    const docs = this.generateDocumentation(contracts);

    await this.writeFiles('dist/docs', docs);
  }
}
```

### Contract Extraction Process
```typescript
// tools/contract-extractor.ts
export async function extractContracts(): Promise<Contract[]> {
  // 1. Parse TypeScript AST from backend controllers
  const controllers = await loadControllers('./src/**/*.controller.ts');

  // 2. Extract metadata from decorators
  const contracts = [];

  for (const controller of controllers) {
    for (const method of controller.methods) {
      const cliMetadata = Reflect.getMetadata('cli-contract', method);
      const scopeMetadata = Reflect.getMetadata('require-scopes', method);
      const routeMetadata = Reflect.getMetadata('route', method);

      if (cliMetadata) {
        contracts.push({
          // API contract
          path: routeMetadata.path,
          method: routeMetadata.method,
          dto: method.parameters[0]?.type,

          // CLI contract
          command: cliMetadata.command,
          requiredScopes: scopeMetadata?.scopes || [],
          options: cliMetadata.options,

          // Generation metadata
          sdkMethod: this.generateSDKMethodName(routeMetadata),
          cliHandler: this.generateCLIHandler(cliMetadata)
        });
      }
    }
  }

  return contracts;
}
```

## User Experience Enhancements

### Progressive Disclosure
```bash
# Basic user sees simplified interface
gatekit --help
Commands:
  send              Send a message
  status            Check message status
  help              Get help

# Power user sees full interface
gatekit --help --advanced
Commands:
  Projects:
    projects list         List projects
    projects create       Create project
  Messages:
    send                 Quick send
    messages send        Interactive send
    messages status      Check status
    messages queue       Queue metrics
```

### Smart Suggestions
```bash
gatekit projects create
# ❌ Command hidden (no projects:write permission)
# 💡 Did you mean: 'gatekit projects list' (available with your permissions)?
# 💡 To create projects, request 'projects:write' permission from your administrator.
```

### Permission Upgrade Hints
```bash
gatekit auth upgrade-guide
# Output:
Your API key has limited permissions. To unlock more features:

🔓 Request these permissions from your administrator:
   projects:write  → Create and modify projects
   keys:manage     → Generate and manage API keys
   platforms:write → Configure platform integrations

📧 Email template:
   "Please grant the following GateKit permissions to my API key:
   - projects:write (to create new projects)
   - keys:manage (to manage API keys)"
```

## Testing Strategy

### Permission-Aware Testing
```typescript
// __tests__/permission-scenarios.test.ts
describe('Permission-based CLI behavior', () => {

  test('read-only user sees limited commands', async () => {
    mockPermissions(['projects:read', 'messages:read']);

    const commands = await buildCLI();

    expect(commands).toIncludeCommand('projects list');
    expect(commands).toIncludeCommand('messages status');
    expect(commands).not.toIncludeCommand('projects create');
    expect(commands).not.toIncludeCommand('projects delete');
  });

  test('full-access user sees all commands', async () => {
    mockPermissions(['projects:write', 'messages:send', 'keys:manage']);

    const commands = await buildCLI();

    expect(commands).toIncludeAllCommands();
  });

  test('graceful degradation when permission check fails', async () => {
    mockPermissionCheckFailure();

    const commands = await buildCLI();

    // Should show all commands with warnings
    expect(commands).toIncludeAllCommands();
    expect(mockConsole.warn).toHaveBeenCalledWith(
      expect.stringContaining('Could not verify permissions')
    );
  });
});
```

---

This architecture creates an **adaptive CLI** that provides the perfect user experience for each permission level while maintaining zero source code exposure through strategic compilation targets.