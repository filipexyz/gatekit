#!/usr/bin/env ts-node

import * as fs from 'fs/promises';
import * as path from 'path';
import { ExtractedContract } from '../extractors/contract-extractor.service';
import { CaseConverter } from '../../src/common/utils/case-converter';

interface GeneratedCLI {
  commands: Record<string, string>; // category -> command file content
  index: string;
  config: string;
  packageJson: string;
  readme: string;
}

export class CLIGenerator {

  async generateFromContracts(contractsPath: string, outputDir: string): Promise<void> {
    console.log('🔧 Generating permission-aware CLI from contracts...');

    // Load contracts
    const contractsContent = await fs.readFile(contractsPath, 'utf-8');
    const contracts: ExtractedContract[] = JSON.parse(contractsContent);

    // Generate CLI components
    const cli = this.generateCLI(contracts);

    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });

    // Write generated files
    await this.writeCLIFiles(outputDir, cli);

    console.log(`✅ CLI generated successfully in ${outputDir}`);
    console.log(`🎯 Permission-aware commands: ${contracts.length}`);
    console.log(`📦 Ready for: cd ${outputDir} && npm publish`);
  }

  private generateCLI(contracts: ExtractedContract[]): GeneratedCLI {
    const groups = this.groupContractsByCategory(contracts);

    const commands: Record<string, string> = {};
    Object.entries(groups).forEach(([category, contracts]) => {
      commands[CaseConverter.toValidFilename(category)] = this.generateCommandFile(category, contracts);
    });

    return {
      commands,
      index: this.generateIndex(contracts, groups),
      config: this.generateConfig(),
      packageJson: this.generatePackageJson(),
      readme: this.generateReadme(contracts, groups),
    };
  }

  private generateCommandFile(category: string, contracts: ExtractedContract[]): string {
    const commandMethods = contracts.map(contract => this.generateCommand(contract)).join('\n\n');

    return `// Generated ${category} commands for GateKit CLI
// DO NOT EDIT - This file is auto-generated from backend contracts

import { Command } from 'commander';
import { GateKit } from '@gatekit/sdk';
import { loadConfig, formatOutput, handleError } from '../lib/utils';

export function create${CaseConverter.toValidClassName(category)}Command(): Command {
  const ${CaseConverter.toValidPropertyName(category)} = new Command('${CaseConverter.toValidFilename(category)}');

${commandMethods}

  return ${CaseConverter.toValidPropertyName(category)};
}

${this.generateCommandHelpers()}
`;
  }

  private generateCommand(contract: ExtractedContract): string {
    const { contractMetadata, path } = contract;
    const commandParts = contractMetadata.command.split(' ');
    const subCommand = commandParts[commandParts.length - 1]; // 'projects create' -> 'create'
    const category = contractMetadata.category || 'general';

    // Extract path parameters for SDK method call
    const pathParams = this.extractPathParameters(path);

    const options = Object.entries(contractMetadata.options || {}).map(([name, opt]) => {
      const defaultStr = opt.default ? `, '${String(opt.default)}'` : '';
      const optionDef = `    .option('--${name} <value>', '${opt.description}'${defaultStr})`;
      return optionDef;
    }).join('\n');

    // Add path parameter options
    const pathParamOptions = pathParams.map(param => {
      const defaultValue = param === 'projectSlug' ? "'default'" : 'undefined';
      return `    .option('--${param} <value>', '${param} parameter', ${defaultValue})`;
    }).join('\n');

    const allOptions = [options, pathParamOptions].filter(Boolean).join('\n');

    // Convert kebab-case to camelCase for method calls
    const camelCaseMethod = subCommand.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const methodCall = subCommand === 'create' ? 'create' : subCommand === 'list' ? 'list' : camelCaseMethod;

    return `  ${CaseConverter.toValidPropertyName(category)}
    .command('${subCommand}')
    .description('${contractMetadata.description}')
${allOptions}
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const config = await loadConfig();

        // Check permissions${contractMetadata.requiredScopes && contractMetadata.requiredScopes.length > 0 ? `
        const hasPermission = await checkPermissions(config, ${JSON.stringify(contractMetadata.requiredScopes)});
        if (!hasPermission) {
          console.error('❌ Insufficient permissions. Required: ${contractMetadata.requiredScopes?.join(', ')}');
          process.exit(1);
        }` : '\n        // No permissions required for this command'}

        const gk = new GateKit(config);

        ${this.generateMethodCall(subCommand, methodCall, category, contractMetadata, pathParams)}

        formatOutput(result, options.json);
      } catch (error) {
        handleError(error);
      }
    });`;
  }

  private generateMethodCall(subCommand: string, methodCall: string, category: string, contractMetadata: any, pathParams: string[]): string {
    // Convert category to valid SDK namespace (dynamically, no hardcoded keys)
    const sdkNamespace = CaseConverter.toValidPropertyName(category);

    // Build path parameter arguments
    const pathArgs = pathParams.map(param => `options.${param} || 'default'`).join(', ');

    // If no input type specified, method takes only path parameters
    if (!contractMetadata.inputType) {
      const args = pathParams.length > 0 ? pathArgs : '';
      return `const result = await gk.${sdkNamespace}.${methodCall}(${args});`;
    }

    // Build data object by mapping CLI options to DTO properties using contract metadata
    // Exclude path parameters from DTO object
    const dtoObject = this.buildDtoObjectFromContract(contractMetadata.options || {}, pathParams);

    // Combine path parameters and data object
    const allArgs = pathParams.length > 0 ? `${pathArgs}, ${dtoObject}` : dtoObject;
    return `const result = await gk.${sdkNamespace}.${methodCall}(${allArgs});`;
  }

  private extractPathParameters(path: string): string[] {
    const matches = path.match(/:([a-zA-Z][a-zA-Z0-9]*)/g);
    return matches ? matches.map(match => match.substring(1)) : [];
  }

  private buildDtoObjectFromContract(options: Record<string, any>, pathParams: string[] = []): string {
    if (!options || Object.keys(options).length === 0) {
      return '{}';
    }

    // Check if we have target patterns
    const hasTargetPattern = options.target?.type === 'target_pattern';
    const hasTargetsPattern = options.targets?.type === 'targets_pattern';
    const hasTextShortcut = options.text?.type === 'string';

    if (hasTargetPattern || hasTargetsPattern || hasTextShortcut) {
      return this.buildPatternBasedDto(options);
    }

    // Handle standard type conversion
    // Filter out path parameters from DTO options
    const dtoOptions = Object.keys(options).filter(key => !pathParams.includes(key));
    const optionEntries = dtoOptions.map(key => {
      const option = options[key];

      if (option.type === 'object') {
        // Parse JSON strings for object types
        return `      ${key}: options.${key} ? JSON.parse(options.${key}) : undefined`;
      } else if (option.type === 'boolean') {
        // Convert string to boolean
        return `      ${key}: options.${key} === 'true' || options.${key} === true`;
      } else if (option.type === 'number') {
        // Convert string to number
        return `      ${key}: options.${key} ? parseInt(options.${key}) : undefined`;
      } else {
        // String type or default
        return `      ${key}: options.${key}`;
      }
    }).join(',\n');

    return `{
${optionEntries}
        }`;
  }

  private buildPatternBasedDto(options: Record<string, any>): string {
    return `buildMessageDto(options)`;
  }


  private generateCommandHelpers(): string {
    return `
// Target pattern parsing helpers
function parseTargetPattern(pattern: string): { platformId: string; type: string; id: string } {
  const parts = pattern.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid target pattern. Expected format: platformId:type:id');
  }

  const [platformId, type, id] = parts;

  if (!['user', 'channel', 'group'].includes(type)) {
    throw new Error('Invalid target type. Must be: user, channel, or group');
  }

  return { platformId, type, id };
}

function parseTargetsPattern(pattern: string): Array<{ platformId: string; type: string; id: string }> {
  const patterns = pattern.split(',').map(p => p.trim());
  return patterns.map(parseTargetPattern);
}

function buildMessageDto(options: any): any {
  const dto: any = {};

  // Handle targets - priority: targets pattern > target pattern > content object
  if (options.targets) {
    dto.targets = parseTargetsPattern(options.targets);
  } else if (options.target) {
    dto.targets = [parseTargetPattern(options.target)];
  }

  // Handle content - priority: text shortcut > content object
  if (options.text) {
    dto.content = { text: options.text };
  } else if (options.content) {
    dto.content = JSON.parse(options.content);
  }

  // Handle optional fields
  if (options.options) {
    dto.options = JSON.parse(options.options);
  }
  if (options.metadata) {
    dto.metadata = JSON.parse(options.metadata);
  }

  return dto;
}

async function checkPermissions(config: any, requiredScopes: string[]): Promise<boolean> {
  try {
    // We need to add a permissions method to the SDK
    // For now, use axios directly
    const axios = require('axios');
    const client = axios.create({
      baseURL: config.apiUrl,
      headers: config.apiKey ? { 'X-API-Key': config.apiKey } : { 'Authorization': \`Bearer \${config.jwtToken}\` }
    });

    const response = await client.get('/api/v1/auth/whoami');
    const userPermissions = response.data.permissions || [];

    return requiredScopes.every(scope => userPermissions.includes(scope));
  } catch {
    return false; // Assume no permission if check fails
  }
}`;
  }

  private generateIndex(contracts: ExtractedContract[], groups: Record<string, ExtractedContract[]>): string {
    const commandImports = Object.keys(groups).map(category =>
      `import { create${CaseConverter.toValidClassName(category)}Command } from './commands/${CaseConverter.toValidFilename(category)}';`
    ).join('\n');

    const commandRegistrations = Object.keys(groups).map(category =>
      `  program.addCommand(create${CaseConverter.toValidClassName(category)}Command());`
    ).join('\n');

    return `#!/usr/bin/env node
// Generated CLI entry point for GateKit
// DO NOT EDIT - This file is auto-generated from backend contracts

import { Command } from 'commander';
${commandImports}

const program = new Command();

program
  .name('gatekit')
  .description('GateKit Universal Messaging Gateway CLI')
  .version('1.0.0');

// Add permission-aware commands
${commandRegistrations}

// Quick send command (AI-optimized)
program
  .command('send')
  .description('Quick message send (AI-optimized)')
  .requiredOption('--project <slug>', 'Project slug')
  .requiredOption('--platform <id>', 'Platform ID')
  .requiredOption('--target <id>', 'Target ID')
  .requiredOption('--text <message>', 'Message text')
  .option('--wait', 'Wait for completion')
  .option('--json', 'JSON output')
  .action(async (options) => {
    // Implementation here - delegate to SDK
  });

program.parse(process.argv);
`;
  }

  private generateConfig(): string {
    return `// Generated config management for GateKit CLI
// DO NOT EDIT - This file is auto-generated

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface CLIConfig {
  apiUrl: string;
  apiKey?: string;
  jwtToken?: string;
  defaultProject?: string;
  outputFormat?: 'table' | 'json';
}

export async function loadConfig(): Promise<CLIConfig> {
  const config: CLIConfig = {
    apiUrl: process.env.GATEKIT_API_URL || 'https://api.gatekit.dev',
    apiKey: process.env.GATEKIT_API_KEY,
    jwtToken: process.env.GATEKIT_JWT_TOKEN,
    defaultProject: process.env.GATEKIT_DEFAULT_PROJECT,
    outputFormat: (process.env.GATEKIT_OUTPUT_FORMAT as any) || 'table',
  };

  // Try to load from config file
  try {
    const configPath = path.join(os.homedir(), '.gatekit', 'config.json');
    const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    Object.assign(config, fileConfig);
  } catch {
    // Config file doesn't exist or is invalid - use environment/defaults
  }

  return config;
}

export function formatOutput(data: any, json: boolean = false): void {
  if (json) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    // Simple table output for humans
    if (Array.isArray(data)) {
      console.table(data);
    } else {
      console.log(data);
    }
  }
}

export function handleError(error: any): void {
  if (error.code === 'INSUFFICIENT_PERMISSIONS') {
    console.error(\`❌ Permission denied: \${error.message}\`);
    console.error('💡 Contact your administrator to request additional permissions.');
  } else if (error.code === 'AUTHENTICATION_ERROR') {
    console.error('❌ Authentication failed. Check your API key or token.');
  } else {
    console.error(\`❌ Error: \${error.message}\`);
  }
  process.exit(1);
}
`;
  }

  private generatePackageJson(): string {
    return JSON.stringify({
      name: '@gatekit/cli',
      version: '1.0.0',
      description: 'Official CLI for GateKit universal messaging gateway',
      main: 'dist/index.js',
      bin: {
        gatekit: 'dist/index.js'
      },
      files: ['dist'],
      scripts: {
        build: 'tsc',
        prepublishOnly: 'npm run build'
      },
      dependencies: {
        '@gatekit/sdk': 'file:../sdk',
        'commander': '^11.0.0',
        'axios': '^1.6.0'
      },
      peerDependencies: {
        'typescript': '>=4.5.0'
      },
      keywords: ['gatekit', 'cli', 'messaging', 'universal'],
      author: 'GateKit',
      license: 'MIT',
      repository: {
        type: 'git',
        url: 'https://github.com/filipexyz/gatekit-cli.git'
      },
      homepage: 'https://github.com/filipexyz/gatekit-cli',
      bugs: {
        url: 'https://github.com/filipexyz/gatekit-cli/issues'
      }
    }, null, 2);
  }

  private groupContractsByCategory(contracts: ExtractedContract[]): Record<string, ExtractedContract[]> {
    return contracts.reduce((groups, contract) => {
      const category = contract.contractMetadata.category || 'General';
      if (!groups[category]) groups[category] = [];
      groups[category].push(contract);
      return groups;
    }, {} as Record<string, ExtractedContract[]>);
  }

  private async writeCLIFiles(outputDir: string, cli: GeneratedCLI): Promise<void> {
    const srcDir = path.join(outputDir, 'src');
    const commandsDir = path.join(srcDir, 'commands');
    const libDir = path.join(srcDir, 'lib');

    await fs.mkdir(commandsDir, { recursive: true });
    await fs.mkdir(libDir, { recursive: true });

    // Write command files
    await Promise.all(
      Object.entries(cli.commands).map(([category, content]) =>
        fs.writeFile(path.join(commandsDir, `${category}.ts`), content)
      )
    );

    // Write core files
    await Promise.all([
      fs.writeFile(path.join(srcDir, 'index.ts'), cli.index),
      fs.writeFile(path.join(libDir, 'utils.ts'), cli.config),
      fs.writeFile(path.join(outputDir, 'package.json'), cli.packageJson),
      fs.writeFile(path.join(outputDir, 'tsconfig.json'), this.generateTSConfig()),
      fs.writeFile(path.join(outputDir, 'README.md'), cli.readme),
    ]);
  }

  private generateTSConfig(): string {
    return JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
        lib: ['ES2020'],
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist']
    }, null, 2);
  }

  private generateReadme(contracts: ExtractedContract[], groups: Record<string, ExtractedContract[]>): string {
    const commandExamples = Object.entries(groups)
      .map(([category, contracts]) => {
        const examples = contracts.slice(0, 3).map(contract => {
          const example = contract.contractMetadata.examples?.[0];
          return `### ${contract.contractMetadata.description}
\`\`\`bash
${example?.command || `gatekit ${contract.contractMetadata.command} --help`}
\`\`\``;
        }).join('\n\n');

        return `## ${category}\n\n${examples}`;
      }).join('\n\n');

    return `# @gatekit/cli

Official CLI for GateKit - Universal messaging gateway.

## Installation

\`\`\`bash
npm install -g @gatekit/cli
\`\`\`

## Authentication

### API Key (Recommended)
\`\`\`bash
export GATEKIT_API_KEY="gk_live_your_api_key_here"
export GATEKIT_API_URL="https://api.gatekit.dev"
\`\`\`

### Environment Setup
\`\`\`bash
# Production
export GATEKIT_API_URL="https://api.gatekit.dev"

# Local development
export GATEKIT_API_URL="http://localhost:3000"
\`\`\`

## Quick Start

\`\`\`bash
# Send a message with simplified pattern
gatekit messages send --projectSlug my-project \\
  --target "platformId:user:123" \\
  --text "Hello from GateKit!"

# List received messages
gatekit messages list --projectSlug my-project --limit 10

# Get message statistics
gatekit messages stats --projectSlug my-project
\`\`\`

## Revolutionary Pattern System

Instead of complex JSON, use simple patterns:

\`\`\`bash
# Single target
--target "platformId:user:253191879"

# Multiple targets
--targets "platform1:user:123,platform2:channel:456"

# Text shortcut
--text "Your message"
\`\`\`

## Command Reference

${commandExamples}

## Permission System

The CLI automatically checks your permissions and shows only available commands:

\`\`\`bash
# If you lack permissions, you'll see:
❌ Insufficient permissions. Required: messages:send

# Get your current permissions:
gatekit auth whoami
\`\`\`

## Advanced Usage

### Complex Content
\`\`\`bash
gatekit messages send --projectSlug my-project \\
  --target "platformId:user:123" \\
  --content '{"text":"Hello","buttons":[{"text":"Click me"}]}'
\`\`\`

### Filtering Messages
\`\`\`bash
# Filter by platform
gatekit messages list --platform telegram

# Filter by date range
gatekit messages list --startDate "2024-01-01T00:00:00Z"

# Get failed messages
gatekit messages sent --status failed
\`\`\`

## Error Handling

The CLI provides helpful error messages:
- **Pattern validation**: Invalid target format guidance
- **Permission errors**: Clear permission requirements
- **API errors**: Detailed error descriptions

## Links

[![View on GitHub](https://img.shields.io/badge/View%20on-GitHub-blue?logo=github)](https://github.com/filipexyz/gatekit-cli)
[![View on npm](https://img.shields.io/badge/View%20on-npm-red?logo=npm)](https://www.npmjs.com/package/@gatekit/cli)

- **📦 Repository**: [github.com/filipexyz/gatekit-cli](https://github.com/filipexyz/gatekit-cli)
- **📥 npm Package**: [@gatekit/cli](https://www.npmjs.com/package/@gatekit/cli)
- **🔧 SDK Package**: [@gatekit/sdk](https://www.npmjs.com/package/@gatekit/sdk)
- **📚 Documentation**: [docs.gatekit.dev](https://docs.gatekit.dev)
- **🎛️ Dashboard**: [app.gatekit.dev](https://app.gatekit.dev)

`;
  }
}

// CLI execution
async function main() {
  const generator = new CLIGenerator();
  const contractsPath = path.join(__dirname, '../../generated/contracts/contracts.json');
  const outputDir = path.join(__dirname, '../../generated/cli');

  await generator.generateFromContracts(contractsPath, outputDir);
}

if (require.main === module) {
  main().catch(console.error);
}