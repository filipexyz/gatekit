import { Injectable } from '@nestjs/common';
import { ContractExtractorService } from '../../../tools/extractors/contract-extractor.service';
import { McpTool, McpToolInputSchema } from '../interfaces/mcp-tool.interface';
import { SdkContractMetadata } from '../../common/decorators/sdk-contract.decorator';

/**
 * Converts SDK Contracts to MCP Tools dynamically
 */
@Injectable()
export class McpToolRegistryService {
  private tools: Map<string, McpTool> = new Map();
  private contractMap: Map<string, any> = new Map(); // Maps tool name to contract metadata

  constructor(private readonly contractExtractor: ContractExtractorService) {}

  /**
   * Initialize MCP tools from SDK contracts
   */
  async initialize(): Promise<void> {
    const contracts = await this.contractExtractor.extractContracts();

    for (const contract of contracts) {
      const toolName = this.contractToToolName(
        contract.contractMetadata.command,
      );
      // Skip endpoints marked as excluded from MCP
      if (contract.contractMetadata.excludeFromMcp) {
        continue;
      }

      const tool = this.convertContractToTool(
        contract.contractMetadata,
        contract.path,
      );

      this.tools.set(toolName, tool);
      this.contractMap.set(toolName, {
        httpMethod: contract.httpMethod,
        path: contract.path,
        inputType: contract.contractMetadata.inputType,
        outputType: contract.contractMetadata.outputType,
        requiredScopes: contract.contractMetadata.requiredScopes || [],
        options: contract.contractMetadata.options || {},
      });
    }
  }

  /**
   * Get all registered MCP tools
   */
  getAllTools(): McpTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools filtered by scopes
   */
  getToolsByScopes(scopes: string[]): McpTool[] {
    const filteredTools: McpTool[] = [];

    for (const [toolName, tool] of this.tools.entries()) {
      const metadata = this.contractMap.get(toolName);
      const requiredScopes = metadata?.requiredScopes || [];

      // If no scopes required, tool is always accessible
      if (requiredScopes.length === 0) {
        filteredTools.push(tool);
        continue;
      }

      // Check if user has any of the required scopes
      const hasAccess = requiredScopes.some((required: string) =>
        scopes.some((userScope) => this.matchesScope(userScope, required)),
      );

      if (hasAccess) {
        filteredTools.push(tool);
      }
    }

    return filteredTools;
  }

  /**
   * Check if user scope matches required scope (supports wildcards)
   */
  private matchesScope(userScope: string, requiredScope: string): boolean {
    // Exact match
    if (userScope === requiredScope) {
      return true;
    }

    // Wildcard support: "messages:*" matches "messages:write", "messages:read", etc.
    if (userScope.endsWith(':*')) {
      const prefix = userScope.slice(0, -2);
      return requiredScope.startsWith(prefix + ':');
    }

    return false;
  }

  /**
   * Get tool by name
   */
  getTool(name: string): McpTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get contract metadata for tool
   */
  getContractMetadata(toolName: string): any {
    return this.contractMap.get(toolName);
  }

  /**
   * Convert SDK contract command to MCP tool name
   * Example: "projects create" -> "gatekit_projects_create"
   */
  private contractToToolName(command: string): string {
    return `gatekit_${command.replace(/\s+/g, '_')}`;
  }

  /**
   * Convert SDK contract to MCP tool definition
   */
  private convertContractToTool(
    contract: SdkContractMetadata,
    path: string,
  ): McpTool {
    const inputSchema: McpToolInputSchema = {
      type: 'object',
      properties: {},
    };
    const requiredSet = new Set<string>();

    // Extract route parameters from path (e.g., :project, :id, :keyId)
    const pathParams = path.match(/:(\w+)/g);
    if (pathParams) {
      for (const param of pathParams) {
        const paramName = param.substring(1); // Remove ':'
        // Skip :project - always auto-filled from API key's authenticated project
        if (paramName === 'project') {
          continue;
        }

        // Add other route parameters as required
        inputSchema.properties[paramName] = {
          type: 'string',
          description: `${paramName.charAt(0).toUpperCase() + paramName.slice(1)} identifier`,
        };
        requiredSet.add(paramName);
      }
    }

    // Convert contract options to JSON Schema properties
    if (contract.options) {
      for (const [key, option] of Object.entries(contract.options)) {
        const property: any = {
          description: option.description || '',
        };

        // Map SDK types to JSON Schema types
        switch (option.type) {
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

        // Add enum for choices
        if (option.choices && option.choices.length > 0) {
          property.enum = option.choices;
        }

        // Add default value
        if (option.default !== undefined) {
          property.default = option.default;
        }

        inputSchema.properties[key] = property;

        // Mark as required (Set automatically handles duplicates)
        if (option.required) {
          requiredSet.add(key);
        }
      }
    }

    // Only add required field if there are required properties
    if (requiredSet.size > 0) {
      inputSchema.required = Array.from(requiredSet);
    }

    return {
      name: this.contractToToolName(contract.command),
      description: contract.description,
      inputSchema,
    };
  }
}
