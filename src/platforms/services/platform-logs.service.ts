import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface LogPlatformActivityOptions {
  projectId: string;
  platformId?: string;
  platform: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: 'connection' | 'webhook' | 'message' | 'error' | 'auth' | 'general';
  message: string;
  metadata?: Record<string, any>;
  error?: Error | string;
}

export interface QueryPlatformLogsOptions {
  projectId?: string;
  platformId?: string;
  platform?: string;
  level?: string;
  category?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class PlatformLogsService {
  constructor(private prisma: PrismaService) {}

  async logActivity(options: LogPlatformActivityOptions): Promise<void> {
    try {
      await this.prisma.platformLog.create({
        data: {
          projectId: options.projectId,
          platformId: options.platformId || null,
          platform: options.platform,
          level: options.level,
          category: options.category,
          message: options.message,
          metadata: options.metadata,
          error: options.error
            ? options.error instanceof Error
              ? options.error.stack
              : options.error
            : null,
        },
      });
    } catch (error) {
      // Don't let logging errors break the main flow
      console.error('Failed to log platform activity:', error);
    }
  }

  async queryLogs(options: QueryPlatformLogsOptions) {
    const where: any = {};

    if (options.projectId) where.projectId = options.projectId;
    if (options.platformId) where.platformId = options.platformId;
    if (options.platform) where.platform = options.platform;
    if (options.level) where.level = options.level;
    if (options.category) where.category = options.category;

    if (options.startDate || options.endDate) {
      where.timestamp = {};
      if (options.startDate) where.timestamp.gte = options.startDate;
      if (options.endDate) where.timestamp.lte = options.endDate;
    }

    const logs = await this.prisma.platformLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: options.limit || 100,
      skip: options.offset || 0,
      include: {
        platformConfig: {
          select: {
            id: true,
            platform: true,
            isActive: true,
          },
        },
      },
    });

    const totalCount = await this.prisma.platformLog.count({ where });

    return {
      logs,
      pagination: {
        total: totalCount,
        limit: options.limit || 100,
        offset: options.offset || 0,
        hasMore: (options.offset || 0) + logs.length < totalCount,
      },
    };
  }

  async getLogStats(projectId: string, platformId?: string) {
    const where: any = { projectId };
    if (platformId) where.platformId = platformId;

    const stats = await this.prisma.platformLog.groupBy({
      by: ['level', 'category'],
      where,
      _count: true,
      orderBy: {
        level: 'desc',
      },
    });

    const recentErrors = await this.prisma.platformLog.findMany({
      where: {
        ...where,
        level: 'error',
      },
      orderBy: { timestamp: 'desc' },
      take: 5,
      select: {
        message: true,
        category: true,
        timestamp: true,
        platform: true,
      },
    });

    return {
      summary: stats.map((stat) => ({
        level: stat.level,
        category: stat.category,
        count: stat._count,
      })),
      recentErrors,
    };
  }

  async cleanupOldLogs(retentionDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.prisma.platformLog.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }
}
