#!/usr/bin/env ts-node

import * as fs from 'fs/promises';
import * as path from 'path';
import { ExtractedContract } from '../extractors/contract-extractor.service';
import { TemplateUtils } from './template-utils';
import packageJson from '../../package.json';

interface GeneratedN8N {
  nodeFile: string;
  triggerNodeFile: string;
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
      triggerNodeFile: this.generateTriggerNodeFile(),
      credentialsFile: this.generateCredentialsFile(),
      packageJson: this.generatePackageJson(),
      gulpfile: this.generateGulpfile(),
      indexFile: this.generateIndexFile(),
      contracts,
    };
  }

  private generateTriggerNodeFile(): string {
    return `import {
  IHookFunctions,
  IWebhookFunctions,
  INodeType,
  INodeTypeDescription,
  IWebhookResponseData,
} from 'n8n-workflow';

export class GateKitTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'GateKit Trigger',
    name: 'gateKitTrigger',
    icon: 'file:gatekit.svg',
    group: ['trigger'],
    version: 1,
    description: 'Triggers workflow when messages are received via GateKit',
    defaults: {
      name: 'GateKit Trigger',
    },
    inputs: [],
    outputs: ['main'],
    credentials: [
      {
        name: 'GateKitApi',
        required: true,
      },
    ],
    webhooks: [
      {
        name: 'default',
        httpMethod: 'POST',
        responseMode: 'onReceived',
        path: 'webhook',
      },
    ],
    properties: [
      {
        displayName: 'Project ID',
        name: 'projectId',
        type: 'string',
        default: 'default',
        required: true,
        description: 'The GateKit project ID to monitor for messages',
      },
      {
        displayName: 'Events',
        name: 'events',
        type: 'multiOptions',
        options: [
          {
            name: 'Message Received',
            value: 'message.received',
            description: 'Trigger when a message is received',
          },
          {
            name: 'Message Sent',
            value: 'message.sent',
            description: 'Trigger when a message is sent successfully',
          },
          {
            name: 'Message Failed',
            value: 'message.failed',
            description: 'Trigger when a message fails to send',
          },
          {
            name: 'Button Clicked',
            value: 'button.clicked',
            description: 'Trigger when a button is clicked',
          },
          {
            name: 'Reaction Added',
            value: 'reaction.added',
            description: 'Trigger when a reaction is added to a message',
          },
          {
            name: 'Reaction Removed',
            value: 'reaction.removed',
            description: 'Trigger when a reaction is removed from a message',
          },
        ],
        default: ['message.received'],
        required: true,
        description: 'The events to subscribe to',
      },
      {
        displayName: 'Webhook Name',
        name: 'webhookName',
        type: 'string',
        default: 'n8n Webhook',
        description: 'Name to identify this webhook in GateKit dashboard',
      },
    ],
  };

  webhookMethods = {
    default: {
      async checkExists(this: IHookFunctions): Promise<boolean> {
        const webhookData = this.getWorkflowStaticData('node');
        const credentials = await this.getCredentials('GateKitApi');

        if (webhookData.webhookId === undefined) {
          return false;
        }

        const projectId = this.getNodeParameter('projectId') as string;
        if (!projectId) {
          throw new Error('Project ID is required');
        }

        const apiUrl = credentials.apiUrl as string;

        try {
          const response = await this.helpers.request({
            method: 'GET',
            url: \`\${apiUrl}/api/v1/projects/\${projectId}/webhooks/\${webhookData.webhookId}\`,
            headers: {
              'X-API-Key': credentials.apiKey as string,
            },
            json: true,
          });

          return !!response;
        } catch (error: any) {
          if (error.statusCode === 404 || error.response?.status === 404) {
            delete webhookData.webhookId;
            delete webhookData.webhookSecret;
            delete webhookData.events;
            return false;
          }
          throw error;
        }
      },

      async create(this: IHookFunctions): Promise<boolean> {
        const webhookUrl = this.getNodeWebhookUrl('default') as string;
        const credentials = await this.getCredentials('GateKitApi');
        const projectId = this.getNodeParameter('projectId') as string;
        const events = this.getNodeParameter('events', []) as string[];
        const webhookName = this.getNodeParameter('webhookName', 'n8n Webhook') as string;

        if (!projectId) {
          throw new Error('Project ID is required');
        }

        if (webhookUrl.includes('//localhost')) {
          throw new Error(
            'The Webhook cannot work on "localhost". Please setup n8n on a custom domain or start with "--tunnel"!'
          );
        }

        const apiUrl = credentials.apiUrl as string;

        try {
          const response = await this.helpers.request({
            method: 'POST',
            url: \`\${apiUrl}/api/v1/projects/\${projectId}/webhooks\`,
            headers: {
              'X-API-Key': credentials.apiKey as string,
              'Content-Type': 'application/json',
            },
            body: {
              url: webhookUrl,
              events: events,
              name: webhookName,
              // Let GateKit auto-generate a secure secret
            },
            json: true,
          });

          if (!response || !response.id) {
            throw new Error('Invalid response from GateKit API: missing webhook ID');
          }

          const webhookData = this.getWorkflowStaticData('node');
          webhookData.webhookId = response.id;
          webhookData.webhookSecret = response.secret; // Store secret for HMAC validation
          webhookData.events = events;

          return true;
        } catch (error: any) {
          throw new Error(\`Failed to create GateKit webhook: \${error.message || String(error)}\`);
        }
      },

      async delete(this: IHookFunctions): Promise<boolean> {
        const webhookData = this.getWorkflowStaticData('node');
        const credentials = await this.getCredentials('GateKitApi');
        const projectId = this.getNodeParameter('projectId') as string;

        if (!projectId) {
          throw new Error('Project ID is required');
        }

        if (webhookData.webhookId === undefined) {
          return true;
        }

        const apiUrl = credentials.apiUrl as string;

        try {
          await this.helpers.request({
            method: 'DELETE',
            url: \`\${apiUrl}/api/v1/projects/\${projectId}/webhooks/\${webhookData.webhookId}\`,
            headers: {
              'X-API-Key': credentials.apiKey as string,
            },
            json: true,
          });

          delete webhookData.webhookId;
          delete webhookData.webhookSecret;
          delete webhookData.events;

          return true;
        } catch (error: any) {
          // Webhook might already be deleted
          if (error.statusCode === 404 || error.response?.status === 404) {
            delete webhookData.webhookId;
            delete webhookData.webhookSecret;
            delete webhookData.events;
            return true;
          }
          throw error;
        }
      },
    },
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const bodyData = this.getBodyData();
    const headers = this.getHeaderData();

    // Validate HMAC signature for security (GateKit format: sha256=<hash>)
    const webhookData = this.getWorkflowStaticData('node');
    const signatureHeader = headers['x-gatekit-signature'] as string;
    const timestamp = headers['x-gatekit-timestamp'] as string;

    // If we have a secret stored, signature validation is required
    if (webhookData.webhookSecret) {
      if (!signatureHeader || !timestamp) {
        throw new Error('Missing webhook signature or timestamp');
      }

      const crypto = require('crypto');

      // GateKit signature format: timestamp.body
      const signedPayload = \`\${timestamp}.\${JSON.stringify(bodyData)}\`;
      const expectedSignature = crypto
        .createHmac('sha256', webhookData.webhookSecret)
        .update(signedPayload)
        .digest('hex');

      // Extract signature (format: "sha256=<hash>")
      const signature = signatureHeader.replace('sha256=', '');

      if (signature !== expectedSignature) {
        throw new Error('Invalid webhook signature - possible security attack');
      }
    }

    // Process the webhook payload from GateKit
    // The payload structure depends on the event type
    return {
      workflowData: [this.helpers.returnJsonArray([bodyData])],
    };
  }
}
`;
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
          nodes: [
            'dist/nodes/GateKit/GateKit.node.js',
            'dist/nodes/GateKitTrigger/GateKitTrigger.node.js',
          ],
        },
        devDependencies: {
          '@types/node': '^24.6.2',
          eslint: '^9.36.0',
          gulp: '^5.0.1',
          'n8n-workflow': '*',
          prettier: '^3.6.2',
          typescript: '^5.9.3',
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
export * from './dist/nodes/GateKitTrigger/GateKitTrigger.node';
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
      const triggerNodesDir = path.join(outputDir, 'nodes', 'GateKitTrigger');
      const credentialsDir = path.join(outputDir, 'credentials');

      await fs.mkdir(nodesDir, { recursive: true });
      await fs.mkdir(triggerNodesDir, { recursive: true });
      await fs.mkdir(credentialsDir, { recursive: true });

      // Write generated n8n node files
      await Promise.all([
        fs.writeFile(path.join(nodesDir, 'GateKit.node.ts'), n8nNode.nodeFile),
        fs.writeFile(
          path.join(nodesDir, 'GateKit.node.json'),
          this.generateNodeCodex(),
        ),
        fs.writeFile(
          path.join(triggerNodesDir, 'GateKitTrigger.node.ts'),
          n8nNode.triggerNodeFile,
        ),
        fs.writeFile(
          path.join(triggerNodesDir, 'GateKitTrigger.node.json'),
          this.generateTriggerNodeCodex(),
        ),
        fs.writeFile(
          path.join(credentialsDir, 'GateKitApi.credentials.ts'),
          n8nNode.credentialsFile,
        ),
        fs.writeFile(path.join(outputDir, 'package.json'), n8nNode.packageJson),
        fs.writeFile(path.join(outputDir, 'gulpfile.js'), n8nNode.gulpfile),
        fs.writeFile(path.join(outputDir, 'index.ts'), n8nNode.indexFile),
        this.copyGateKitIcon(outputDir),
        this.copyGateKitIconToTrigger(outputDir),
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

  private generateTriggerNodeCodex(): string {
    return JSON.stringify(
      {
        node: 'n8n-nodes-gatekit.GateKitTrigger',
        nodeVersion: '1.0',
        codexVersion: '1.0',
        categories: ['Communication', 'Trigger'],
        resources: {
          credentialDocumentation: [
            {
              url: 'https://docs.gatekit.dev/authentication',
            },
          ],
          primaryDocumentation: [
            {
              url: 'https://docs.gatekit.dev/webhooks',
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

  private async copyGateKitIconToTrigger(outputDir: string): Promise<void> {
    // Create a GateKit Trigger SVG icon with a notification badge
    const iconSvg = `<svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
  <rect width="60" height="60" rx="12" fill="#6366f1"/>
  <text x="30" y="35" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">GK</text>
  <circle cx="45" cy="15" r="5" fill="#10b981"/>
</svg>`;

    const iconPath = path.join(
      outputDir,
      'nodes',
      'GateKitTrigger',
      'gatekit.svg',
    );
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
