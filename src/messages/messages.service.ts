import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryMessagesDto } from './dto/query-messages.dto';
import { SecurityUtil, AuthContext } from '../common/utils/security.util';

/**
 * Identity information returned from identity resolution
 */
export interface IdentityInfo {
  id: string;
  displayName: string | null;
  email: string | null;
}

/**
 * User information with optional identity
 */
export interface UserWithIdentity {
  id: string;
  name: string;
  identity: IdentityInfo | null;
}

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve identity for a message (platform user -> identity lookup)
   * @param projectId Project ID for security validation (defense-in-depth)
   * @param platformId Platform configuration ID
   * @param providerUserId Platform-specific user ID
   * @returns Identity information or null if not found
   *
   * Note: While the composite unique index (platformId, providerUserId) ensures
   * uniqueness, we validate projectId for defense-in-depth security.
   */
  private async resolveIdentityForMessage(
    projectId: string,
    platformId: string,
    providerUserId: string,
  ): Promise<IdentityInfo | null> {
    const alias = await this.prisma.identityAlias.findUnique({
      where: {
        platformId_providerUserId: {
          platformId,
          providerUserId,
        },
      },
      select: {
        projectId: true,
        identity: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
    });

    // Defense-in-depth: Validate project ownership
    if (!alias || alias.projectId !== projectId) {
      return null;
    }

    return alias.identity;
  }

  /**
   * Batch resolve identities for multiple platform users
   * @param projectId Project ID for security validation
   * @param users Array of platform users to resolve
   * @returns Map of "platformId:providerUserId" -> IdentityInfo
   *
   * Note: Uses a single database query with OR conditions for optimal performance.
   * Automatically deduplicates users before querying.
   */
  private async batchResolveIdentities(
    projectId: string,
    users: Array<{ platformId: string; providerUserId: string }>,
  ): Promise<Map<string, IdentityInfo>> {
    const identityMap = new Map<string, IdentityInfo>();

    if (users.length === 0) {
      return identityMap;
    }

    // Deduplicate users using Map (preserves insertion order, efficient lookup)
    // Use URL encoding to safely handle special characters (including ':') in IDs
    const uniqueUsersMap = new Map<
      string,
      { platformId: string; providerUserId: string }
    >();
    for (const user of users) {
      const key = `${encodeURIComponent(user.platformId)}:${encodeURIComponent(user.providerUserId)}`;
      uniqueUsersMap.set(key, user);
    }

    const uniqueUsers = Array.from(uniqueUsersMap.values());

    // Single database query with OR conditions for all users
    const aliases = await this.prisma.identityAlias.findMany({
      where: {
        AND: [
          { projectId }, // Defense-in-depth: filter by project
          {
            OR: uniqueUsers.map((u) => ({
              AND: [
                { platformId: u.platformId },
                { providerUserId: u.providerUserId },
              ],
            })),
          },
        ],
      },
      select: {
        platformId: true,
        providerUserId: true,
        identity: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
    });

    // Build map from results (use same encoding as key generation)
    for (const alias of aliases) {
      if (alias.identity) {
        const key = `${encodeURIComponent(alias.platformId)}:${encodeURIComponent(alias.providerUserId)}`;
        identityMap.set(key, alias.identity);
      }
    }

    this.logger.debug(
      `Resolved ${identityMap.size} identities for ${uniqueUsers.length} unique users in single query`,
    );

    return identityMap;
  }

  async getMessages(
    projectId: string,
    query: QueryMessagesDto,
    authContext: AuthContext,
  ) {
    // Get project and validate access in one step
    const project = await SecurityUtil.getProjectWithAccess(
      this.prisma,
      projectId,
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

    // Resolve identities for message senders
    if (messages.length > 0) {
      const identityMap = await this.batchResolveIdentities(
        project.id,
        messages.map((m) => ({
          platformId: m.platformId,
          providerUserId: m.providerUserId,
        })),
      );

      // Attach identity to each message
      messages.forEach((message) => {
        const userKey = `${encodeURIComponent(message.platformId)}:${encodeURIComponent(message.providerUserId)}`;
        (message as any).identity = identityMap.get(userKey) || null;
      });
    }

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
          platformId: true,
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

      // Batch resolve identities for all unique reaction users
      const reactionIdentityMap = await this.batchResolveIdentities(
        project.id,
        reactions.map((r) => ({
          platformId: r.platformId,
          providerUserId: r.providerUserId,
        })),
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
          // Resolve identity for reaction user
          const userKey = `${encodeURIComponent(reaction.platformId)}:${encodeURIComponent(reaction.providerUserId)}`;
          const identity = reactionIdentityMap.get(userKey) || null;
          // Store user with identity info
          acc[reaction.providerMessageId][reaction.emoji].push({
            id: reaction.providerUserId,
            name: reaction.userDisplay || reaction.providerUserId,
            identity,
          });
          return acc;
        },
        {} as Record<string, Record<string, UserWithIdentity[]>>,
      );

      // Attach reactions to messages in clean format: { "👍": [{ id: "123", name: "John", identity: {...} }], "❤️": [...] }
      messages.forEach((message) => {
        (message as any).reactions =
          reactionsByMessage[message.providerMessageId] || {};
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

  async getMessage(projectId: string, messageId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
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
        platformId: true,
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

    // Batch resolve identities for all unique reaction users
    const reactionIdentityMap = await this.batchResolveIdentities(
      project.id,
      reactions.map((r) => ({
        platformId: r.platformId,
        providerUserId: r.providerUserId,
      })),
    );

    // Group reactions by emoji
    const groupedReactions = reactions.reduce(
      (acc, reaction) => {
        if (!acc[reaction.emoji]) {
          acc[reaction.emoji] = [];
        }
        // Resolve identity for reaction user
        const userKey = `${encodeURIComponent(reaction.platformId)}:${encodeURIComponent(reaction.providerUserId)}`;
        const identity = reactionIdentityMap.get(userKey) || null;
        acc[reaction.emoji].push({
          id: reaction.providerUserId,
          name: reaction.userDisplay || reaction.providerUserId,
          identity,
        });
        return acc;
      },
      {} as Record<string, UserWithIdentity[]>,
    );

    // Resolve identity for message sender
    const identity = await this.resolveIdentityForMessage(
      project.id,
      message.platformId,
      message.providerUserId,
    );

    return {
      ...message,
      identity,
      reactions: groupedReactions,
    };
  }

  async getMessageStats(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
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

  async deleteOldMessages(projectId: string, daysBefore: number) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
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

  async getSentMessages(
    projectId: string,
    query: any,
    authContext: AuthContext,
  ) {
    // SECURITY: Get project and validate access
    const project = await SecurityUtil.getProjectWithAccess(
      this.prisma,
      projectId,
      authContext,
      'sent message retrieval',
    );

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
          platformId: true,
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

    // Resolve identities for target users
    if (messages.length > 0) {
      const targetUsers = messages
        .filter((m) => m.targetType === 'user' && m.targetUserId)
        .map((m) => ({
          platformId: m.platformId,
          providerUserId: m.targetUserId!,
        }));

      const identityMap = await this.batchResolveIdentities(
        project.id,
        targetUsers,
      );

      // Attach identity to each message
      messages.forEach((message) => {
        if (message.targetType === 'user' && message.targetUserId) {
          const userKey = `${encodeURIComponent(message.platformId)}:${encodeURIComponent(message.targetUserId)}`;
          (message as any).targetIdentity = identityMap.get(userKey) || null;
        } else {
          (message as any).targetIdentity = null;
        }
      });
    }

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
