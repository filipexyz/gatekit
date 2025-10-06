import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { McpToolRegistryService } from './mcp-tool-registry.service';
import { McpToolCallResponse } from '../interfaces/mcp-tool.interface';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';

/**
 * Executes MCP tool calls by invoking the actual API endpoints
 */
@Injectable()
export class McpExecutorService {
  private readonly logger = new Logger(McpExecutorService.name);
  private readonly apiBaseUrl: string;

  constructor(
    private readonly toolRegistry: McpToolRegistryService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    // Use internal API URL (localhost) for tool execution
    const port = this.configService.get('PORT', 3000);
    this.apiBaseUrl = `http://localhost:${port}`;
  }

  /**
   * Execute a tool by making an HTTP request to the corresponding API endpoint
   */
  async executeTool(
    toolName: string,
    args: Record<string, any>,
    authContext: any,
  ): Promise<McpToolCallResponse> {
    const tool = this.toolRegistry.getTool(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    const contractMetadata = this.toolRegistry.getContractMetadata(toolName);
    if (!contractMetadata) {
      throw new Error(`Contract metadata not found for tool: ${toolName}`);
    }

    this.logger.debug(
      `Tool ${toolName} - Auth context: ${JSON.stringify(authContext)}`,
    );
    this.logger.debug(`Tool ${toolName} - Args: ${JSON.stringify(args)}`);

    // Build the API request
    const { httpMethod, path } = contractMetadata;
    const { url, pathParams } = this.buildUrl(path, args, authContext);
    const headers = this.buildHeaders(authContext);
    const body = this.buildBody(httpMethod, args, pathParams);

    this.logger.debug(`Executing tool ${toolName}: ${httpMethod} ${url}`);

    try {
      // Make HTTP request
      let response;
      switch (httpMethod.toUpperCase()) {
        case 'GET':
          response = await firstValueFrom(
            this.httpService.get(url, { headers }),
          );
          break;
        case 'POST':
          response = await firstValueFrom(
            this.httpService.post(url, body, { headers }),
          );
          break;
        case 'PATCH':
          response = await firstValueFrom(
            this.httpService.patch(url, body, { headers }),
          );
          break;
        case 'DELETE':
          response = await firstValueFrom(
            this.httpService.delete(url, { headers }),
          );
          break;
        default:
          throw new Error(`Unsupported HTTP method: ${httpMethod}`);
      }

      // Format response as MCP tool result
      return this.formatResponse(response.data);
    } catch (error) {
      this.logger.error(
        `Tool execution failed for ${toolName}:`,
        error.response?.data || error.message,
      );
      throw new Error(
        error.response?.data?.message ||
          error.message ||
          'Tool execution failed',
      );
    }
  }

  /**
   * Build API URL with path parameters
   * Priority: args > authContext.project > throw error
   * Returns: { url, pathParams } where pathParams is set of params used in URL
   */
  private buildUrl(
    path: string,
    args: Record<string, any>,
    authContext: any,
  ): { url: string; pathParams: Set<string> } {
    let url = path;
    const pathParams = new Set<string>();

    // Replace path parameters (e.g., :project, :id)
    const paramMatches = path.match(/:(\w+)/g);
    if (paramMatches) {
      for (const param of paramMatches) {
        const paramName = param.substring(1); // Remove ':'
        pathParams.add(paramName);

        // Get value with priority: args[paramName] > authContext.project (for :project only) > error
        let value = args[paramName];

        if (!value && paramName === 'project' && authContext?.project?.id) {
          // For API key users, project comes from auth context
          value = authContext.project.id;
        }

        if (value) {
          url = url.replace(param, value);
        } else {
          throw new Error(
            `Missing required path parameter: ${paramName}. ` +
              `Please provide it in the tool arguments${paramName === 'project' ? ' or authenticate with an API key scoped to a project' : ''}.`,
          );
        }
      }
    }

    // Add query parameters for GET requests (excluding path params)
    const queryParams = this.extractQueryParams(args, pathParams);
    if (queryParams.length > 0) {
      url += '?' + queryParams.join('&');
    }

    return { url: `${this.apiBaseUrl}${url}`, pathParams };
  }

  /**
   * Build request headers with authentication
   */
  private buildHeaders(authContext: any): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authContext?.authType === 'api-key' && authContext.apiKey) {
      headers['X-API-Key'] = authContext.apiKey;
    } else if (authContext?.authType === 'jwt' && authContext.token) {
      headers['Authorization'] = `Bearer ${authContext.token}`;
    }

    return headers;
  }

  /**
   * Build request body, excluding path parameters
   * Path parameters should only be in the URL, not duplicated in the body
   */
  private buildBody(
    httpMethod: string,
    args: Record<string, any>,
    pathParams: Set<string>,
  ): Record<string, any> | undefined {
    if (['GET', 'DELETE'].includes(httpMethod.toUpperCase())) {
      return undefined;
    }

    // Exclude path parameters from body to avoid sending them twice
    const body: Record<string, any> = {};
    for (const [key, value] of Object.entries(args)) {
      if (!pathParams.has(key)) {
        body[key] = value;
      }
    }

    return body;
  }

  /**
   * Extract query parameters from arguments, excluding path parameters
   */
  private extractQueryParams(
    args: Record<string, any>,
    pathParams: Set<string>,
  ): string[] {
    const params: string[] = [];

    for (const [key, value] of Object.entries(args)) {
      // Skip path parameters and undefined values
      if (!pathParams.has(key) && value !== undefined) {
        params.push(`${key}=${encodeURIComponent(String(value))}`);
      }
    }

    return params;
  }

  /**
   * Format API response as MCP tool result
   */
  private formatResponse(data: any): McpToolCallResponse {
    // If data is already in MCP format, return it
    if (data?.content && Array.isArray(data.content)) {
      return data;
    }

    // Convert to MCP format
    return {
      content: [
        {
          type: 'text',
          text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
        },
      ],
      isError: false,
    };
  }
}
