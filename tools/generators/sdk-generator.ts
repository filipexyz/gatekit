#!/usr/bin/env ts-node

import * as fs from 'fs/promises';
import * as path from 'path';
import { ExtractedContract } from '../extractors/contract-extractor.service';

interface GeneratedSDK {
  types: string;
  client: string;
  errors: string;
  index: string;
  packageJson: string;
}

export class SDKGenerator {
  async generateFromContracts(contractsPath: string, outputDir: string): Promise<void> {
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

    contracts.forEach(contract => {
      if (contract.contractMetadata.inputType) {
        typeNames.add(contract.contractMetadata.inputType);
      }
      if (contract.contractMetadata.outputType) {
        typeNames.add(contract.contractMetadata.outputType);
      }
    });

    return Array.from(typeNames);
  }

  private generateSDK(contracts: ExtractedContract[], typeDefinitions: Record<string, string>): GeneratedSDK {
    return {
      types: this.generateTypesFromDefinitions(typeDefinitions),
      client: this.generateClient(contracts),
      errors: this.generateErrors(),
      index: this.generateIndex(contracts),
      packageJson: this.generatePackageJson(),
    };
  }

  private generateTypesFromDefinitions(typeDefinitions: Record<string, string>): string {
    const typeDefinitionsList = Object.values(typeDefinitions).join('\n\n');

    return `// Generated TypeScript types for GateKit SDK
// DO NOT EDIT - This file is auto-generated from backend contracts

${typeDefinitionsList}

// SDK configuration
export interface GateKitConfig {
  apiUrl: string;
  apiKey?: string;
  jwtToken?: string;
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
    projectSlug: string;
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

    contracts.forEach(contract => {
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

    const apiGroups = Object.entries(groups).map(([category, contracts]) => {
      const className = `${category}API`;
      const methods = contracts.map(contract => this.generateAPIMethod(contract)).join('\n\n  ');

      return `class ${className} {
  constructor(private client: AxiosInstance) {}

  ${methods}
}`;
    }).join('\n\n');

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

  // API group instances
${Object.keys(groups).map(category =>
  `  readonly ${category.toLowerCase()}: ${category}API;`
).join('\n')}

  constructor(config: GateKitConfig) {
    this.client = axios.create({
      baseURL: config.apiUrl,
      timeout: config.timeout || 30000,
      headers: { 'Content-Type': 'application/json' }
    });

    this.setupAuthentication(config);
    this.setupErrorHandling();

    // Initialize API groups after client is ready
${Object.keys(groups).map(category =>
  `    this.${category.toLowerCase()} = new ${category}API(this.client);`
).join('\n')}
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
}
`;
  }

  private generateAPIMethod(contract: ExtractedContract): string {
    const { contractMetadata, path, httpMethod } = contract;
    const methodName = this.getMethodName(contractMetadata.command);

    // Extract path parameters (e.g., ":projectSlug", ":id", ":keyId")
    const pathParams = this.extractPathParameters(path);

    // Get types from contract metadata
    const inputType = contractMetadata.inputType;
    const outputType = contractMetadata.outputType || 'any';

    // Determine if method needs input data based on inputType presence
    const needsInput = inputType && inputType !== 'any';

    // Build method parameters: path params + optional data param
    const methodParams = this.buildMethodParameters(pathParams, needsInput ? inputType : null);

    // Build URL with parameter substitution
    const urlWithParams = this.buildUrlWithParameters(path, pathParams);

    // Use actual HTTP method from contract
    const actualHttpMethod = httpMethod.toLowerCase();

    if (needsInput) {
      // For GET requests with input data, use params config instead of request body
      if (actualHttpMethod === 'get') {
        return `async ${methodName}(${methodParams}): Promise<${outputType}> {
    const response = await this.client.${actualHttpMethod}<${outputType}>(${urlWithParams}, { params: data });
    return response.data;
  }`;
      } else {
        return `async ${methodName}(${methodParams}): Promise<${outputType}> {
    const response = await this.client.${actualHttpMethod}<${outputType}>(${urlWithParams}, data);
    return response.data;
  }`;
      }
    }

    // Methods without input data
    return `async ${methodName}(${methodParams}): Promise<${outputType}> {
    const response = await this.client.get<${outputType}>(${urlWithParams});
    return response.data;
  }`;
  }

  private extractPathParameters(path: string): string[] {
    const matches = path.match(/:([a-zA-Z][a-zA-Z0-9]*)/g);
    return matches ? matches.map(match => match.substring(1)) : [];
  }

  private buildMethodParameters(pathParams: string[], inputType: string | null): string {
    const params = pathParams.map(param => `${param}: string`);
    if (inputType) {
      params.push(`data: ${inputType}`);
    }
    return params.join(', ');
  }

  private buildUrlWithParameters(path: string, pathParams: string[]): string {
    let url = `'${path}'`;
    pathParams.forEach(param => {
      url = url.replace(`:${param}`, `\${${param}}`);
    });
    return '`' + url.slice(1, -1) + '`'; // Convert to template literal
  }

  private getMethodName(command: string): string {
    const parts = command.split(' ');
    const methodName = parts[parts.length - 1]; // 'projects create' -> 'create'

    // Convert kebab-case to camelCase for valid JavaScript method names
    return methodName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  private groupContractsByCategory(contracts: ExtractedContract[]): Record<string, ExtractedContract[]> {
    return contracts.reduce((groups, contract) => {
      const category = contract.contractMetadata.category || 'General';
      if (!groups[category]) groups[category] = [];
      groups[category].push(contract);
      return groups;
    }, {} as Record<string, ExtractedContract[]>);
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
    return JSON.stringify({
      name: '@gatekit/sdk',
      version: '1.0.0',
      description: 'Official TypeScript SDK for GateKit universal messaging gateway',
      main: 'dist/index.js',
      types: 'dist/index.d.ts',
      files: ['dist'],
      scripts: {
        build: 'tsc',
        prepublishOnly: 'npm run build'
      },
      dependencies: {
        axios: '^1.6.0'
      },
      peerDependencies: {
        typescript: '>=4.5.0'
      },
      keywords: ['gatekit', 'messaging', 'sdk', 'api-client'],
      author: 'GateKit',
      license: 'MIT',
      repository: {
        type: 'git',
        url: 'https://github.com/gatekit/sdk.git'
      }
    }, null, 2);
  }

  private async writeSDKFiles(outputDir: string, sdk: GeneratedSDK): Promise<void> {
    const srcDir = path.join(outputDir, 'src');
    await fs.mkdir(srcDir, { recursive: true });

    await Promise.all([
      fs.writeFile(path.join(srcDir, 'types.ts'), sdk.types),
      fs.writeFile(path.join(srcDir, 'client.ts'), sdk.client),
      fs.writeFile(path.join(srcDir, 'errors.ts'), sdk.errors),
      fs.writeFile(path.join(srcDir, 'index.ts'), sdk.index),
      fs.writeFile(path.join(outputDir, 'package.json'), sdk.packageJson),
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
  const generator = new SDKGenerator();
  const contractsPath = path.join(__dirname, '../../generated/contracts/contracts.json');
  const outputDir = path.join(__dirname, '../../generated/sdk');

  await generator.generateFromContracts(contractsPath, outputDir);
}

if (require.main === module) {
  main().catch(console.error);
}