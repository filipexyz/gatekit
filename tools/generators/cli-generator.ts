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
    Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([category, contracts]) => {
        commands[CaseConverter.toValidFilename(category)] =
          this.generateCommandFile(category, contracts);
      });

    return {
      commands,
      index: this.generateIndex(contracts, groups),
      config: this.generateConfig(),
      packageJson: this.generatePackageJson(),
      contracts,
      groups,
    };
  }

  private generateCommandFile(
    category: string,
    contracts: ExtractedContract[],
  ): string {
    const commandMethods = contracts
      .map((contract) => this.generateCommand(contract))
      .join('\n\n');

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

    // Add path parameter options
    const pathParamOptions = pathParams
      .map((param) => {
        // Make project param optional with env var default
        if (param === 'project') {
          return `    .option('--project <value>', 'Project (uses GATEKIT_DEFAULT_PROJECT if not provided)')`;
        }
        return `    .option('--${param} <value>', '${param} parameter', undefined)`;
      })
      .join('\n');

    const allOptions = [options, pathParamOptions].filter(Boolean).join('\n');

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
    try {
      dto.content = JSON.parse(options.content);
    } catch (e) {
      throw new Error(\`Invalid JSON for --content: \${e instanceof Error ? e.message : String(e)}\`);
    }
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

    return `#!/usr/bin/env node
// Generated CLI entry point for GateKit
// DO NOT EDIT - This file is auto-generated from backend contracts

import { Command } from 'commander';
${commandImports}

const program = new Command();

program
  .name('gatekit')
  .description('GateKit Universal Messaging Gateway CLI')
  .version('${packageJson.version}');

// Add permission-aware commands
${commandRegistrations}

// Quick send command (AI-optimized)
program
  .command('send')
  .description('Quick message send (AI-optimized)')
  .requiredOption('--project <id>', 'Project ID')
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
          prepublishOnly: 'npm run build',
        },
        dependencies: {
          '@gatekit/sdk': `^${packageJson.version}`,
          commander: '^11.0.0',
          axios: '^1.6.0',
        },
        peerDependencies: {
          typescript: '>=4.5.0',
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
