#!/usr/bin/env ts-node

import * as fs from 'fs/promises';
import * as path from 'path';
import { ExtractedContract } from '../extractors/contract-extractor.service';
import { TemplateUtils } from './template-utils';
import packageJson from '../../package.json';

interface GeneratedN8N {
  nodeFile: string;
  credentialsFile: string;
  packageJson: string;
  gulpfile: string;
  indexFile: string;
  contracts: ExtractedContract[];
}

export class N8NGenerator {
  async generateFromContracts(
    contractsPath: string,
    outputDir: string,
  ): Promise<void> {
    console.log('🔧 Generating n8n community node from contracts...');

    // Load contracts (containing all type definitions)
    const contractsContent = await fs.readFile(contractsPath, 'utf-8');
    const contracts: ExtractedContract[] = JSON.parse(contractsContent);

    // Validate contract structure
    if (!Array.isArray(contracts) || contracts.length === 0) {
      throw new Error('Invalid contracts file: empty or not an array');
    }

    console.log(
      `🎯 Generating n8n node for ${contracts.length} GateKit operations`,
    );

    // Generate n8n node components
    const n8nNode = this.generateN8NNode(contracts);

    // Create output directory structure
    await this.createN8NPackageStructure(outputDir, n8nNode);

    console.log(`✅ n8n node generated successfully in ${outputDir}`);
    console.log(`📦 Ready for: cd ${outputDir} && npm publish`);
  }

  private generateN8NNode(contracts: ExtractedContract[]): GeneratedN8N {
    return {
      nodeFile: this.generateNodeFile(contracts),
      credentialsFile: this.generateCredentialsFile(),
      packageJson: this.generatePackageJson(),
      gulpfile: this.generateGulpfile(),
      indexFile: this.generateIndexFile(),
      contracts,
    };
  }

  private generateNodeFile(contracts: ExtractedContract[]): string {
    const resources = this.generateResources(contracts);
    const operations = this.generateOperations(contracts);

    return `import { INodeType, INodeTypeDescription } from 'n8n-workflow';

export class GateKit implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'GateKit',
    name: 'GateKit',
    icon: 'file:gatekit.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Universal messaging gateway - send messages across multiple platforms',
    defaults: {
      name: 'GateKit',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'GateKitApi',
        required: true,
      },
    ],
    requestDefaults: {
      baseURL: '={{$credentials.apiUrl}}',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    },
    properties: [
      ${resources},
      ${operations}
    ],
  };
}
`;
  }

  private generateResources(contracts: ExtractedContract[]): string {
    // Group contracts by category for n8n resources
    const categories = this.groupContractsByCategory(contracts);

    const resourceOptions = Object.keys(categories)
      .sort()
      .map((category) => ({
        name: category,
        value: category.toLowerCase(),
      }));

    return `{
      displayName: 'Resource',
      name: 'resource',
      type: 'options',
      noDataExpression: true,
      options: [
        ${resourceOptions
          .map((opt) => `{ name: '${opt.name}', value: '${opt.value}' }`)
          .join(',\n        ')}
      ],
      default: '${resourceOptions[0]?.value || 'projects'}',
    }`;
  }

