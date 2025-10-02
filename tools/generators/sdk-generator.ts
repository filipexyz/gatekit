#!/usr/bin/env ts-node

import * as fs from 'fs/promises';
import * as path from 'path';
import { ExtractedContract } from '../extractors/contract-extractor.service';
import { CaseConverter } from '../../src/common/utils/case-converter';

interface GeneratedSDK {
  types: string;
  client: string;
  errors: string;
  index: string;
  packageJson: string;
  readme: string;
}

export class SDKGenerator {
  async generateFromContracts(
    contractsPath: string,
    outputDir: string,
  ): Promise<void> {
    console.log('🔧 Generating type-safe SDK from contracts...');

    // Load contracts (now containing all type definitions)
    const contractsContent = await fs.readFile(contractsPath, 'utf-8');
    const contracts: ExtractedContract[] = JSON.parse(contractsContent);

    // Get type definitions from contracts (single source of truth)
    const typeDefinitions = contracts[0]?.typeDefinitions || {};
    const typeCount = Object.keys(typeDefinitions).length;

    console.log(`📝 Using ${typeCount} TypeScript types from contract file`);

    // Generate SDK components
    const sdk = this.generateSDK(contracts, typeDefinitions);

    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });

    // Write generated files
    await this.writeSDKFiles(outputDir, sdk);

    console.log(`✅ SDK generated successfully in ${outputDir}`);
    console.log(`📦 Ready for: cd ${outputDir} && npm publish`);
  }

  private extractTypeNames(contracts: ExtractedContract[]): string[] {
    const typeNames = new Set<string>();

    contracts.forEach((contract) => {
      if (contract.contractMetadata.inputType) {
        typeNames.add(contract.contractMetadata.inputType);
      }
      if (contract.contractMetadata.outputType) {
        typeNames.add(contract.contractMetadata.outputType);
      }
    });

    return Array.from(typeNames);
  }

  private generateSDK(
    contracts: ExtractedContract[],
    typeDefinitions: Record<string, string>,
  ): GeneratedSDK {
    return {
      types: this.generateTypesFromDefinitions(typeDefinitions),
      client: this.generateClient(contracts),
      errors: this.generateErrors(),
      index: this.generateIndex(contracts),
      packageJson: this.generatePackageJson(),
      readme: this.generateReadme(contracts),
    };
  }

  private generateTypesFromDefinitions(
    typeDefinitions: Record<string, string>,
  ): string {
    const typeDefinitionsList = Object.values(typeDefinitions).join('\n\n');

    return `// Generated TypeScript types for GateKit SDK
// DO NOT EDIT - This file is auto-generated from backend contracts

${typeDefinitionsList}

// SDK configuration
export interface GateKitConfig {
  apiUrl: string;
  apiKey?: string;
  jwtToken?: string;
  defaultProject?: string;
  timeout?: number;
  retries?: number;
}
`;
  }

  private generateTypes(contracts: ExtractedContract[]): string {
    return `// Generated TypeScript types for GateKit SDK
// DO NOT EDIT - This file is auto-generated from backend DTOs

export interface GateKitConfig {
  apiUrl: string;
  apiKey?: string;
  jwtToken?: string;
  timeout?: number;
  retries?: number;
}

// Project types
export interface Project {
  id: string;
  name: string;
  slug: string;
  environment: 'development' | 'staging' | 'production';
  isDefault: boolean;
  settings?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectDto {
  name: string;
  environment?: 'development' | 'staging' | 'production';
}

// Platform types
export interface Platform {
  id: string;
  platform: 'discord' | 'telegram';
  credentials: Record<string, unknown>;
  isActive: boolean;
  testMode: boolean;
  webhookToken?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlatformDto {
  platform: 'discord' | 'telegram';
  token: string;
  testMode?: boolean;
}

// Message types
export interface MessageTarget {
  platformId: string;
  type: 'user' | 'channel' | 'group';
  id: string;
}

export interface MessageContent {
  text?: string;
  attachments?: any[];
  buttons?: any[];
  embeds?: any[];
}

export interface SendMessageDto {
  targets: MessageTarget[];
  content: MessageContent;
  options?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface MessageJob {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
}

export interface MessageStatus {
  id: string;
  state: 'waiting' | 'active' | 'completed' | 'failed';
  progress?: number;
  data?: {
    project: string;
    projectId: string;
    message: any;
    error?: string;
  };
  attemptsMade: number;
  processedOn?: number;
  finishedOn?: number;
}

// API Key types
export interface ApiKey {
  id: string;
  name: string;
  keyId: string;
  scopes: string[];
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApiKeyDto {
  name: string;
  scopes: string[];
  expiresInDays?: number;
}

export interface ApiKeyResult {
  id: string;
  name: string;
  keyId: string;
  key: string;
  scopes: string[];
  expiresAt?: string;
  createdAt: string;
}
`;
  }

  private generateClient(contracts: ExtractedContract[]): string {
    // Group contracts by controller/category
    const groups = this.groupContractsByCategory(contracts);

    // Dynamically collect all used types from contracts
    const usedTypes = new Set<string>(['GateKitConfig']); // Always need config

    contracts.forEach((contract) => {
      if (contract.contractMetadata.inputType) {
        usedTypes.add(contract.contractMetadata.inputType);
      }
      if (contract.contractMetadata.outputType) {
        const outputType = contract.contractMetadata.outputType;
        // For array types, only import the base type
        if (outputType.endsWith('[]')) {
          usedTypes.add(outputType.slice(0, -2));
        } else {
          usedTypes.add(outputType);
        }
      }
    });

    // Generate dynamic import list
    const typeImports = Array.from(usedTypes).sort().join(',\n  ');

    const apiGroups = Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b)) // Sort categories alphabetically for consistency
      .map(([category, contracts]) => {
        const className = `${CaseConverter.toValidClassName(category)}API`;
        const methods = contracts
          .map((contract) => this.generateAPIMethod(contract))
          .join('\n\n  ');

        return `class ${className} {
  constructor(private client: AxiosInstance, private gatekit: GateKit) {}

  ${methods}
}`;
      })
      .join('\n\n');

    return `// Generated API client for GateKit SDK
// DO NOT EDIT - This file is auto-generated from backend contracts

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  ${typeImports}
} from './types';
import { GateKitError, AuthenticationError, RateLimitError } from './errors';

${apiGroups}

export class GateKit {
  private client: AxiosInstance;
  private defaultProject?: string;

  // API group instances
${Object.keys(groups)
  .sort()
  .map(
    (category) =>
      `  readonly ${CaseConverter.toValidPropertyName(category)}: ${CaseConverter.toValidClassName(category)}API;`,
  )
  .join('\n')}

  constructor(config: GateKitConfig) {
    this.defaultProject = config.defaultProject;
    this.client = axios.create({
      baseURL: config.apiUrl,
      timeout: config.timeout || 30000,
      headers: { 'Content-Type': 'application/json' }
    });

    this.setupAuthentication(config);
    this.setupErrorHandling();

    // Initialize API groups after client is ready
${Object.keys(groups)
  .sort()
  .map(
    (category) =>
      `    this.${CaseConverter.toValidPropertyName(category)} = new ${CaseConverter.toValidClassName(category)}API(this.client, this);`,
  )
  .join('\n')}
  }

  private setupAuthentication(config: GateKitConfig): void {
    if (config.apiKey) {
      this.client.defaults.headers['X-API-Key'] = config.apiKey;
    } else if (config.jwtToken) {
      this.client.defaults.headers['Authorization'] = \`Bearer \${config.jwtToken}\`;
    }
  }

  private setupErrorHandling(): void {
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          throw new AuthenticationError('Invalid credentials');
        }
        if (error.response?.status === 429) {
          throw new RateLimitError('Rate limit exceeded');
        }
        if (error.response?.status === 403) {
          throw new GateKitError(
            \`Insufficient permissions: \${error.response.data?.message || 'Access denied'}\`,
            403,
            'INSUFFICIENT_PERMISSIONS'
          );
        }
        throw new GateKitError(
          error.response?.data?.message || error.message,
          error.response?.status
        );
      }
    );
  }

  getDefaultProject(): string | undefined {
    return this.defaultProject;
  }
}
`;
  }

  private generateAPIMethod(contract: ExtractedContract): string {
    const { contractMetadata, path, httpMethod } = contract;
    const methodName = this.getMethodName(contractMetadata.command);

    // Extract path parameters (e.g., ":project", ":id", ":keyId")
    const pathParams = this.extractPathParameters(path);

    // Get types from contract metadata
    const inputType = contractMetadata.inputType;
    const outputType = contractMetadata.outputType || 'any';

    // Determine if method needs input data based on inputType presence
    const needsInput = !!(inputType && inputType !== 'any');

    // Separate project params from other path params
    const projectParams = pathParams.filter((p) => p === 'project');
    const otherParams = pathParams.filter((p) => p !== 'project');

    // Build method signature - project goes in options object
    const hasProject = projectParams.length > 0;
    const methodParams = this.buildMethodSignature(
      otherParams,
      needsInput,
      inputType,
      hasProject,
    );

    // Build URL with parameter substitution
    const urlWithParams = this.buildUrlWithParameters(path, pathParams);

    // Use actual HTTP method from contract
    const actualHttpMethod = httpMethod.toLowerCase();

    if (needsInput) {
      // Extract project property from options for cleaner payload
      const dataExtraction =
        projectParams.length > 0
          ? `const { project, ...data } = options;`
          : `const data = options;`;

      // For GET requests with input data, use params config instead of request body
      if (actualHttpMethod === 'get') {
        return `async ${methodName}(${methodParams}): Promise<${outputType}> {
    ${dataExtraction}
    const response = await this.client.${actualHttpMethod}<${outputType}>(${urlWithParams}, { params: data });
    return response.data;
  }`;
      } else {
        return `async ${methodName}(${methodParams}): Promise<${outputType}> {
    ${dataExtraction}
    const response = await this.client.${actualHttpMethod}<${outputType}>(${urlWithParams}, data);
    return response.data;
  }`;
      }
    }

    // Methods without input data - use actual HTTP method from contract
    const httpMethodLower = httpMethod.toLowerCase();
    return `async ${methodName}(${methodParams}): Promise<${outputType}> {
    const response = await this.client.${httpMethodLower}<${outputType}>(${urlWithParams});
    return response.data;
  }`;
  }

  private extractPathParameters(path: string): string[] {
    const matches = path.match(/:([a-zA-Z][a-zA-Z0-9]*)/g);
    return matches ? matches.map((match) => match.substring(1)) : [];
  }

  private buildMethodSignature(
    otherParams: string[],
    needsInput: boolean,
    inputType: string | null | undefined,
    hasProject: boolean,
  ): string {
    const params: string[] = [];

    // Add non-project path parameters as regular params
    otherParams.forEach((param) => {
      params.push(`${param}: string`);
    });

    // Build options type for input data + optional project
    if (needsInput && hasProject) {
      params.push(`options: ${inputType} & { project?: string }`);
    } else if (needsInput) {
      params.push(`options: ${inputType}`);
    } else if (hasProject) {
      params.push(`options?: { project?: string }`);
    }

    return params.join(', ');
  }

  private buildUrlWithParameters(path: string, pathParams: string[]): string {
    let url = `'${path}'`;
    pathParams.forEach((param) => {
      // Use options.project for project param, with fallback to default
      if (param === 'project') {
        url = url.replace(
          `:${param}`,
          `\${options?.project || this.gatekit.getDefaultProject() || ''}`,
        );
      } else {
        url = url.replace(`:${param}`, `\${${param}}`);
      }
    });
    return '`' + url.slice(1, -1) + '`'; // Convert to template literal
  }

  private getMethodName(command: string): string {
    const parts = command.split(' ');
    const methodName = parts[parts.length - 1]; // 'projects create' -> 'create'

    // Convert kebab-case to camelCase for valid JavaScript method names
    return methodName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
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

  private generateErrors(): string {
    return `// Generated error classes for GateKit SDK
// DO NOT EDIT - This file is auto-generated

export class GateKitError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'GateKitError';
  }
}

export class AuthenticationError extends GateKitError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends GateKitError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_ERROR');
    this.name = 'RateLimitError';
  }
}
`;
  }

  private generateIndex(contracts: ExtractedContract[]): string {
    const groups = this.groupContractsByCategory(contracts);

    return `// Generated main export for GateKit SDK
// DO NOT EDIT - This file is auto-generated from backend contracts

export { GateKit } from './client';
export * from './types';
export * from './errors';

// Version info
export const SDK_VERSION = '1.0.0';
export const GENERATED_AT = '${new Date().toISOString()}';
export const CONTRACTS_COUNT = ${contracts.length};
`;
  }

  private generatePackageJson(): string {
    return JSON.stringify(
      {
        name: '@gatekit/sdk',
        version: '1.0.0',
        description:
          'Official TypeScript SDK for GateKit universal messaging gateway',
        main: 'dist/index.js',
        types: 'dist/index.d.ts',
        files: ['dist'],
        scripts: {
          build: 'tsc',
          prepublishOnly: 'npm run build',
        },
        dependencies: {
          axios: '^1.6.0',
        },
        peerDependencies: {
          typescript: '>=4.5.0',
        },
        keywords: ['gatekit', 'messaging', 'sdk', 'api-client'],
        author: 'GateKit',
        license: 'MIT',
        repository: {
          type: 'git',
          url: 'https://github.com/filipexyz/gatekit-sdk.git',
        },
        homepage: 'https://github.com/filipexyz/gatekit-sdk',
        bugs: {
          url: 'https://github.com/filipexyz/gatekit-sdk/issues',
        },
      },
      null,
      2,
    );
  }

  private async writeSDKFiles(
    outputDir: string,
    sdk: GeneratedSDK,
  ): Promise<void> {
    const srcDir = path.join(outputDir, 'src');
    await fs.mkdir(srcDir, { recursive: true });

    await Promise.all([
      fs.writeFile(path.join(srcDir, 'types.ts'), sdk.types),
      fs.writeFile(path.join(srcDir, 'client.ts'), sdk.client),
      fs.writeFile(path.join(srcDir, 'errors.ts'), sdk.errors),
      fs.writeFile(path.join(srcDir, 'index.ts'), sdk.index),
      fs.writeFile(path.join(outputDir, 'package.json'), sdk.packageJson),
      fs.writeFile(
        path.join(outputDir, 'tsconfig.json'),
        this.generateTSConfig(),
      ),
      fs.writeFile(path.join(outputDir, 'README.md'), sdk.readme),
    ]);
  }

  private generateTSConfig(): string {
    return JSON.stringify(
      {
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
          sourceMap: true,
        },
        include: ['src/**/*'],
        exclude: ['node_modules', 'dist'],
      },
      null,
      2,
    );
  }

  private generateReadme(contracts: ExtractedContract[]): string {
    const categories = this.groupContractsByCategory(contracts);
    const categoryExamples = Object.entries(categories)
      .sort(([a], [b]) => a.localeCompare(b)) // Sort categories alphabetically for consistency
      .map(([category, contracts]) => {
        const examples = contracts
          .slice(0, 2)
          .map((contract) => {
            const example = contract.contractMetadata.examples?.[0];
            return `### ${contract.contractMetadata.description}
\`\`\`typescript
// ${example?.description || 'Usage example'}
${this.generateSDKExample(contract)}
\`\`\``;
          })
          .join('\n\n');

        return `## ${category}\n\n${examples}`;
      })
      .join('\n\n');

    return `# @gatekit/sdk

TypeScript SDK for GateKit - Universal messaging gateway API.

## Installation

\`\`\`bash
npm install @gatekit/sdk
\`\`\`

## Quick Start

\`\`\`typescript
import { GateKit } from '@gatekit/sdk';

const gk = new GateKit({
  apiUrl: 'https://api.gatekit.dev',
  apiKey: 'gk_live_your_api_key_here',
});

// Send a message
const result = await gk.messages.send({
  project: 'my-project',  // optional if defaultProject is set
  targets: [{ platformId: 'platform-id', type: 'user', id: '123' }],
  content: { text: 'Hello from GateKit!' }
});

console.log('Message sent:', result.jobId);
\`\`\`

## Configuration

\`\`\`typescript
const gk = new GateKit({
  apiUrl: 'https://api.gatekit.dev',     // API endpoint
  apiKey: 'gk_live_your_key',           // API key authentication
  // OR
  jwtToken: 'your_jwt_token',           // JWT authentication
  defaultProject: 'my-project',         // Default project (optional)
  timeout: 30000,                       // Request timeout (ms)
  retries: 3,                           // Retry attempts
});

// With default project set, you can omit the project field:
await gk.messages.send({
  targets: [...],
  content: {...}
});

// Or specify project in the options:
await gk.messages.send({
  targets: [...],
  content: {...},
  project: 'other-project'
});
\`\`\`

## API Reference

${categoryExamples}

## Error Handling

\`\`\`typescript
try {
  const result = await gk.messages.send({ project: 'my-project', ...messageData });
} catch (error) {
  if (error.code === 'INSUFFICIENT_PERMISSIONS') {
    console.error('Permission denied:', error.message);
  } else if (error.code === 'VALIDATION_ERROR') {
    console.error('Invalid data:', error.details);
  } else {
    console.error('API error:', error.message);
  }
}
\`\`\`

## Links

[![View on GitHub](https://img.shields.io/badge/View%20on-GitHub-blue?logo=github)](https://github.com/filipexyz/gatekit-sdk)
[![View on npm](https://img.shields.io/badge/View%20on-npm-red?logo=npm)](https://www.npmjs.com/package/@gatekit/sdk)

- **📦 Repository**: [github.com/filipexyz/gatekit-sdk](https://github.com/filipexyz/gatekit-sdk)
- **📥 npm Package**: [@gatekit/sdk](https://www.npmjs.com/package/@gatekit/sdk)
- **🖥️ CLI Package**: [@gatekit/cli](https://www.npmjs.com/package/@gatekit/cli)
- **📚 Documentation**: [docs.gatekit.dev](https://docs.gatekit.dev)
- **🎛️ Dashboard**: [app.gatekit.dev](https://app.gatekit.dev)

`;
  }

  private generateSDKExample(contract: ExtractedContract): string {
    const { contractMetadata, path } = contract;
    const category = CaseConverter.toValidPropertyName(
      contractMetadata.category || 'api',
    );
    const methodName = this.getMethodName(contractMetadata.command);

    // Extract path params
    const pathParams = this.extractPathParameters(path);
    const hasProject = pathParams.includes('project');
    const otherParams = pathParams.filter((p) => p !== 'project');
    const hasInput =
      contractMetadata.inputType && contractMetadata.inputType !== 'any';

    // No params, no input
    if (pathParams.length === 0 && !hasInput) {
      return `await gk.${category}.${methodName}();`;
    }

    // Only project param, no other params, no input
    if (hasProject && otherParams.length === 0 && !hasInput) {
      return `await gk.${category}.${methodName}();`;
    }

    // Only project param, no other params, with input
    if (hasProject && otherParams.length === 0 && hasInput) {
      return `await gk.${category}.${methodName}(data);`;
    }

    // Other params (not project), no input
    if (otherParams.length > 0 && !hasInput) {
      const paramList = otherParams.map((p) => `'${p}'`).join(', ');
      return `await gk.${category}.${methodName}(${paramList});`;
    }

    // Other params (not project), with input
    if (otherParams.length > 0 && hasInput) {
      const paramList = otherParams.map((p) => `'${p}'`).join(', ');
      return `await gk.${category}.${methodName}(${paramList}, data);`;
    }

    return `await gk.${category}.${methodName}(data);`;
  }
}

// CLI execution
async function main() {
  const generator = new SDKGenerator();
  const contractsPath = path.join(
    __dirname,
    '../../generated/contracts/contracts.json',
  );
  const outputDir = path.join(__dirname, '../../generated/sdk');

  await generator.generateFromContracts(contractsPath, outputDir);
}

if (require.main === module) {
  main().catch(console.error);
}
