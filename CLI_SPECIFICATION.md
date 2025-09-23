# GateKit CLI Specification

## Overview

The **GateKit CLI** (`@gatekit/cli`) is a command-line interface that provides a user-friendly wrapper around the GateKit SDK. It handles configuration management, interactive prompts, and output formatting while delegating all API operations to the SDK.

## Architecture Principles

### Design Goals
1. **Thin Wrapper** - All API logic delegated to `@gatekit/sdk`
2. **User Experience** - Interactive prompts, helpful error messages, rich output
3. **AI Agent Optimized** - Predictable commands, JSON output, exit codes
4. **Configuration Management** - Handle credentials, defaults, environment variables
5. **Zero Business Logic** - Only presentation and user interaction concerns

### Dependency Hierarchy
```
GateKit CLI
    ↓ depends on
GateKit SDK
    ↓ calls
GateKit Backend API
```

### Package Structure
```
@gatekit/cli/
├── src/
│   ├── commands/        # Command implementations
│   ├── config/          # Configuration management
│   ├── ui/              # User interface utilities
│   ├── types/           # CLI-specific types
│   └── index.ts         # CLI entry point
├── __tests__/           # Test suite
└── docs/               # CLI documentation
```

## Command Architecture

### Command Pattern
Each command follows a consistent pattern:

```typescript
// Reference: /root/gatekit-cli/src/commands/projects.ts
import { GateKit } from '@gatekit/sdk';

export function createProjectsCommand(): Command {
  const projects = new Command('projects');

  projects
    .command('list')
    .action(async (options) => {
      try {
        // 1. Load configuration
        const config = await loadCliConfig();

        // 2. Create SDK client
        const gk = new GateKit(config);

        // 3. Call SDK method
        const projects = await gk.projects.list();

        // 4. Format output (CLI concern only)
        if (options.json) {
          printJson(projects);
        } else {
          printProjectsTable(projects);
        }
      } catch (error) {
        handleError(error);
      }
    });

  return projects;
}
```

### Configuration Management

#### CLI Configuration (Not SDK concern)
```typescript
// Reference: /root/gatekit-cli/src/lib/config.ts
interface CliConfig {
  // SDK configuration
  sdk: {
    apiUrl: string;
    apiKey?: string;
    jwtToken?: string;
    timeout?: number;
  };

  // CLI-specific settings
  defaultProject?: string;
  outputFormat?: 'table' | 'json';
  confirmPrompts?: boolean;
}
```

#### Environment Variables
```bash
# SDK configuration
GATEKIT_API_URL=https://api.gatekit.dev
GATEKIT_API_KEY=gk_live_your_key_here

# CLI-specific
GATEKIT_DEFAULT_PROJECT=my-project
GATEKIT_OUTPUT_FORMAT=json
```

#### Configuration Priority
1. Command-line flags (`--api-key`)
2. Environment variables (`GATEKIT_API_KEY`)
3. Configuration file (`~/.gatekit/config.yaml`)
4. Interactive prompts (if applicable)

## Command Reference

### Authentication Commands
```bash
gatekit auth login [--api-key <key>] [--jwt-token <token>]
gatekit auth status
gatekit auth logout
```

**Implementation Strategy:**
- Store credentials in CLI config file
- Pass to SDK as constructor parameters
- Never store credentials in SDK

### Project Commands
```bash
gatekit projects list [--json]
gatekit projects show <slug> [--json]
gatekit projects create [--name <name>] [--slug <slug>] [--environment <env>]
gatekit projects update <slug> [options]
gatekit projects delete <slug> [--force]
gatekit projects default <slug>
```

**Implementation Pattern:**
```typescript
// CLI handles: argument parsing, prompts, output formatting
// SDK handles: HTTP requests, data validation, error responses

const projectData = await promptForProjectData(options);
const project = await gk.projects.create(projectData);  // SDK call
formatProjectOutput(project, options.json);              // CLI formatting
```

### Platform Commands
```bash
gatekit platforms list [--project <slug>] [--json]
gatekit platforms discord [--token <token>] [--project <slug>]
gatekit platforms telegram [--token <token>] [--project <slug>]
gatekit platforms update <id> [options]
gatekit platforms delete <id> [--force]
gatekit platforms webhook <id>
gatekit platforms health [--json]
gatekit platforms supported [--json]
```

### Message Commands
```bash
# Interactive sending
gatekit messages send [--project <slug>]

# Quick send (AI-optimized)
gatekit send --project <slug> --platform <id> --target <id> --text <text> [--wait]

# Status and management
gatekit messages status <jobId> [--project <slug>] [--watch] [--json]
gatekit messages retry <jobId> [--project <slug>]
gatekit messages queue [--project <slug>] [--json]
```

