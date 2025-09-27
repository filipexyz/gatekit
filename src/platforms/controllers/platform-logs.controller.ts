import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { PlatformLogsService } from '../services/platform-logs.service';
import { AppAuthGuard } from '../../common/guards/app-auth.guard';
import { RequireScopes } from '../../common/decorators/scopes.decorator';
import { SdkContract } from '../../common/decorators/sdk-contract.decorator';
import { PrismaService } from '../../prisma/prisma.service';

export class QueryPlatformLogsDto {
  platform?: string;
  level?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

@Controller('api/v1/projects/:slug/platforms')
@UseGuards(AppAuthGuard)
export class PlatformLogsController {
  constructor(
    private readonly platformLogsService: PlatformLogsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('logs')
  @RequireScopes('platforms:read')
  @SdkContract({
    command: 'platforms logs list',
    description: 'List platform processing logs for a project',
    category: 'Platform Logs',
    requiredScopes: ['platforms:read'],
    outputType: 'PlatformLogsResponse',
    options: {
      platform: { description: 'Filter by platform (telegram, discord)', type: 'string' },
      level: {
        description: 'Filter by log level',
        choices: ['info', 'warn', 'error', 'debug'],
        type: 'string'
      },
      category: {
        description: 'Filter by log category',
        choices: ['connection', 'webhook', 'message', 'error', 'auth', 'general'],
        type: 'string'
      },
      startDate: { description: 'Filter logs after this date (ISO 8601)', type: 'string' },
      endDate: { description: 'Filter logs before this date (ISO 8601)', type: 'string' },
      limit: { description: 'Number of logs to return (1-1000)', type: 'number', default: '100' },
      offset: { description: 'Number of logs to skip', type: 'number' }
    },
    examples: [
      {
        description: 'List recent platform logs',
        command: 'gatekit platforms logs list my-project'
      },
      {
        description: 'List only error logs',
        command: 'gatekit platforms logs list my-project --level error'
      },
      {
        description: 'List webhook logs for Telegram',
        command: 'gatekit platforms logs list my-project --platform telegram --category webhook'
      }
    ]
  })
  async listLogs(@Param('slug') slug: string, @Query() query: QueryPlatformLogsDto) {
    // Get project to ensure access control
    const project = await this.prisma.project.findUnique({
      where: { slug },
    });

    if (!project) {
      throw new Error(`Project with slug '${slug}' not found`);
    }

    const options = {
      projectId: project.id,
      platform: query.platform,
      level: query.level,
      category: query.category,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      limit: query.limit ? Math.min(query.limit, 1000) : 100,
      offset: query.offset,
    };

    return this.platformLogsService.queryLogs(options);
  }

  @Get(':platformId/logs')
  @RequireScopes('platforms:read')
  @SdkContract({
    command: 'platforms logs get',
    description: 'List logs for a specific platform configuration',
    category: 'Platform Logs',
    requiredScopes: ['platforms:read'],
    outputType: 'PlatformLogsResponse',
    options: {
      level: {
        description: 'Filter by log level',
        choices: ['info', 'warn', 'error', 'debug'],
        type: 'string'
      },
      category: {
        description: 'Filter by log category',
        choices: ['connection', 'webhook', 'message', 'error', 'auth', 'general'],
        type: 'string'
      },
      startDate: { description: 'Filter logs after this date (ISO 8601)', type: 'string' },
      endDate: { description: 'Filter logs before this date (ISO 8601)', type: 'string' },
      limit: { description: 'Number of logs to return (1-1000)', type: 'number', default: '100' },
      offset: { description: 'Number of logs to skip', type: 'number' }
    },
    examples: [
      {
        description: 'List logs for specific platform',
        command: 'gatekit platforms logs get my-project platform-id-123'
      },
      {
        description: 'List recent errors for platform',
        command: 'gatekit platforms logs get my-project platform-id-123 --level error --limit 50'
      }
    ]
  })
  async getPlatformLogs(
    @Param('slug') slug: string,
    @Param('platformId') platformId: string,
    @Query() query: QueryPlatformLogsDto
  ) {
    // Get project to ensure access control
    const project = await this.prisma.project.findUnique({
      where: { slug },
    });

    if (!project) {
      throw new Error(`Project with slug '${slug}' not found`);
    }

    const options = {
      projectId: project.id,
      platformId,
      level: query.level,
      category: query.category,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      limit: query.limit ? Math.min(query.limit, 1000) : 100,
      offset: query.offset,
    };

    return this.platformLogsService.queryLogs(options);
  }

  @Get('logs/stats')
  @RequireScopes('platforms:read')
  @SdkContract({
    command: 'platforms logs stats',
    description: 'Get platform logs statistics and recent errors',
    category: 'Platform Logs',
    requiredScopes: ['platforms:read'],
    outputType: 'PlatformLogStatsResponse',
    examples: [
      {
        description: 'Get platform logs statistics',
        command: 'gatekit platforms logs stats my-project'
      }
    ]
  })
  async getLogStats(@Param('slug') slug: string) {
    // Get project to ensure access control
    const project = await this.prisma.project.findUnique({
      where: { slug },
    });

    if (!project) {
      throw new Error(`Project with slug '${slug}' not found`);
    }

    return this.platformLogsService.getLogStats(project.id);
  }
}