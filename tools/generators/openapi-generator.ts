#!/usr/bin/env ts-node

import * as fs from 'fs/promises';
import * as path from 'path';
import { ExtractedContract } from '../extractors/contract-extractor.service';

interface OpenAPISpec {
  openapi: string;
  info: any;
  servers: any[];
  paths: Record<string, any>;
  components: {
    schemas: Record<string, any>;
    securitySchemes: Record<string, any>;
  };
  security: any[];
}

export class OpenAPIGenerator {
  async generateFromContracts(
    contractsPath: string,
    outputDir: string,
  ): Promise<void> {
    console.log('🔧 Generating OpenAPI specification from contracts...');

    // Load contracts (containing all type definitions)
    const contractsContent = await fs.readFile(contractsPath, 'utf-8');
    const contracts: ExtractedContract[] = JSON.parse(contractsContent);

    // Get type definitions from contracts
    const typeDefinitions = contracts[0]?.typeDefinitions || {};

    console.log(`📝 Generating OpenAPI spec for ${contracts.length} endpoints`);

    // Generate OpenAPI specification
    const openApiSpec = this.generateOpenAPISpec(contracts, typeDefinitions);

    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });

    // Write OpenAPI files
    await this.writeOpenAPIFiles(outputDir, openApiSpec);

    console.log(
      `✅ OpenAPI specification generated successfully in ${outputDir}`,
    );
    console.log(`📖 Ready for: Swagger UI, Postman, API documentation tools`);
  }

  private generateOpenAPISpec(
    contracts: ExtractedContract[],
    typeDefinitions: Record<string, string>,
  ): OpenAPISpec {
    return {
      openapi: '3.0.3',
      info: {
        title: 'GateKit API',
        description:
          'Universal messaging gateway API - send messages across multiple platforms',
        version: '1.0.0',
        contact: {
          name: 'GateKit Support',
          url: 'https://gatekit.dev',
          email: 'contact@gatekit.dev',
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
      servers: [
        {
          url: 'https://api.gatekit.dev',
          description: 'Production server',
        },
        {
          url: 'https://gatekit-dev.fly.dev',
          description: 'Development server',
        },
      ],
      paths: this.generatePaths(contracts),
      components: {
        schemas: this.generateSchemas(typeDefinitions),
        securitySchemes: {
          ApiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key',
            description: 'GateKit API key from your project dashboard',
          },
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT token from Auth0 authentication',
          },
        },
      },
      security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
    };
  }

  private generatePaths(contracts: ExtractedContract[]): Record<string, any> {
    const paths: Record<string, any> = {};

    contracts.forEach((contract) => {
      const { path, httpMethod, contractMetadata } = contract;
      const method = httpMethod.toLowerCase();

      // Convert path parameters to OpenAPI format
      const openApiPath = path.replace(/:([a-zA-Z][a-zA-Z0-9]*)/g, '{$1}');

      if (!paths[openApiPath]) {
        paths[openApiPath] = {};
      }

      paths[openApiPath][method] = {
        summary: contractMetadata.description,
        description: contractMetadata.description,
        operationId: this.generateOperationId(contractMetadata.command),
        tags: [contractMetadata.category || 'General'],
        security: [{ ApiKeyAuth: contractMetadata.requiredScopes || [] }],
        parameters: this.generateParameters(path, contractMetadata),
        ...(contractMetadata.inputType && {
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: `#/components/schemas/${contractMetadata.inputType}`,
                },
              },
            },
          },
        }),
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: contractMetadata.outputType
                  ? {
                      $ref: `#/components/schemas/${contractMetadata.outputType.replace('[]', '')}`,
                    }
                  : { type: 'object' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      };
    });

    return paths;
  }

  private generateParameters(path: string, contractMetadata: any): any[] {
    const parameters: any[] = [];

    // Extract path parameters
    const pathParams = path.match(/:([a-zA-Z][a-zA-Z0-9]*)/g);
    if (pathParams) {
      pathParams.forEach((param) => {
        const paramName = param.substring(1);
        parameters.push({
          name: paramName,
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: `${paramName} parameter`,
        });
      });
    }

    // Add query parameters from contract options (for GET requests)
    if (contractMetadata.options && !contractMetadata.inputType) {
      Object.entries(contractMetadata.options).forEach(
        ([name, config]: [string, any]) => {
          parameters.push({
            name,
            in: 'query',
            required: config.required || false,
            schema: {
              type: config.type || 'string',
              ...(config.choices && { enum: config.choices }),
              ...(config.default !== undefined && { default: config.default }),
            },
            description: config.description || name,
          });
        },
      );
    }

    return parameters;
  }

  private generateSchemas(
    typeDefinitions: Record<string, string>,
  ): Record<string, any> {
    const schemas: Record<string, any> = {};

    // Convert TypeScript interfaces to OpenAPI schemas
    Object.entries(typeDefinitions).forEach(([typeName, definition]) => {
      const schema = this.convertTypeScriptToOpenAPISchema(
        definition,
        typeName,
      );
      if (schema) {
        schemas[typeName] = schema;
      }
    });

    // Add common error response schema
    schemas.ErrorResponse = {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Error message' },
        error: { type: 'string', description: 'Error type' },
        statusCode: { type: 'number', description: 'HTTP status code' },
      },
      required: ['message', 'statusCode'],
    };

    return schemas;
  }

  private convertTypeScriptToOpenAPISchema(
    definition: string,
    typeName: string,
  ): any {
    // Handle type aliases (enums) first
    if (definition.includes(' = ') && definition.includes('|')) {
      // This is a type alias like: export type PlatformType = 'discord' | 'telegram';
      const typeMatch = definition.match(/export type \w+ = (.+);/);
      if (typeMatch) {
        const enumValues = typeMatch[1]
          .split('|')
          .map((v) => v.trim().replace(/'/g, ''));
        return {
          type: 'string',
          enum: enumValues,
        };
      }
    }

    // Handle interfaces
    const properties: Record<string, any> = {};
    const required: string[] = [];

    // Extract properties from TypeScript interface
    const lines = definition.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed &&
        !trimmed.startsWith('export') &&
        !trimmed.startsWith('}') &&
        trimmed.includes(':')
      ) {
        const match = trimmed.match(/(\w+)(\?)?:\s*(.+);?$/);
        if (match) {
          const [, propName, optional, propType] = match;

          if (!optional) {
            required.push(propName);
          }

          // Clean the property type (remove semicolon and whitespace)
          const cleanType = propType.replace(/;$/, '').trim();
          properties[propName] = this.convertTypeToOpenAPIProperty(cleanType);
        }
      }
    }

    return {
      type: 'object',
      properties,
      ...(required.length > 0 && { required }),
    };
  }

  private convertTypeToOpenAPIProperty(tsType: string): any {
    // Convert TypeScript types to OpenAPI property schemas
    if (tsType === 'string') return { type: 'string' };
    if (tsType === 'number') return { type: 'number' };
    if (tsType === 'boolean') return { type: 'boolean' };
    if (tsType === 'Date') return { type: 'string', format: 'date-time' };
    if (tsType === 'any') return { type: 'object' };
    if (tsType.includes("'") && tsType.includes('|')) {
      // Handle enum types like 'development' | 'staging' | 'production'
      const values = tsType.split('|').map((v) => v.trim().replace(/'/g, ''));
      return { type: 'string', enum: values };
    }
    if (tsType.endsWith('[]')) {
      // Handle array types
      const itemType = tsType.slice(0, -2);
      return {
        type: 'array',
        items: this.convertTypeToOpenAPIProperty(itemType),
      };
    }
    if (tsType.startsWith('Record<')) {
      // Handle Record<string, unknown> types
      return { type: 'object', additionalProperties: true };
    }

    // Reference to another schema
    return { $ref: `#/components/schemas/${tsType}` };
  }

  private generateOperationId(command: string): string {
    // Convert "projects create" to "projectsCreate"
    return command
      .split(' ')
      .map((word, index) =>
        index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1),
      )
      .join('');
  }

  private async writeOpenAPIFiles(
    outputDir: string,
    spec: OpenAPISpec,
  ): Promise<void> {
    // Write OpenAPI JSON
    const specFile = path.join(outputDir, 'openapi.json');
    await fs.writeFile(specFile, JSON.stringify(spec, null, 2));

    // Write OpenAPI YAML
    const yamlContent = this.jsonToYaml(spec);
    const yamlFile = path.join(outputDir, 'openapi.yaml');
    await fs.writeFile(yamlFile, yamlContent);

    // Write documentation README
    const readme = this.generateOpenAPIReadme(spec);
    await fs.writeFile(path.join(outputDir, 'README.md'), readme);
  }

  private jsonToYaml(obj: any, indent = 0): string {
    const spaces = '  '.repeat(indent);
    let yaml = '';

    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) continue;

      yaml += `${spaces}${key}:`;

      if (typeof value === 'object' && !Array.isArray(value)) {
        yaml += '\n' + this.jsonToYaml(value, indent + 1);
      } else if (Array.isArray(value)) {
        yaml += '\n';
        value.forEach((item) => {
          if (typeof item === 'object') {
            yaml += `${spaces}  -\n${this.jsonToYaml(item, indent + 2)}`;
          } else {
            yaml += `${spaces}  - ${JSON.stringify(item)}\n`;
          }
        });
      } else {
        yaml += ` ${JSON.stringify(value)}\n`;
      }
    }

    return yaml;
  }

  private generateOpenAPIReadme(spec: OpenAPISpec): string {
    return `# GateKit API Documentation

OpenAPI specification for GateKit universal messaging gateway.

## Overview

${spec.info.description}

## Quick Start

### Authentication

GateKit supports two authentication methods:

1. **API Key** (Recommended)
   \`\`\`
   X-API-Key: your-api-key
   \`\`\`

2. **JWT Token**
   \`\`\`
   Authorization: Bearer your-jwt-token
   \`\`\`

### Example Request

\`\`\`bash
curl -X GET "https://api.gatekit.dev/api/v1/projects" \\
  -H "X-API-Key: your-api-key"
\`\`\`

## Documentation Tools

- **Swagger UI**: Import \`openapi.json\` for interactive documentation
- **Postman**: Import for API testing and collection management
- **Insomnia**: Load specification for API client testing
- **API Documentation**: Generate docs with any OpenAPI-compatible tool

## Endpoints

${Object.keys(spec.paths).length} endpoints across ${new Set(Object.values(spec.paths).flatMap((p: any) => Object.values(p).map((op: any) => op.tags?.[0]))).size} categories.

## Generated Assets

- \`openapi.json\` - OpenAPI 3.0.3 specification
- \`openapi.yaml\` - YAML format for documentation tools
- \`README.md\` - This documentation file

---

**GateKit** - Universal messaging gateway for modern applications.
`;
  }
}

// CLI execution
async function main() {
  const generator = new OpenAPIGenerator();
  const contractsPath = path.join(
    __dirname,
    '../../generated/contracts/contracts.json',
  );
  const outputDir = path.join(__dirname, '../../generated/openapi');

  await generator.generateFromContracts(contractsPath, outputDir);
}

if (require.main === module) {
  main().catch(console.error);
}