**AI Agent Optimization:**
```typescript
// Reference: /root/gatekit-cli/src/index.ts:119-171
// Quick send command with minimal parameters
// --wait flag for synchronous workflows
// --json flag for machine-readable output
// Proper exit codes for automation
```

## User Interface Components

### Interactive Prompts
**Reference: `/root/gatekit-cli/src/commands/auth.ts:47-75`**

```typescript
import inquirer from 'inquirer';

// Platform selection
const { platform } = await inquirer.prompt([
  {
    type: 'list',
    name: 'platform',
    message: 'Select platform:',
    choices: supportedPlatforms.map(p => ({
      name: p.displayName,
      value: p.name
    }))
  }
]);
```

### Output Formatting
**Reference: `/root/gatekit-cli/src/utils/output.ts`**

```typescript
// Table output for humans
export function printProjectsTable(projects: Project[]): void {
  const headers = ['Name', 'Slug', 'Environment', 'Default'];
  const rows = projects.map(p => [p.name, p.slug, p.environment, p.isDefault ? '✅' : '']);
  printTable(headers, rows);
}

// JSON output for automation
export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}
```

### Error Handling
```typescript
// Convert SDK errors to user-friendly messages
export function handleError(error: unknown): void {
  if (error instanceof AuthenticationError) {
    error('Authentication failed. Run `gatekit auth login` to configure credentials.');
  } else if (error instanceof RateLimitError) {
    warning('Rate limit exceeded. Please try again later.');
  } else {
    error(`Operation failed: ${error.message}`);
  }
  process.exit(1);
}
```

## Testing Strategy

### CLI Testing (Isolated from SDK)
```typescript
// Mock SDK completely
vi.mock('@gatekit/sdk', () => ({
  GateKit: vi.fn().mockImplementation(() => ({
    projects: {
      list: vi.fn().mockResolvedValue(mockProjects)
    }
  }))
}));

test('projects list command formats output correctly', async () => {
  const output = await executeCommand(['projects', 'list']);

  expect(output).toContain('Test Project');
  expect(output).toContain('development');
});
```

### Configuration Testing
```typescript
// Use memfs for file system isolation
beforeEach(() => {
  vol.reset();
  delete process.env.GATEKIT_API_KEY;
  delete process.env.GATEKIT_BASE_URL;
});

test('loads config from file', async () => {
  vol.fromJSON({
    '/root/.gatekit/config.yaml': 'apiUrl: https://test.api\napiKey: test-key'
  });

  const config = await loadCliConfig();

  expect(config.sdk.apiUrl).toBe('https://test.api');
  expect(config.sdk.apiKey).toBe('test-key');
});
```

## Implementation Phases

### Phase 1: SDK Development
1. Extract API client from current CLI
2. Add proper TypeScript interfaces
3. Implement namespaced API groups
4. Add comprehensive error handling
5. Write unit tests
6. Publish to npm as `@gatekit/sdk`

### Phase 2: CLI Refactor
1. Install `@gatekit/sdk` as dependency
2. Refactor commands to use SDK
3. Remove duplicate API logic
4. Enhance user experience features
5. Add CLI-specific tests
6. Publish updated `@gatekit/cli`

### Phase 3: Advanced Features
1. Configuration profiles
2. Plugin system for custom commands
3. Shell completions
4. Interactive tutorials

## Quality Gates

### SDK Requirements
- ✅ 100% TypeScript coverage
- ✅ Zero `any` types
- ✅ >90% test coverage
- ✅ <50KB bundle size
- ✅ Tree-shakeable exports
- ✅ Browser compatibility

### CLI Requirements
- ✅ All commands working
- ✅ Interactive prompts functional
- ✅ Error handling comprehensive
- ✅ Help system complete
- ✅ >85% test coverage
- ✅ AI agent optimized

## Migration Path

### Risk Mitigation
1. **Parallel Development** - Build SDK alongside existing CLI
2. **Feature Parity** - Maintain exact same functionality
3. **Gradual Migration** - Replace CLI internals incrementally
4. **Comprehensive Testing** - Verify behavior equivalence

### Success Metrics
1. **No Feature Regression** - All current commands work identically
2. **Improved Architecture** - Clean separation of concerns
3. **Enhanced Testability** - Faster, more reliable tests
4. **Market Expansion** - SDK opens new integration opportunities

This specification provides a complete roadmap for creating professional-grade packages with proper separation of concerns and industry-standard architecture patterns.