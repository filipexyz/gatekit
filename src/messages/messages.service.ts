import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryMessagesDto } from './dto/query-messages.dto';
import { SecurityUtil, AuthContext } from '../common/utils/security.util';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMessages(
    projectSlug: string,
    query: QueryMessagesDto,
    authContext: AuthContext,
  ) {
    // Get project and validate access in one step
    const project = await SecurityUtil.getProjectWithAccess(
      this.prisma,
      projectSlug,
      authContext,
      'message retrieval',
    );

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

    // Build select clause based on raw data requirement
    const select = {
      id: true,
      platform: true,
      platformId: true,
      providerMessageId: true,
      providerChatId: true,
      providerUserId: true,
      userDisplay: true,
      messageText: true,
      messageType: true,
      receivedAt: true,
      rawData: query.raw || false,
    };

    // Get messages
    const [messages, total] = await Promise.all([
      this.prisma.receivedMessage.findMany({
        where,
        orderBy: { receivedAt: query.order },
        take: query.limit,
        skip: query.offset,
        select,
      }),
      this.prisma.receivedMessage.count({ where }),
    ]);

    // If reactions requested, fetch them for all messages
    if (query.reactions && messages.length > 0) {
      const messageIds = messages.map((m) => m.providerMessageId);

      // Get all reactions (both added and removed) to determine current state
      const allReactions = await this.prisma.receivedReaction.findMany({
        where: {
          projectId: project.id,
          platformId: { in: messages.map((m) => m.platformId) },
          providerMessageId: { in: messageIds },
        },
        select: {
          providerMessageId: true,
          providerUserId: true,
          userDisplay: true,
          emoji: true,
          reactionType: true,
          receivedAt: true,
        },
        orderBy: { receivedAt: 'desc' },
      });

      // Filter to only show reactions where the latest event is 'added'
      const reactionKey = (r: any) =>
        `${r.providerMessageId}:${r.providerUserId}:${r.emoji}`;
      const latestReactions = new Map<string, (typeof allReactions)[0]>();

      allReactions.forEach((reaction) => {
        const key = reactionKey(reaction);
        if (!latestReactions.has(key)) {
          latestReactions.set(key, reaction);
        }
      });

      // Only include reactions where latest state is 'added'
      const reactions = Array.from(latestReactions.values()).filter(
        (r) => r.reactionType === 'added',
      );

      // Group reactions by message ID, then by emoji
      const reactionsByMessage = reactions.reduce(
        (acc, reaction) => {
          if (!acc[reaction.providerMessageId]) {
            acc[reaction.providerMessageId] = {};
          }
          if (!acc[reaction.providerMessageId][reaction.emoji]) {
            acc[reaction.providerMessageId][reaction.emoji] = [];
          }
          // Store user as object for future extensibility
          acc[reaction.providerMessageId][reaction.emoji].push({
            id: reaction.providerUserId,
            name: reaction.userDisplay || reaction.providerUserId,
          });
          return acc;
        },
        {} as Record<string, Record<string, { id: string; name: string }[]>>,
      );

      // Attach reactions to messages in clean format: { "👍": [{ id: "123", name: "John" }], "❤️": [...] }
      messages.forEach((message: any) => {
        message.reactions = reactionsByMessage[message.providerMessageId] || {};
      });
    }

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

    const message = await this.prisma.receivedMessage.findUnique({
      where: {
        id: messageId,
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

    if (!message || message.projectId !== project.id) {
      throw new NotFoundException('Message not found');
    }

    // Fetch all reactions (both added and removed) to determine current state
    const allReactions = await this.prisma.receivedReaction.findMany({
      where: {
        projectId: project.id,
        platformId: message.platformId,
        providerMessageId: message.providerMessageId,
      },
      select: {
        providerUserId: true,
        userDisplay: true,
        emoji: true,
        reactionType: true,
        receivedAt: true,
      },
      orderBy: { receivedAt: 'desc' },
    });

    // Filter to only show reactions where the latest event is 'added'
    const reactionKey = (r: any) => `${r.providerUserId}:${r.emoji}`;
    const latestReactions = new Map<string, (typeof allReactions)[0]>();

    allReactions.forEach((reaction) => {
      const key = reactionKey(reaction);
      if (!latestReactions.has(key)) {
        latestReactions.set(key, reaction);
      }
    });

    // Only include reactions where latest state is 'added'
    const reactions = Array.from(latestReactions.values()).filter(
      (r) => r.reactionType === 'added',
    );

    // Group reactions by emoji
    const groupedReactions = reactions.reduce(
      (acc, reaction) => {
        if (!acc[reaction.emoji]) {
          acc[reaction.emoji] = [];
        }
        acc[reaction.emoji].push({
          id: reaction.providerUserId,
          name: reaction.userDisplay || reaction.providerUserId,
        });
        return acc;
      },
      {} as Record<string, { id: string; name: string }[]>,
    );

    return {
      ...message,
      reactions: groupedReactions,
    };
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
