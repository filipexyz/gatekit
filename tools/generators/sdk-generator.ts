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
    console.log('🔧 Generating SDK from contracts...');

    // Load contracts
    const contractsContent = await fs.readFile(contractsPath, 'utf-8');
    const contracts: ExtractedContract[] = JSON.parse(contractsContent);

    // Generate SDK components
    const sdk = this.generateSDK(contracts);

    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });

    // Write generated files
    await this.writeSDKFiles(outputDir, sdk);

    console.log(`✅ SDK generated successfully in ${outputDir}`);
    console.log(`📦 Ready for: cd ${outputDir} && npm publish`);
  }

  private generateSDK(contracts: ExtractedContract[]): GeneratedSDK {
    return {
      types: this.generateTypes(contracts),
      client: this.generateClient(contracts),
      errors: this.generateErrors(),
      index: this.generateIndex(contracts),
      packageJson: this.generatePackageJson(),
    };
  }

  private generateTypes(contracts: ExtractedContract[]): string {
    return `// Generated TypeScript types for GateKit SDK
// DO NOT EDIT - This file is auto-generated from backend contracts

export interface GateKitConfig {
  apiUrl: string;
  apiKey?: string;
  jwtToken?: string;
  timeout?: number;
  retries?: number;
}

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

export interface CreateProjectData {
  name: string;
  environment?: 'development' | 'staging' | 'production';
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
`;
  }

  private generateClient(contracts: ExtractedContract[]): string {
    // Group contracts by controller/category
    const groups = this.groupContractsByCategory(contracts);

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
import { GateKitConfig, Project, CreateProjectData } from './types';
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
    const hasBody = ['POST', 'PUT', 'PATCH'].includes(httpMethod);

    if (methodName === 'create') {
      return `async create(data: CreateProjectData): Promise<Project> {
    const response = await this.client.post<Project>('${path}', data);
    return response.data;
  }`;
    }

    if (methodName === 'list') {
      return `async list(): Promise<Project[]> {
    const response = await this.client.get<Project[]>('${path}');
    return response.data;
  }`;
    }

    return `async ${methodName}(): Promise<any> {
    const response = await this.client.${httpMethod.toLowerCase()}<any>('${path}');
    return response.data;
  }`;
  }

  private getMethodName(command: string): string {
    const parts = command.split(' ');
    return parts[parts.length - 1]; // 'projects create' -> 'create'
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