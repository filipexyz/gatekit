import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Res,
  Req,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { McpToolRegistryService } from './services/mcp-tool-registry.service';
import { McpExecutorService } from './services/mcp-executor.service';
import {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
} from './interfaces/jsonrpc.interface';
import { AppAuthGuard } from '../common/guards/app-auth.guard';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { createHash } from 'crypto';

/**
 * MCP HTTP Streamable Transport Controller
 * Implements MCP specification 2025-03-26
 */
@Controller('mcp')
@UseGuards(AppAuthGuard)
export class McpController {
  private readonly logger = new Logger(McpController.name);

  /**
   * In-memory session storage for MCP connections
   * Note: Sessions are lost on server restart and don't scale across multiple instances.
   * For production multi-instance deployments, consider using Redis or similar.
   */
  private sessions: Map<string, { authContext: any }> = new Map();

  constructor(
    private readonly toolRegistry: McpToolRegistryService,
    private readonly executor: McpExecutorService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * POST /mcp - Handle JSON-RPC requests
   */
  @Post()
  async handlePost(
    @Body() message: JsonRpcRequest | JsonRpcNotification,
    @Headers('accept') accept: string,
    @Headers('mcp-session-id') sessionId: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    this.logger.debug(`MCP POST: ${JSON.stringify(message)}`);

    // Validate Accept header
    if (
      !accept?.includes('application/json') &&
      !accept?.includes('text/event-stream')
    ) {
      return res.status(400).json({
        jsonrpc: '2.0',
        id: 'id' in message ? message.id : null,
        error: {
          code: -32600,
          message:
            'Invalid Accept header. Must include application/json or text/event-stream',
        },
      });
    }

    // Handle initialization
    if (message.method === 'initialize') {
      return this.handleInitialize(message as JsonRpcRequest, req, res);
    }

    // Validate session for other methods
    if (sessionId && !this.sessions.has(sessionId)) {
      return res.status(401).json({
        jsonrpc: '2.0',
        id: 'id' in message ? message.id : null,
        error: {
          code: -32001,
          message: 'Invalid session. Please initialize first.',
        },
      });
    }

    // Handle notification (no response needed)
    if (!('id' in message)) {
      return res.status(HttpStatus.ACCEPTED).send();
    }

    // Handle request
    try {
      const response = await this.handleRequest(message, sessionId, req);
      return res.json(response);
    } catch (error) {
      this.logger.error(`MCP error: ${error.message}`, error.stack);
      return res.json({
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error.message,
        },
      });
    }
  }

  /**
   * GET /mcp - SSE stream for server-to-client messages
   */
  @Get()
  handleGet(
    @Headers('accept') accept: string,
    @Headers('mcp-session-id') sessionId: string | undefined,
    @Res() res: Response,
  ) {
    // Validate session
    if (!sessionId || !this.sessions.has(sessionId)) {
      return res.status(401).json({
        error: 'Invalid session. Please initialize first.',
      });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial connection event
    res.write(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`);

    // Keep connection alive
    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 30000);

    // Handle client disconnect
    res.on('close', () => {
      clearInterval(keepAlive);
      this.logger.debug(`SSE connection closed for session ${sessionId}`);
    });
  }

  /**
   * Handle initialize request
   */
  private async handleInitialize(
    message: JsonRpcRequest,
    req: Request,
    res: Response,
  ): Promise<void> {
    const sessionId = randomUUID();
    const authContext = (req as any).authContext;

    // Extract authentication details from headers
    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers['x-api-key'] as string;

    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;

    // Get API key scopes and project if using API key authentication
    let scopes: string[] = [];
    let project: { id: string } | undefined;
    if (apiKeyHeader) {
      // Extract key hash from the API key (format: gk_live_xxx or gk_test_xxx)
      const keyHash = createHash('sha256').update(apiKeyHeader).digest('hex');

      const apiKey = await this.prisma.apiKey.findUnique({
        where: { keyHash },
        include: { scopes: true, project: true },
      });

      // Validate API key exists and is not revoked
      if (!apiKey || apiKey.revokedAt) {
        res.status(401).json({
          jsonrpc: '2.0',
          id: message.id,
          error: {
            code: -32600,
            message: 'Invalid or revoked API key',
          },
        });
        return;
      }

      scopes = apiKey.scopes.map((s) => s.scope);
      project = { id: apiKey.project.id };
    }

    // Store session with auth context and credentials
    this.sessions.set(sessionId, {
      authContext: {
        authType: token
          ? 'jwt'
          : apiKeyHeader
            ? 'api-key'
            : authContext?.authType,
        token,
        apiKey: apiKeyHeader,
        scopes,
        project,
        ...(authContext || {}),
      },
    });

    // Initialize tools (don't fail if type extraction fails)
    try {
      if (this.toolRegistry.getAllTools().length === 0) {
        await this.toolRegistry.initialize();
      }
    } catch (error) {
      this.logger.warn(
        `Failed to initialize MCP tools: ${error.message}. Tools may have limited functionality.`,
      );
    }

    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: '2025-03-26',
        capabilities: {
          tools: {
            listChanged: true,
          },
        },
        serverInfo: {
          name: 'gatekit-mcp',
          version: '1.0.0',
        },
      },
    };

    // Include session ID in header
    res.setHeader('Mcp-Session-Id', sessionId);
    res.json(response);
  }

  /**
   * Handle JSON-RPC request
   */
  private async handleRequest(
    message: JsonRpcRequest,
    sessionId: string | undefined,
    req: Request,
  ): Promise<JsonRpcResponse> {
    const authContext = sessionId
      ? this.sessions.get(sessionId)?.authContext
      : (req as any).authContext;

    switch (message.method) {
      case 'tools/list':
        return this.handleToolsList(message, sessionId);

      case 'tools/call':
        return this.handleToolsCall(message, authContext);

      default:
        return {
          jsonrpc: '2.0',
          id: message.id,
          error: {
            code: -32601,
            message: `Method not found: ${message.method}`,
          },
        };
    }
  }

  /**
   * Handle tools/list request
   */
  private async handleToolsList(
    message: JsonRpcRequest,
    sessionId: string | undefined,
  ): Promise<JsonRpcResponse> {
    // Get scopes from session
    const session = sessionId ? this.sessions.get(sessionId) : null;
    const scopes = session?.authContext?.scopes || [];

    // Filter tools by scopes (JWT users get all tools)
    const tools =
      scopes.length > 0
        ? this.toolRegistry.getToolsByScopes(scopes)
        : this.toolRegistry.getAllTools();

    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        tools,
      },
    };
  }

  /**
   * Handle tools/call request
   */
  private async handleToolsCall(
    message: JsonRpcRequest,
    authContext: any,
  ): Promise<JsonRpcResponse> {
    const { name, arguments: args } = message.params || {};

    if (!name) {
      return {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32602,
          message: 'Missing tool name',
        },
      };
    }

    try {
      const result = await this.executor.executeTool(name, args, authContext);
      return {
        jsonrpc: '2.0',
        id: message.id,
        result,
      };
    } catch (error) {
      this.logger.error(`Tool execution error: ${error.message}`, error.stack);
      return {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        },
      };
    }
  }
}
