/**
 * MCP Tool Definition Interface
 */

export interface McpToolInputSchema {
  type: 'object';
  properties: Record<string, any>;
  required?: string[];
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: McpToolInputSchema;
}

export interface McpToolsListResponse {
  tools: McpTool[];
  nextCursor?: string;
}

export interface McpToolCallRequest {
  name: string;
  arguments: Record<string, any>;
}

export interface McpToolCallContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
}

export interface McpToolCallResponse {
  content: McpToolCallContent[];
  isError?: boolean;
}