  private generateOperations(contracts: ExtractedContract[]): string {
    const categories = this.groupContractsByCategory(contracts);

    return Object.entries(categories)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, categoryContracts]) => {
        const categoryValue = category.toLowerCase();

        const operationOptions = categoryContracts.map((contract) => {
          const command = contract.contractMetadata.command;
          const operation = command.split(' ')[1]; // 'projects create' -> 'create'

          return `{
          name: '${operation.charAt(0).toUpperCase() + operation.slice(1)}',
          value: '${operation}',
          action: '${contract.contractMetadata.description}',
          description: '${contract.contractMetadata.description}',
          routing: {
            request: {
              method: '${contract.httpMethod}',
              url: '${this.convertPathForN8N(contract.path)}',
              ${contract.contractMetadata.inputType ? 'body: {},' : ''}
            },
          },
        }`;
        });

        // Add operation parameters for this category
        const operationParameters =
          this.generateOperationParameters(categoryContracts);

        return `{
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: {
            resource: ['${categoryValue}'],
          },
        },
        options: [
          ${operationOptions.join(',\n          ')}
        ],
        default: '${categoryContracts[0] ? categoryContracts[0].contractMetadata.command.split(' ')[1] : 'list'}',
      }${operationParameters ? ',\n      ' + operationParameters : ''}`;
      })
      .join(',\n      ');
  }

  private generateOperationParameters(contracts: ExtractedContract[]): string {
    const parameters: string[] = [];

    contracts.forEach((contract) => {
      const { contractMetadata } = contract;
      const operation = contractMetadata.command.split(' ')[1];
      const category = contractMetadata.category?.toLowerCase() || 'general';

      // Add parameters for this operation
      if (contractMetadata.options) {
        Object.entries(contractMetadata.options).forEach(
          ([optionName, optionConfig]) => {
            const paramType = this.getN8NParameterType(
              optionConfig.type || 'string',
            );

            parameters.push(`{
            displayName: '${optionConfig.description || optionName}',
            name: '${optionName}',
            type: '${paramType}',
            required: ${optionConfig.required || false},
            default: ${JSON.stringify(optionConfig.default || '')},
            ${optionConfig.choices ? `options: [${optionConfig.choices.map((choice) => `{name: '${choice}', value: '${choice}'}`).join(', ')}],` : ''}
            displayOptions: {
              show: {
                resource: ['${category}'],
                operation: ['${operation}'],
              },
            },
            routing: {
              request: {
                ${paramType === 'json' ? 'body' : 'qs'}: {
                  '${optionName}': '={{$value}}',
                },
              },
            },
          }`);
          },
        );
      }

      // Add path parameters (including project as parameter, not credential)
      const pathParams = this.extractPathParameters(contract.path);
      pathParams.forEach((param) => {
        const displayName =
          param === 'project'
            ? 'Project'
            : param.charAt(0).toUpperCase() + param.slice(1);
        const description =
          param === 'project'
            ? 'Project identifier to operate on'
            : `${param} parameter`;
        const defaultValue = param === 'project' ? 'default' : '';

        parameters.push(`{
          displayName: '${displayName}',
          name: '${param}',
          type: 'string',
          required: true,
          default: '${defaultValue}',
          description: '${description}',
          displayOptions: {
            show: {
              resource: ['${category}'],
              operation: ['${operation}'],
            },
          },
        }`);
      });
    });

    return parameters.join(',\n      ');
  }

  private generateCredentialsFile(): string {
    return `import {
  IAuthenticateGeneric,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class GateKitApi implements ICredentialType {
  name = 'GateKitApi';
  displayName = 'GateKit API';
  documentationUrl = 'https://docs.gatekit.dev/authentication';
  properties: INodeProperties[] = [
    {
      displayName: 'API URL',
      name: 'apiUrl',
      type: 'string',
      default: 'https://api.gatekit.dev',
      description: 'GateKit API base URL',
    },
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      description: 'GateKit API key from your project dashboard',
    },
  ];

  authenticate = {
    type: 'generic',
    properties: {
      headers: {
        'X-API-Key': '={{$credentials.apiKey}}',
      },
    },
  } as IAuthenticateGeneric;
}
`;
  }

  private generatePackageJson(): string {
    return JSON.stringify(
      {
        name: 'n8n-nodes-gatekit',
        version: packageJson.version,
        description:
          'n8n community node for GateKit universal messaging gateway',
        keywords: [
          'n8n-community-node-package',
          'gatekit',
          'messaging',
          'automation',
          'communication',
        ],
        license: 'MIT',
        homepage: 'https://gatekit.dev',
        author: {
          name: 'GateKit',
          email: 'contact@gatekit.dev',
        },
        repository: {
          type: 'git',
          url: 'git+https://github.com/gatekit/n8n-nodes-gatekit.git',
        },
        main: 'index.js',
        scripts: {
          build: 'tsc && gulp build:icons',
          dev: 'tsc --watch',
          format: 'prettier nodes credentials --write',
          lint: 'eslint nodes credentials package.json',
          'lint:fix': 'eslint nodes credentials package.json --fix',
          prepublishOnly: 'npm run build',
        },
        files: ['dist'],
        n8n: {
          n8nNodesApiVersion: 1,
          credentials: ['dist/credentials/GateKitApi.credentials.js'],
          nodes: ['dist/nodes/GateKit/GateKit.node.js'],
        },
        devDependencies: {
          '@types/node': '^20.0.0',
          eslint: '^8.0.0',
          gulp: '^4.0.2',
          'n8n-workflow': '*',
          prettier: '^3.0.0',
          typescript: '^5.0.0',
        },
        peerDependencies: {
          'n8n-workflow': '*',
        },
      },
      null,
      2,
    );
  }

  private generateIndexFile(): string {
    return `export * from './dist/nodes/GateKit/GateKit.node';
export * from './dist/credentials/GateKitApi.credentials';
`;
  }

  private getN8NParameterType(contractType: string): string {
    switch (contractType) {
      case 'string':
        return 'string';
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'object':
        return 'json';
      default:
        return 'string';
    }
  }

  private convertPathForN8N(path: string): string {
    // Convert GateKit API paths to n8n format using proper n8n expression syntax
    // /api/v1/projects/:project/messages/send -> =/api/v1/projects/{{ $parameter["project"] }}/messages/send
    // Dynamically replace all path parameters using regex
    return (
      '=' +
      path.replace(
        /:([a-zA-Z][a-zA-Z0-9]*)/g,
        (_, param) => `{{ $parameter["${param}"] }}`,
      )
    );
  }

  private extractPathParameters(path: string): string[] {
    const matches = path.match(/:([a-zA-Z][a-zA-Z0-9]*)/g);
    return matches ? matches.map((match) => match.substring(1)) : [];
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

  private async createN8NPackageStructure(
    outputDir: string,
    n8nNode: GeneratedN8N,
  ): Promise<void> {
    try {
      // Copy template files first (tsconfig.json, .gitignore, .github/workflows, .eslintrc.js, etc.)
      const operationsList = this.generateOperationsList(n8nNode.contracts);
      await TemplateUtils.copyTemplateFiles('n8n', outputDir, {
        OPERATIONS_LIST: operationsList,
      });

      // Create directory structure
      const nodesDir = path.join(outputDir, 'nodes', 'GateKit');
      const credentialsDir = path.join(outputDir, 'credentials');

      await fs.mkdir(nodesDir, { recursive: true });
      await fs.mkdir(credentialsDir, { recursive: true });

      // Write generated n8n node files
      await Promise.all([
        fs.writeFile(path.join(nodesDir, 'GateKit.node.ts'), n8nNode.nodeFile),
        fs.writeFile(
          path.join(nodesDir, 'GateKit.node.json'),
          this.generateNodeCodex(),
        ),
        fs.writeFile(
          path.join(credentialsDir, 'GateKitApi.credentials.ts'),
          n8nNode.credentialsFile,
        ),
        fs.writeFile(path.join(outputDir, 'package.json'), n8nNode.packageJson),
        fs.writeFile(path.join(outputDir, 'gulpfile.js'), n8nNode.gulpfile),
        fs.writeFile(path.join(outputDir, 'index.ts'), n8nNode.indexFile),
        this.copyGateKitIcon(outputDir),
      ]);
    } catch (error) {
      throw new Error(
        `Failed to create n8n package structure: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private generateNodeCodex(): string {
    return JSON.stringify(
      {
        node: 'n8n-nodes-gatekit.GateKit',
        nodeVersion: '1.0',
        codexVersion: '1.0',
        categories: ['Communication'],
        resources: {
          credentialDocumentation: [
            {
              url: 'https://docs.gatekit.dev/authentication',
            },
          ],
          primaryDocumentation: [
            {
              url: 'https://docs.gatekit.dev',
            },
          ],
        },
      },
      null,
      2,
    );
  }

  private generateGulpfile(): string {
    return `const { src, dest } = require('gulp');

function copyIcons() {
  return src('nodes/**/*.{png,svg}')
    .pipe(dest('dist/nodes'));
}

exports['build:icons'] = copyIcons;
`;
  }

  private async copyGateKitIcon(outputDir: string): Promise<void> {
    // Create a simple GateKit SVG icon
    const iconSvg = `<svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
  <rect width="60" height="60" rx="12" fill="#6366f1"/>
  <text x="30" y="35" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">GK</text>
</svg>`;

    const iconPath = path.join(outputDir, 'nodes', 'GateKit', 'gatekit.svg');
    await fs.writeFile(iconPath, iconSvg);
  }
  private generateOperationsList(contracts: ExtractedContract[]): string {
    const categories = this.groupContractsByCategory(contracts);
    const operationsList = Object.entries(categories)
      .map(([category, contracts]) => {
        const ops = contracts
          .map(
            (c) =>
              `- **${c.contractMetadata.command}** - ${c.contractMetadata.description}`,
          )
          .join('\n');
        return `### ${category}\n\n${ops}`;
      })
      .join('\n\n');
    return operationsList;
  }
}

// CLI execution
async function main() {
  const generator = new N8NGenerator();
  const contractsPath = path.join(
    __dirname,
    '../../generated/contracts/contracts.json',
  );
  const outputDir = path.join(__dirname, '../../generated/n8n');

  await generator.generateFromContracts(contractsPath, outputDir);
}

if (require.main === module) {
  main().catch(console.error);
}
