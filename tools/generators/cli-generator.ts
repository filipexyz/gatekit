#!/usr/bin/env ts-node

import * as fs from 'fs/promises';
import * as path from 'path';
import { ExtractedContract } from '../extractors/contract-extractor.service';

interface GeneratedCLI {
  commands: Record<string, string>; // category -> command file content
  index: string;
  config: string;
  packageJson: string;
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
      commands[category.toLowerCase()] = this.generateCommandFile(category, contracts);
    });

    return {
      commands,
      index: this.generateIndex(contracts, groups),
      config: this.generateConfig(),
      packageJson: this.generatePackageJson(),
    };
  }

  private generateCommandFile(category: string, contracts: ExtractedContract[]): string {
    const commandMethods = contracts.map(contract => this.generateCommand(contract)).join('\n\n');

    return `// Generated ${category} commands for GateKit CLI
// DO NOT EDIT - This file is auto-generated from backend contracts

import { Command } from 'commander';
import { GateKit } from '@gatekit/sdk';
import { loadConfig, formatOutput, handleError } from '../lib/utils';

export function create${category}Command(): Command {
  const ${category.toLowerCase()} = new Command('${category.toLowerCase()}');

${commandMethods}

  return ${category.toLowerCase()};
}

${this.generateCommandHelpers()}
`;
  }

  private generateCommand(contract: ExtractedContract): string {
    const { contractMetadata } = contract;
    const commandParts = contractMetadata.command.split(' ');
    const subCommand = commandParts[commandParts.length - 1]; // 'projects create' -> 'create'
    const category = contractMetadata.category || 'general';

    const options = Object.entries(contractMetadata.options || {}).map(([name, opt]) => {
      const optionDef = `    .option('--${name} <value>', '${opt.description}'${opt.default ? `, '${opt.default}'` : ''})`;
      return optionDef;
    }).join('\n');

    const methodCall = subCommand === 'create' ? 'create' : subCommand === 'list' ? 'list' : subCommand;

    return `  ${category.toLowerCase()}
    .command('${subCommand}')
    .description('${contractMetadata.description}')
${options}
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const config = await loadConfig();

        // Check permissions
        const hasPermission = await checkPermissions(config, ${JSON.stringify(contractMetadata.requiredScopes)});
        if (!hasPermission) {
          console.error('❌ Insufficient permissions. Required: ${contractMetadata.requiredScopes?.join(', ')}');
          process.exit(1);
        }

        const gk = new GateKit(config);

        ${this.generateMethodCall(subCommand, methodCall, category, contractMetadata)}

        formatOutput(result, options.json);
      } catch (error) {
        handleError(error);
      }
    });`;
  }

  private generateMethodCall(subCommand: string, methodCall: string, category: string, contractMetadata: any): string {
    const namespace = category.toLowerCase() === 'apikeys' ? 'apikeys' : category.toLowerCase();

    // If no input type specified, method takes no parameters
    if (!contractMetadata.inputType) {
      return `const result = await gk.${namespace}.${methodCall}();`;
    }

    // Build data object by mapping CLI options to DTO properties using contract metadata
    const dtoObject = this.buildDtoObjectFromContract(contractMetadata.options || {});

    return `const result = await gk.${namespace}.${methodCall}(${dtoObject});`;
  }

  private buildDtoObjectFromContract(options: Record<string, any>): string {
    if (!options || Object.keys(options).length === 0) {
      return '{}';
    }

    // Simple 1:1 mapping - contract options = DTO properties
    const optionEntries = Object.keys(options).map(key =>
      `      ${key}: options.${key}`
    ).join(',\n');

    return `{
${optionEntries}
        }`;
  }


  private generateCommandHelpers(): string {
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

  private generateIndex(contracts: ExtractedContract[], groups: Record<string, ExtractedContract[]>): string {
    const commandImports = Object.keys(groups).map(category =>
      `import { create${category}Command } from './commands/${category.toLowerCase()}';`
    ).join('\n');

    const commandRegistrations = Object.keys(groups).map(category =>
      `  program.addCommand(create${category}Command());`
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

program.parse();
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
        '@gatekit/sdk': '^1.0.0',
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
        url: 'https://github.com/gatekit/cli.git'
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