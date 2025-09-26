import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryMessagesDto } from './dto/query-messages.dto';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMessages(projectSlug: string, query: QueryMessagesDto) {
    // Get project
    const project = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Build where clause
    const where: any = {
      projectId: project.id,
    };

    if (query.platform) {
      where.platform = query.platform;
    }

    if (query.platformId) {
      where.platformId = query.platformId;
    }

    if (query.chatId) {
      where.providerChatId = query.chatId;
    }

    if (query.userId) {
      where.providerUserId = query.userId;
    }

    if (query.startDate || query.endDate) {
      where.receivedAt = {};
      if (query.startDate) {
        where.receivedAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.receivedAt.lte = new Date(query.endDate);
      }
    }

    // Get messages
    const [messages, total] = await Promise.all([
      this.prisma.receivedMessage.findMany({
        where,
        orderBy: { receivedAt: query.order },
        take: query.limit,
        skip: query.offset,
        select: {
          id: true,
          platform: true,
          providerMessageId: true,
          providerChatId: true,
          providerUserId: true,
          userDisplay: true,
          messageText: true,
          messageType: true,
          receivedAt: true,
          rawData: true,
        },
      }),
      this.prisma.receivedMessage.count({ where }),
    ]);

    return {
      messages,
      pagination: {
        total,
        limit: query.limit!,
        offset: query.offset!,
        hasMore: query.offset! + query.limit! < total,
      },
    };
  }

  async getMessage(projectSlug: string, messageId: string) {
    const project = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const message = await this.prisma.receivedMessage.findFirst({
      where: {
        id: messageId,
        projectId: project.id,
      },
      include: {
        platformConfig: {
          select: {
            id: true,
            platform: true,
            isActive: true,
            testMode: true,
          },
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    return message;
  }

  async getMessageStats(projectSlug: string) {
    const project = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const [totalMessages, platformStats, recentMessages] = await Promise.all([
      // Total message count
      this.prisma.receivedMessage.count({
        where: { projectId: project.id },
      }),
      // Messages per platform
      this.prisma.receivedMessage.groupBy({
        by: ['platform'],
        where: { projectId: project.id },
        _count: true,
      }),
      // Recent messages (last 24 hours)
      this.prisma.receivedMessage.count({
        where: {
          projectId: project.id,
          receivedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // Get unique users and chats
    const [uniqueUsers, uniqueChats] = await Promise.all([
      this.prisma.receivedMessage.findMany({
        where: { projectId: project.id },
        select: { providerUserId: true },
        distinct: ['providerUserId'],
      }),
      this.prisma.receivedMessage.findMany({
        where: { projectId: project.id },
        select: { providerChatId: true },
        distinct: ['providerChatId'],
      }),
    ]);

    // Get sent message stats
    const [totalSentMessages, sentPlatformStats] = await Promise.all([
      this.prisma.sentMessage.count({
        where: { projectId: project.id },
      }),
      this.prisma.sentMessage.groupBy({
        by: ['platform', 'status'],
        where: { projectId: project.id },
        _count: true,
      }),
    ]);

    return {
      received: {
        totalMessages,
        recentMessages,
        uniqueUsers: uniqueUsers.length,
        uniqueChats: uniqueChats.length,
        byPlatform: platformStats.map((stat) => ({
          platform: stat.platform,
          count: stat._count,
        })),
      },
      sent: {
        totalMessages: totalSentMessages,
        byPlatformAndStatus: sentPlatformStats.map((stat) => ({
          platform: stat.platform,
          status: stat.status,
          count: stat._count,
        })),
      },
    };
  }

  async deleteOldMessages(projectSlug: string, daysBefore: number) {
    const project = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBefore);

    const deleted = await this.prisma.receivedMessage.deleteMany({
      where: {
        projectId: project.id,
        receivedAt: {
          lt: cutoffDate,
        },
      },
    });

    return {
      message: `Deleted ${deleted.count} messages older than ${daysBefore} days`,
      deletedCount: deleted.count,
    };
  }

  async getSentMessages(projectSlug: string, query: any) {
    const project = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const where: any = {
      projectId: project.id,
    };

    if (query.platform) {
      where.platform = query.platform;
    }

    if (query.status) {
      where.status = query.status;
    }

    const limit = parseInt(query.limit) || 50;
    const offset = parseInt(query.offset) || 0;

    const [messages, total] = await Promise.all([
      this.prisma.sentMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          platform: true,
          jobId: true,
          providerMessageId: true,
          targetChatId: true,
          targetUserId: true,
          targetType: true,
          messageText: true,
          messageContent: true,
          status: true,
          errorMessage: true,
          sentAt: true,
          createdAt: true,
        },
      }),
      this.prisma.sentMessage.count({ where }),
    ]);

    return {
      messages,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }
}