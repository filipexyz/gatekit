#!/usr/bin/env ts-node

import * as fs from 'fs/promises';
import * as path from 'path';
import { ExtractedContract } from '../extractors/contract-extractor.service';
import { CaseConverter } from '../../src/common/utils/case-converter';
import { TemplateUtils } from './template-utils';
import packageJson from '../../package.json';

interface GeneratedCLI {
  commands: Record<string, string>; // category -> command file content
  index: string;
  config: string;
  packageJson: string;
  messageUtils: string; // Message parsing utilities
  mcpCommand: string; // MCP server command
  contracts: ExtractedContract[]; // Keep for README generation
  groups: Record<string, ExtractedContract[]>; // Keep for README generation
}

export class CLIGenerator {
  async generateFromContracts(
    contractsPath: string,
    outputDir: string,
  ): Promise<void> {
    console.log('🔧 Generating permission-aware CLI from contracts...');

    // Load contracts
    const contractsContent = await fs.readFile(contractsPath, 'utf-8');
    const contracts: ExtractedContract[] = JSON.parse(contractsContent);

    // Validate contract structure
    if (!Array.isArray(contracts) || contracts.length === 0) {
      throw new Error('Invalid contracts file: empty or not an array');
    }

    // Get platform metadata for platform options
    const platformMetadata = contracts[0]?.platformMetadata || {};
    const platformCount = Object.keys(platformMetadata).length;
    console.log(`🎯 Found ${platformCount} platforms with metadata`);

    // Generate CLI components
    const cli = this.generateCLI(contracts, platformMetadata);

    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });

    // Write generated files
    await this.writeCLIFiles(outputDir, cli);

    console.log(`✅ CLI generated successfully in ${outputDir}`);
    console.log(`🎯 Permission-aware commands: ${contracts.length}`);
    console.log(`📦 Ready for: cd ${outputDir} && npm publish`);
  }

  private generateCLI(
    contracts: ExtractedContract[],
    platformMetadata: Record<string, any>,
  ): GeneratedCLI {
    const groups = this.groupContractsByCategory(contracts);

    const commands: Record<string, string> = {};
    Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([category, contracts]) => {
        commands[CaseConverter.toValidFilename(category)] =
          this.generateCommandFile(category, contracts, platformMetadata);
      });

    return {
      commands,
      index: this.generateIndex(contracts, groups),
      config: this.generateConfig(),
      packageJson: this.generatePackageJson(),
      messageUtils: this.generateMessageUtils(platformMetadata),
      mcpCommand: this.generateMcpCommand(contracts),
      contracts,
      groups,
    };
  }

  private generateCommandFile(
    category: string,
    contracts: ExtractedContract[],
    platformMetadata: Record<string, any>,
  ): string {
    const commandMethods = contracts
      .map((contract) => this.generateCommand(contract, platformMetadata))
      .join('\n\n');

    // Check if any command in this category uses pattern-based DTO (has target/targets patterns)
    const needsMessageUtils = contracts.some((contract) => {
      const options = contract.contractMetadata?.options || {};
      return Object.values(options).some(
        (opt: any) =>
          opt.type === 'target_pattern' || opt.type === 'targets_pattern',
      );
    });

    const messageUtilsImport = needsMessageUtils
      ? `import { buildMessageDto } from '../lib/message-utils';`
      : '';

    return `// Generated ${category} commands for GateKit CLI
// DO NOT EDIT - This file is auto-generated from backend contracts

import { Command } from 'commander';
import { GateKit } from '@gatekit/sdk';
import { loadConfig, formatOutput, handleError } from '../lib/utils';
${messageUtilsImport}

export function create${CaseConverter.toValidClassName(category)}Command(): Command {
  const ${CaseConverter.toValidPropertyName(category)} = new Command('${CaseConverter.toValidFilename(category)}');

${commandMethods}

  return ${CaseConverter.toValidPropertyName(category)};
}

${this.generateCommandHelpers(platformMetadata, needsMessageUtils)}
`;
  }

  private generateCommand(
    contract: ExtractedContract,
    platformMetadata: Record<string, any>,
  ): string {
    const { contractMetadata, path } = contract;
    const commandParts = contractMetadata.command.split(' ');
    const subCommand = commandParts[commandParts.length - 1]; // 'projects create' -> 'create'
    const category = contractMetadata.category || 'general';

    // Extract path parameters for SDK method call
    const pathParams = this.extractPathParameters(path);

    const options = Object.entries(contractMetadata.options || {})
      .map(([name, opt]) => {
        const defaultStr =
          opt.default !== undefined && typeof opt.default !== 'object'
            ? // eslint-disable-next-line @typescript-eslint/no-base-to-string
              `, '${String(opt.default)}'`
            : '';
        const optionDef = `    .option('--${name} <value>', '${opt.description}'${defaultStr})`;
        return optionDef;
      })
      .join('\n');

    // Add path parameter options (skip if already defined in contract options)
    const existingOptions = Object.keys(contractMetadata.options || {});
    const pathParamOptions = pathParams
      .filter((param) => !existingOptions.includes(param))
      .map((param) => {
        // Make project param optional with env var default
        if (param === 'project') {
          return `    .option('--project <value>', 'Project (uses GATEKIT_DEFAULT_PROJECT if not provided)')`;
        }
        return `    .option('--${param} <value>', '${param} parameter', undefined)`;
      })
      .join('\n');

    // Add platform-specific options (only for message sending commands)
    const platformOptions = this.generatePlatformOptions(
      contractMetadata,
      platformMetadata,
    );

    const allOptions = [options, pathParamOptions, platformOptions]
      .filter(Boolean)
      .join('\n');

    // Convert kebab-case to camelCase for method calls
    const camelCaseMethod = subCommand.replace(/-([a-z])/g, (_, letter) =>
      letter.toUpperCase(),
    );
    const methodCall =
      subCommand === 'create'
        ? 'create'
        : subCommand === 'list'
          ? 'list'
          : camelCaseMethod;

    return `  ${CaseConverter.toValidPropertyName(category)}
    .command('${subCommand}')
    .description('${contractMetadata.description}')
${allOptions}
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const config = await loadConfig();

        // Check permissions${
          contractMetadata.requiredScopes &&
          contractMetadata.requiredScopes.length > 0
            ? `
        const hasPermission = await checkPermissions(config, ${JSON.stringify(contractMetadata.requiredScopes)});
        if (!hasPermission) {
          console.error('❌ Insufficient permissions. Required: ${contractMetadata.requiredScopes?.join(', ')}');
          process.exit(1);
        }`
            : '\n        // No permissions required for this command'
        }

        const gk = new GateKit(config);

        ${this.generateMethodCall(subCommand, methodCall, category, contractMetadata, pathParams)}

        formatOutput(result, options.json);
      } catch (error) {
        handleError(error);
      }
    });`;
  }

  private generateMethodCall(
    subCommand: string,
    methodCall: string,
    category: string,
    contractMetadata: any,
    pathParams: string[],
  ): string {
    // Convert category to valid SDK namespace (dynamically, no hardcoded keys)
    const sdkNamespace = CaseConverter.toValidPropertyName(category);

    // Separate project params from other path params
    const projectParams = pathParams.filter((p) => p === 'project');
    const otherParams = pathParams.filter((p) => p !== 'project');

    // Build path parameter arguments for non-project params
    const pathArgs = otherParams.map((param) => `options.${param}`).join(', ');

    // If no input type specified
    if (!contractMetadata.inputType) {
      // Method only takes options with optional project
      if (projectParams.length > 0) {
        const optionsObj = `{ project: options.project || config.defaultProject }`;
        return otherParams.length > 0
          ? `const result = await gk.${sdkNamespace}.${methodCall}(${pathArgs}, ${optionsObj});`
          : `const result = await gk.${sdkNamespace}.${methodCall}(${optionsObj});`;
      }
      // No project, only other params
      const args = otherParams.length > 0 ? pathArgs : '';
      return `const result = await gk.${sdkNamespace}.${methodCall}(${args});`;
    }

    // Build data object by mapping CLI options to DTO properties
    const dtoObject = this.buildDtoObjectFromContract(
      contractMetadata.options || {},
      pathParams,
      projectParams.length > 0,
    );

    // Combine other params and data object
    const allArgs =
      otherParams.length > 0 ? `${pathArgs}, ${dtoObject}` : dtoObject;
    return `const result = await gk.${sdkNamespace}.${methodCall}(${allArgs});`;
  }

  private extractPathParameters(path: string): string[] {
    const matches = path.match(/:([a-zA-Z][a-zA-Z0-9]*)/g);
    return matches ? matches.map((match) => match.substring(1)) : [];
  }

  private buildDtoObjectFromContract(
    options: Record<string, any>,
    pathParams: string[] = [],
    hasProject: boolean = false,
  ): string {
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
    const dtoOptions = Object.keys(options).filter(
      (key) => !pathParams.includes(key),
    );
    const optionEntries = dtoOptions
      .map((key) => {
        const option = options[key];

        if (option.type === 'object') {
          // Parse JSON strings for object types with try-catch
          return `      ${key}: options.${key} ? (() => { try { return JSON.parse(options.${key}); } catch (e) { throw new Error(\`Invalid JSON for --${key}: \${e instanceof Error ? e.message : String(e)}\`); } })() : undefined`;
        } else if (option.type === 'array') {
          // Split comma-separated values into array
          return `      ${key}: options.${key} ? (typeof options.${key} === 'string' ? options.${key}.split(',').map((v: string) => v.trim()) : options.${key}) : undefined`;
        } else if (option.type === 'boolean') {
          // Convert string to boolean, preserve undefined when not provided
          return `      ${key}: options.${key} !== undefined ? (options.${key} === 'true' || options.${key} === true) : undefined`;
        } else if (option.type === 'number') {
          // Convert string to number with NaN check
          return `      ${key}: options.${key} ? (() => { const val = parseInt(options.${key}, 10); if (isNaN(val)) throw new Error(\`Invalid number for --${key}: "\${options.${key}}"\`); return val; })() : undefined`;
        } else {
          // String type or default
          return `      ${key}: options.${key}`;
        }
      })
      .join(',\n');

    // Add project field if needed
    if (hasProject) {
      const projectEntry = optionEntries
        ? `,\n      project: options.project || config.defaultProject`
        : `      project: options.project || config.defaultProject`;
      return `{
${optionEntries}${projectEntry}
        }`;
    }

    return `{
${optionEntries}
        }`;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private buildPatternBasedDto(options: Record<string, any>): string {
    return `buildMessageDto(options)`;
  }

  private generateCommandHelpers(
    platformMetadata: Record<string, any>,
    needsMessageUtils: boolean,
  ): string {
    // Only include checkPermissions helper (always needed)
    // Message utils are now in separate module
    return `
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

  private generateMessageUtils(platformMetadata: Record<string, any>): string {
    // Build schema lookup for array detection
    const schemaLookup: Record<string, Record<string, any>> = {};
    for (const [platformName, metadata] of Object.entries(platformMetadata)) {
      if (metadata.optionsSchema?.properties) {
        schemaLookup[platformName] = metadata.optionsSchema.properties;
      }
    }

    return `// Message parsing utilities for GateKit CLI
// Auto-generated - DO NOT EDIT

// Platform options schema (for array detection and object types)
interface PropertySchema {
  type: string;
  description?: string;
  format?: string;
  items?: { type: string; format?: string };
}

const PLATFORM_SCHEMAS: Record<string, Record<string, PropertySchema>> = ${JSON.stringify(schemaLookup, null, 2)};

// Target pattern parsing helpers
export interface TargetPattern {
  platformId: string;
  type: string;
  id: string;
}

export function parseTargetPattern(pattern: string): TargetPattern {
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

export function parseTargetsPattern(pattern: string): TargetPattern[] {
  const patterns = pattern.split(',').map(p => p.trim());
  return patterns.map(parseTargetPattern);
}

interface MessageOptions {
  targets?: string;
  target?: string;
  text?: string;
  content?: string;
  options?: string;
  metadata?: string;
  [key: string]: unknown; // For platform-specific options
}

interface MessageDto {
  targets?: TargetPattern[];
  content?: Record<string, unknown>;
  options?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export function buildMessageDto(options: MessageOptions): any {
  const dto: MessageDto = {};

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
    try {
      dto.content = JSON.parse(options.content);
    } catch (e) {
      throw new Error(\`Invalid JSON for --content: \${e instanceof Error ? e.message : String(e)}\`);
    }
  }

  // Parse platform-specific options from dotted flags (e.g., --email.cc)
  const platformOptions = parsePlatformOptions(options);
  if (platformOptions) {
    dto.content = dto.content || {};
    dto.content.platformOptions = platformOptions;
  }

  // Handle optional fields with error handling
  if (options.options) {
    try {
      dto.options = JSON.parse(options.options);
    } catch (e) {
      throw new Error(\`Invalid JSON for --options: \${e instanceof Error ? e.message : String(e)}\`);
    }
  }
  if (options.metadata) {
    try {
      dto.metadata = JSON.parse(options.metadata);
    } catch (e) {
      throw new Error(\`Invalid JSON for --metadata: \${e instanceof Error ? e.message : String(e)}\`);
    }
  }

  return dto;
}

function parsePlatformOptions(options: MessageOptions): Record<string, Record<string, unknown>> | undefined {
  const platformOptions: Record<string, Record<string, unknown>> = {};

  // Find all dotted options (e.g., email.cc, email.bcc)
  for (const [key, value] of Object.entries(options)) {
    if (typeof key === 'string' && key.includes('.')) {
      const [platform, prop] = key.split('.');

      if (!platformOptions[platform]) {
        platformOptions[platform] = {};
      }

      // Get schema for this property to determine type
      const propSchema = PLATFORM_SCHEMAS[platform]?.[prop];

      if (propSchema?.type === 'object') {
        // Handle object types (like headers: Record<string, string>)
        try {
          platformOptions[platform][prop] = JSON.parse(value as string);
        } catch (e) {
          throw new Error(\`Invalid JSON for --\${platform}.\${prop}: \${e instanceof Error ? e.message : String(e)}\`);
        }
      } else if (propSchema?.type === 'array') {
        // Handle array types (split on comma)
        if (typeof value === 'string' && value.includes(',')) {
          platformOptions[platform][prop] = value.split(',').map((v: string) => v.trim());
        } else {
          // Single value becomes single-element array
          platformOptions[platform][prop] = [value];
        }
      } else {
        // Handle scalar types (string, number, boolean)
        platformOptions[platform][prop] = value;
      }
    }
  }

  return Object.keys(platformOptions).length > 0 ? platformOptions : undefined;
}
`;
  }

  private generateIndex(
    contracts: ExtractedContract[],
    groups: Record<string, ExtractedContract[]>,
  ): string {
    const commandImports = Object.keys(groups)
      .sort()
      .map(
        (category) =>
          `import { create${CaseConverter.toValidClassName(category)}Command } from './commands/${CaseConverter.toValidFilename(category)}';`,
      )
      .join('\n');

    const commandRegistrations = Object.keys(groups)
      .sort()
      .map(
        (category) =>
          `  program.addCommand(create${CaseConverter.toValidClassName(category)}Command());`,
      )
      .join('\n');

    // Add MCP command import and registration
    const mcpImport = `import { createMcpCommand } from './commands/mcp';`;
    const mcpRegistration = `  program.addCommand(createMcpCommand());`;

    return `#!/usr/bin/env node
// Generated CLI entry point for GateKit
// DO NOT EDIT - This file is auto-generated from backend contracts

import { Command } from 'commander';
import { saveConfig, getConfigValue, listConfig } from './lib/utils';
${commandImports}
${mcpImport}

const program = new Command();

program
  .name('gatekit')
  .description('GateKit Universal Messaging Gateway CLI')
  .version('${packageJson.version}');

// Config command
const config = new Command('config');
config.description('Manage CLI configuration');

config
  .command('set')
  .description('Set a configuration value')
  .argument('<key>', 'Configuration key (apiUrl, apiKey, defaultProject, outputFormat)')
  .argument('<value>', 'Configuration value')
  .action(async (key: string, value: string) => {
    try {
      const validKeys = ['apiUrl', 'apiKey', 'defaultProject', 'outputFormat'];
      if (!validKeys.includes(key)) {
        console.error(\`❌ Invalid key. Valid keys: \${validKeys.join(', ')}\`);
        process.exit(1);
      }

      await saveConfig(key, value);
      console.log(\`✅ Set \${key} = \${key === 'apiKey' ? '***' : value}\`);
    } catch (error) {
      console.error(\`❌ Failed to save config: \${error instanceof Error ? error.message : String(error)}\`);
      process.exit(1);
    }
  });

config
  .command('get')
  .description('Get a configuration value')
  .argument('<key>', 'Configuration key')
  .action(async (key: string) => {
    try {
      const value = await getConfigValue(key);
      if (value === undefined) {
        console.log(\`\${key} is not set\`);
      } else {
        console.log(\`\${key} = \${key === 'apiKey' ? '***' : value}\`);
      }
    } catch (error) {
      console.error(\`❌ Failed to get config: \${error instanceof Error ? error.message : String(error)}\`);
      process.exit(1);
    }
  });

config
  .command('list')
  .description('List all configuration values')
  .action(async () => {
    try {
      const config = await listConfig();
      if (Object.keys(config).length === 0) {
        console.log('No configuration set');
      } else {
        console.log('Current configuration:');
        for (const [key, value] of Object.entries(config)) {
          console.log(\`  \${key} = \${key === 'apiKey' ? '***' : value}\`);
        }
      }
    } catch (error) {
      console.error(\`❌ Failed to list config: \${error instanceof Error ? error.message : String(error)}\`);
      process.exit(1);
    }
  });

program.addCommand(config);

// Add permission-aware commands
${commandRegistrations}

// Add MCP server command
${mcpRegistration}

program.parse(process.argv);
`;
  }

  private generateConfig(): string {
    return `// Generated config management for GateKit CLI
// DO NOT EDIT - This file is auto-generated

import * as fsSync from 'fs';
import * as fs from 'fs/promises';
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
  // Start with defaults
  const config: CLIConfig = {
    apiUrl: 'https://api.gatekit.dev',
    outputFormat: 'table',
  };

  // Load from config file (if exists)
  try {
    const configPath = path.join(os.homedir(), '.gatekit', 'config.json');
    const fileConfig = JSON.parse(fsSync.readFileSync(configPath, 'utf-8'));
    Object.assign(config, fileConfig);
  } catch {
    // Config file doesn't exist or is invalid - use defaults
  }

  // Environment variables override config file
  if (process.env.GATEKIT_API_URL) config.apiUrl = process.env.GATEKIT_API_URL;
  if (process.env.GATEKIT_API_KEY) config.apiKey = process.env.GATEKIT_API_KEY;
  if (process.env.GATEKIT_JWT_TOKEN) config.jwtToken = process.env.GATEKIT_JWT_TOKEN;
  if (process.env.GATEKIT_DEFAULT_PROJECT) config.defaultProject = process.env.GATEKIT_DEFAULT_PROJECT;
  if (process.env.GATEKIT_OUTPUT_FORMAT) config.outputFormat = process.env.GATEKIT_OUTPUT_FORMAT as any;

  return config;
}

export async function saveConfig(key: string, value: string): Promise<void> {
  const configDir = path.join(os.homedir(), '.gatekit');
  const configPath = path.join(configDir, 'config.json');

  // Create directory if it doesn't exist
  try {
    await fs.mkdir(configDir, { recursive: true, mode: 0o700 });
  } catch (err) {
    throw new Error(\`Failed to create config directory: \${err instanceof Error ? err.message : String(err)}\`);
  }

  // Load existing config or start fresh
  let config: Record<string, any> = {};
  try {
    const existing = await fs.readFile(configPath, 'utf-8');
    config = JSON.parse(existing);
  } catch {
    // File doesn't exist yet, that's ok
  }

  // Update the specific key
  config[key] = value;

  // Write config file with restricted permissions
  try {
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
  } catch (err) {
    throw new Error(\`Failed to write config file: \${err instanceof Error ? err.message : String(err)}\`);
  }
}

export async function getConfigValue(key: string): Promise<string | undefined> {
  const configPath = path.join(os.homedir(), '.gatekit', 'config.json');

  try {
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    return config[key];
  } catch {
    return undefined;
  }
}

export async function listConfig(): Promise<Record<string, any>> {
  const configPath = path.join(os.homedir(), '.gatekit', 'config.json');

  try {
    const configContent = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(configContent);
  } catch {
    return {};
  }
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
    return JSON.stringify(
      {
        name: '@gatekit/cli',
        version: packageJson.version,
        description: 'Official CLI for GateKit universal messaging gateway',
        main: 'dist/index.js',
        bin: {
          gatekit: 'dist/index.js',
        },
        files: ['dist'],
        scripts: {
          build: 'tsc',
          test: 'echo "No tests for generated CLI - tested in backend"',
          prepublishOnly: 'npm run build',
        },
        dependencies: {
          '@gatekit/sdk': 'file:../sdk',
          commander: '^14.0.1',
          axios: '^1.12.2',
        },
        devDependencies: {
          '@types/node': '^22.18.8',
          typescript: '^5.9.3',
        },
        keywords: ['gatekit', 'cli', 'messaging', 'universal'],
        author: 'GateKit',
        license: 'MIT',
        repository: {
          type: 'git',
          url: 'https://github.com/filipexyz/gatekit-cli.git',
        },
        homepage: 'https://github.com/filipexyz/gatekit-cli',
        bugs: {
          url: 'https://github.com/filipexyz/gatekit-cli/issues',
        },
      },
      null,
      2,
    );
  }

  private generatePlatformOptions(
    contractMetadata: any,
    platformMetadata: Record<string, any>,
  ): string {
    // Only add platform options for message sending commands
    if (
      !contractMetadata.command.includes('send') &&
      !contractMetadata.command.includes('message')
    ) {
      return '';
    }

    const platformOptionFlags: string[] = [];

    for (const [platformName, metadata] of Object.entries(platformMetadata)) {
      if (!metadata.optionsSchema) continue;

      const schema = metadata.optionsSchema;
      for (const [propName, propSchema] of Object.entries<any>(
        schema.properties,
      )) {
        const flagName = `--${platformName}.${propName}`;
        const description = `[${metadata.displayName}] ${propSchema.description || propName}`;
        platformOptionFlags.push(
          `    .option('${flagName} <value>', '${description}')`,
        );
      }
    }

    return platformOptionFlags.join('\n');
  }

  private groupContractsByCategory(
    contracts: ExtractedContract[],
  ): Record<string, ExtractedContract[]> {
    return contracts.reduce(
      (groups, contract) => {
        const category = contract.contractMetadata.category || 'General';
        if (!groups[category]) groups[category] = [];
        groups[category].push(contract);
        return groups;
      },
      {} as Record<string, ExtractedContract[]>,
    );
  }

  private async writeCLIFiles(
    outputDir: string,
    cli: GeneratedCLI,
  ): Promise<void> {
    try {
      // Copy template files first (tsconfig.json, .gitignore, .github/workflows, etc.)
      const commandList = this.generateCommandList(cli.contracts, cli.groups);
      await TemplateUtils.copyTemplateFiles('cli', outputDir, {
        COMMAND_LIST: commandList,
      });

      // Write generated CLI code
      const srcDir = path.join(outputDir, 'src');
      const commandsDir = path.join(srcDir, 'commands');
      const libDir = path.join(srcDir, 'lib');

      await fs.mkdir(commandsDir, { recursive: true });
      await fs.mkdir(libDir, { recursive: true });

      // Write command files
      await Promise.all(
        Object.entries(cli.commands).map(([category, content]) =>
          fs.writeFile(path.join(commandsDir, `${category}.ts`), content),
        ),
      );

      // Write core files
      await Promise.all([
        fs.writeFile(path.join(srcDir, 'index.ts'), cli.index),
        fs.writeFile(path.join(libDir, 'utils.ts'), cli.config),
        fs.writeFile(path.join(libDir, 'message-utils.ts'), cli.messageUtils),
        fs.writeFile(path.join(commandsDir, 'mcp.ts'), cli.mcpCommand),
        fs.writeFile(path.join(outputDir, 'package.json'), cli.packageJson),
      ]);
    } catch (error) {
      throw new Error(
        `Failed to write CLI files: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private generateCommandList(
    contracts: ExtractedContract[],
    groups: Record<string, ExtractedContract[]>,
  ): string {
    const commandExamples = Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, contracts]) => {
        const examples = contracts
          .slice(0, 3)
          .map((contract) => {
            const example = contract.contractMetadata.examples?.[0];
            return `### ${contract.contractMetadata.description}
\`\`\`bash
${example?.command || `gatekit ${contract.contractMetadata.command} --help`}
\`\`\``;
          })
          .join('\n\n');

        return `## ${category}\n\n${examples}`;
      })
      .join('\n\n');

    return commandExamples;
  }

  private generateMcpCommand(contracts: ExtractedContract[]): string {
    // Serialize contracts as JSON for embedding
    const contractsJson = JSON.stringify(contracts, null, 2);

    return `// MCP Server command for GateKit CLI
// Implements native stdio-based MCP server for Claude Desktop integration
// AUTO-GENERATED - Uses embedded SDK contracts to build MCP tools

import { Command } from 'commander';
import * as readline from 'readline';
import axios, { AxiosInstance } from 'axios';
import { loadConfig } from '../lib/utils';

const CONTRACTS = ${contractsJson};

interface CLIConfig {
  apiUrl: string;
  apiKey?: string;
  jwtToken?: string;
  defaultProject?: string;
  outputFormat?: string;
}

interface McpMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export function createMcpCommand(): Command {
  const mcp = new Command('mcp');
  mcp.description('Start MCP server (for Claude Desktop integration)');

  mcp.action(async () => {
    try {
      const config = await loadConfig();

      if (!config.apiUrl) {
        console.error('Error: API URL not configured. Run: gatekit config set apiUrl <url>');
        process.exit(1);
      }

      if (!config.apiKey) {
        console.error('Error: API key not configured. Run: gatekit config set apiKey <key>');
        process.exit(1);
      }

      const client = axios.create({
        baseURL: config.apiUrl,
        headers: {
          'X-API-Key': config.apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 second timeout
      });

      const server = new McpStdioServer(client, config);
      await server.start();
    } catch (error) {
      console.error(\`Failed to start MCP server: \${error instanceof Error ? error.message : String(error)}\`);
      process.exit(1);
    }
  });

  return mcp;
}

class McpStdioServer {
  private client: AxiosInstance;
  private config: CLIConfig;
  private rl: readline.Interface;
  private tools: McpTool[] = [];
  private contractMap: Map<string, typeof CONTRACTS[0]> = new Map();
  private pendingWork = 0;
  private shouldExit = false;
  private userPermissions: string[] = [];
  private permissionsFetched = false;

  constructor(client: AxiosInstance, config: CLIConfig) {
    this.client = client;
    this.config = config;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });
    this.loadContracts();
  }

  private loadContracts(): void {
    for (const contract of CONTRACTS) {
      // Skip contracts that are excluded from MCP
      if (contract.contractMetadata.excludeFromMcp) {
        continue;
      }

      const toolName = \`gatekit_\${contract.contractMetadata.command.replace(/\\s+/g, '_')}\`;
      this.tools.push(this.contractToTool(contract));
      this.contractMap.set(toolName, contract);
    }
  }

  private async fetchUserPermissions(): Promise<void> {
    if (this.permissionsFetched) return;

    try {
      const response = await this.client.get('/api/v1/auth/whoami');
      this.userPermissions = response.data.permissions || [];
      this.permissionsFetched = true;
    } catch (error) {
      this.permissionsFetched = true;
      // Log to stderr so it doesn't interfere with JSON-RPC stdout
      console.error('Warning: Failed to fetch permissions. Some tools may be unavailable.', error instanceof Error ? error.message : String(error));
      this.userPermissions = [];
    }
  }

  private hasRequiredScopes(contract: typeof CONTRACTS[0]): boolean {
    const requiredScopes = contract.contractMetadata.requiredScopes || [];
    if (requiredScopes.length === 0) return true;
    return requiredScopes.every((scope: string) => this.userPermissions.includes(scope));
  }

  private getFilteredTools(): McpTool[] {
    return this.tools.filter((tool) => {
      const contract = this.contractMap.get(tool.name);
      return contract && this.hasRequiredScopes(contract);
    });
  }

  private contractToTool(contract: typeof CONTRACTS[0]): McpTool {
    const inputSchema: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    } = { type: 'object', properties: {} };
    const required: string[] = [];

    const pathParams = contract.path.match(/:(\\w+)/g);
    if (pathParams) {
      for (const param of pathParams) {
        const paramName = param.substring(1);
        // Skip project parameter - it's auto-filled from config
        if (paramName === 'project') continue;
        inputSchema.properties[paramName] = {
          type: 'string',
          description: \`\${paramName.charAt(0).toUpperCase() + paramName.slice(1)} identifier\`,
        };
        required.push(paramName);
      }
    }

    if (contract.contractMetadata.options) {
      for (const [key, option] of Object.entries(contract.contractMetadata.options)) {
        const opt = option as { type: string; description?: string; choices?: any[]; default?: any; required?: boolean };
        const property: { type?: string; description: string; enum?: any[]; default?: any } = { description: opt.description || '' };

        switch (opt.type) {
          case 'string':
          case 'target_pattern':
          case 'targets_pattern':
            property.type = 'string';
            break;
          case 'number':
            property.type = 'number';
            break;
          case 'boolean':
            property.type = 'boolean';
            break;
          case 'array':
            property.type = 'array';
            break;
          case 'object':
            property.type = 'object';
            break;
          default:
            property.type = 'string';
        }

        if (opt.choices) property.enum = opt.choices;
        if (opt.default !== undefined) property.default = opt.default;

        inputSchema.properties[key] = property;
        if (opt.required) required.push(key);
      }
    }

    if (required.length > 0) inputSchema.required = required;

    return {
      name: \`gatekit_\${contract.contractMetadata.command.replace(/\\s+/g, '_')}\`,
      description: contract.contractMetadata.description,
      inputSchema,
    };
  }

  async start(): Promise<void> {
    this.rl.on('line', async (line: string) => {
      this.pendingWork++;
      try {
        const message: McpMessage = JSON.parse(line);
        const response = await this.handleMessage(message);
        this.writeMessage(response);
      } catch (error) {
        this.writeMessage({
          jsonrpc: '2.0',
          id: undefined,
          error: {
            code: -32700,
            message: 'Parse error',
            data: error instanceof Error ? error.message : String(error),
          },
        });
      } finally {
        this.pendingWork--;
        this.maybeExit();
      }
    });

    this.rl.on('close', () => {
      this.shouldExit = true;
      this.maybeExit();
    });
  }

  private maybeExit(): void {
    if (this.shouldExit && this.pendingWork === 0) {
      process.exit(0);
    }
  }

  private async handleMessage(message: McpMessage): Promise<McpMessage> {
    const { method, params, id } = message;

    try {
      switch (method) {
        case 'initialize':
          return this.handleInitialize(id);
        case 'tools/list':
          return await this.handleToolsList(id);
        case 'tools/call':
          return await this.handleToolCall(id, params);
        default:
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: \`Method not found: \${method}\` },
          };
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  private handleInitialize(id: string | number | undefined): McpMessage {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'gatekit-mcp-cli', version: '${packageJson.version}' },
      },
    };
  }

  private async handleToolsList(id: string | number | undefined): Promise<McpMessage> {
    await this.fetchUserPermissions();
    const filteredTools = this.getFilteredTools();
    return { jsonrpc: '2.0', id, result: { tools: filteredTools } };
  }

  private async handleToolCall(id: string | number | undefined, params: any): Promise<McpMessage> {
    try {
      const { name, arguments: args } = params || {};
      if (!name) throw new Error('Missing tool name');

      const contract = this.contractMap.get(name);
      if (!contract) throw new Error(\`Unknown tool: \${name}\`);

      // Check if user has required permissions for this tool
      await this.fetchUserPermissions();
      if (!this.hasRequiredScopes(contract)) {
        throw new Error('Access denied: insufficient permissions for this tool');
      }

      const convertedArgs = this.convertPatternArgs(args, contract);
      let url = contract.path;
      const usedParams = new Set<string>();

      const pathParams = contract.path.match(/:(\\w+)/g);
      if (pathParams) {
        for (const param of pathParams) {
          const paramName = param.substring(1);
          usedParams.add(paramName);

          // Auto-fill project parameter from config
          let value = convertedArgs[paramName];
          if (paramName === 'project' && !value) {
            if (!this.config.defaultProject) {
              throw new Error('Missing project parameter. Set a default project with: gatekit config set defaultProject <project-id>');
            }
            value = this.config.defaultProject;
          }

          if (!value) throw new Error(\`Missing required parameter: \${paramName}\`);
          url = url.replace(param, value);
        }
      }

      const body: Record<string, any> = {};
      for (const [key, value] of Object.entries(convertedArgs)) {
        if (!usedParams.has(key)) body[key] = value;
      }

      const response = await this.client.request({
        method: contract.httpMethod,
        url,
        data: ['POST', 'PATCH', 'PUT'].includes(contract.httpMethod) ? body : undefined,
        params: contract.httpMethod === 'GET' ? body : undefined,
      });

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
          isError: false,
        },
      };
    } catch (error) {
      let errorMessage: string;
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else {
        errorMessage = error instanceof Error ? error.message : String(error);
      }

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: \`Error: \${errorMessage}\` }],
          isError: true,
        },
      };
    }
  }

  private parseTargetPattern(pattern: string): { platformId: string; type: string; id: string } {
    const parts = pattern.split(':');
    if (parts.length !== 3) {
      throw new Error(\`Invalid target pattern: "\${pattern}". Expected format: platformId:type:id\`);
    }
    const [platformId, type, id] = parts;
    if (!platformId || !type || !id) {
      throw new Error(\`Invalid target pattern: "\${pattern}". All parts must be non-empty\`);
    }
    return { platformId, type, id };
  }

  private convertPatternArgs(args: Record<string, any>, contract: any): Record<string, any> {
    const converted = { ...args };
    const options = contract.contractMetadata.options || {};

    for (const [key, option] of Object.entries(options)) {
      const value = args[key];
      if (!value || typeof value !== 'string') continue;

      const optionType = (option as any)?.type;

      if (optionType === 'target_pattern') {
        converted.targets = [this.parseTargetPattern(value)];
        delete converted[key];
      }

      if (optionType === 'targets_pattern') {
        converted.targets = value.split(',').map((p: string) => this.parseTargetPattern(p.trim()));
        delete converted[key];
      }
    }

    if (options.text && args.text && !args.content) {
      converted.content = { text: args.text };
      delete converted.text;
    }

    return converted;
  }

  private writeMessage(message: McpMessage): void {
    console.log(JSON.stringify(message));
  }
}
`;
  }
}

// Entry point
async function main() {
  const contractsPath = path.join(
    __dirname,
    '../../generated/contracts/contracts.json',
  );
  const outputDir = path.join(__dirname, '../../generated/cli');
  const generator = new CLIGenerator();
  await generator.generateFromContracts(contractsPath, outputDir);
}

if (require.main === module) {
  main().catch(console.error);
}
