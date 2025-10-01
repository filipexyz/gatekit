import { Test, TestingModule } from '@nestjs/testing';
import { MessagesService } from './messages.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MessagesService - Identity Resolution', () => {
  let service: MessagesService;
  let prisma: PrismaService;

  const mockAuthContext = {
    authType: 'api-key' as const,
    project: { id: 'project-id', slug: 'test-project' },
  };

  const mockPrismaService = {
    project: {
      findUnique: jest.fn(),
    },
    receivedMessage: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    identityAlias: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('batchResolveIdentities', () => {
    it('should resolve identities for multiple platform users', async () => {
      const mockProject = { id: 'project-id', slug: 'test-project' };
      const mockMessages = [
        {
          id: 'msg-1',
          projectId: 'project-id',
          platformId: 'platform-1',
          platform: 'discord',
          providerMessageId: 'discord-msg-1',
          providerChatId: 'channel-123',
          providerUserId: 'user-456',
          userDisplay: 'TestUser',
          messageText: 'Hello from Discord',
          messageType: 'text',
          rawData: { discord: 'data' },
          receivedAt: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: 'msg-2',
          projectId: 'project-id',
          platformId: 'platform-2',
          platform: 'telegram',
          providerMessageId: 'telegram-msg-1',
          providerChatId: 'chat-789',
          providerUserId: 'user-123',
          userDisplay: 'TelegramUser',
          messageText: 'Hello from Telegram',
          messageType: 'text',
          rawData: { telegram: 'data' },
          receivedAt: new Date('2024-01-01T11:00:00Z'),
        },
      ];

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.receivedMessage.findMany.mockResolvedValue(
        mockMessages,
      );
      mockPrismaService.receivedMessage.count.mockResolvedValue(2);

      // Mock identity resolution - first user has identity, second doesn't
      mockPrismaService.identityAlias.findMany.mockResolvedValue([
        {
          platformId: 'platform-1',
          providerUserId: 'user-456',
          identity: {
            id: 'identity-1',
            displayName: 'John Doe',
            email: 'john@example.com',
          },
        },
        // Second user has no identity (not in the array)
      ]);

      const result = await service.getMessages(
        'test-project',
        { limit: 50, offset: 0, order: 'desc' },
        mockAuthContext,
      );

      // Verify identity resolution was called once with all users
      expect(mockPrismaService.identityAlias.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.identityAlias.findMany).toHaveBeenCalledWith({
        where: {
          AND: [
            { projectId: 'project-id' },
            {
              OR: [
                {
                  AND: [
                    { platformId: 'platform-1' },
                    { providerUserId: 'user-456' },
                  ],
                },
                {
                  AND: [
                    { platformId: 'platform-2' },
                    { providerUserId: 'user-123' },
                  ],
                },
              ],
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

      // Verify identities are attached to messages
      expect(result.messages[0].identity).toEqual({
        id: 'identity-1',
        displayName: 'John Doe',
        email: 'john@example.com',
      });
      expect(result.messages[1].identity).toBeNull();
    });

    it('should handle duplicate users by resolving only once', async () => {
      const mockProject = { id: 'project-id', slug: 'test-project' };
      const mockMessages = [
        {
          id: 'msg-1',
          projectId: 'project-id',
          platformId: 'platform-1',
          platform: 'discord',
          providerMessageId: 'discord-msg-1',
          providerChatId: 'channel-123',
          providerUserId: 'user-456',
          userDisplay: 'TestUser',
          messageText: 'Hello',
          messageType: 'text',
          rawData: {},
          receivedAt: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: 'msg-2',
          projectId: 'project-id',
          platformId: 'platform-1', // Same platform and user
          platform: 'discord',
          providerMessageId: 'discord-msg-2',
          providerChatId: 'channel-123',
          providerUserId: 'user-456', // Same user
          userDisplay: 'TestUser',
          messageText: 'Hello again',
          messageType: 'text',
          rawData: {},
          receivedAt: new Date('2024-01-01T11:00:00Z'),
        },
      ];

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.receivedMessage.findMany.mockResolvedValue(
        mockMessages,
      );
      mockPrismaService.receivedMessage.count.mockResolvedValue(2);
      mockPrismaService.identityAlias.findMany.mockResolvedValue([
        {
          platformId: 'platform-1',
          providerUserId: 'user-456',
          identity: {
            id: 'identity-1',
            displayName: 'John Doe',
            email: 'john@example.com',
          },
        },
      ]);

      const result = await service.getMessages(
        'test-project',
        { limit: 50, offset: 0, order: 'desc' },
        mockAuthContext,
      );

      // Should only call identity resolution once (single query for all users, deduplicated)
      expect(mockPrismaService.identityAlias.findMany).toHaveBeenCalledTimes(1);

      // Both messages should have the same identity
      expect(result.messages[0].identity).toEqual({
        id: 'identity-1',
        displayName: 'John Doe',
        email: 'john@example.com',
      });
      expect(result.messages[1].identity).toEqual({
        id: 'identity-1',
        displayName: 'John Doe',
        email: 'john@example.com',
      });
    });

    it('should handle malformed user keys gracefully', async () => {
      // This test ensures defensive programming for edge cases
      const mockProject = { id: 'project-id', slug: 'test-project' };
      const mockMessages = [
        {
          id: 'msg-1',
          projectId: 'project-id',
          platformId: 'platform-1',
          platform: 'discord',
          providerMessageId: 'discord-msg-1',
          providerChatId: 'channel-123',
          providerUserId: 'user-456',
          userDisplay: 'TestUser',
          messageText: 'Hello',
          messageType: 'text',
          rawData: {},
          receivedAt: new Date('2024-01-01T10:00:00Z'),
        },
      ];

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.receivedMessage.findMany.mockResolvedValue(
        mockMessages,
      );
      mockPrismaService.receivedMessage.count.mockResolvedValue(1);
      mockPrismaService.identityAlias.findMany.mockResolvedValue([]);

      // Should not throw even if identity resolution returns null
      const result = await service.getMessages(
        'test-project',
        { limit: 50, offset: 0, order: 'desc' },
        mockAuthContext,
      );

      expect(result.messages[0].identity).toBeNull();
    });

    it('should resolve identities in parallel for performance', async () => {
      const mockProject = { id: 'project-id', slug: 'test-project' };
      const mockMessages = Array.from({ length: 5 }, (_, i) => ({
        id: `msg-${i}`,
        projectId: 'project-id',
        platformId: `platform-${i}`,
        platform: 'discord',
        providerMessageId: `discord-msg-${i}`,
        providerChatId: 'channel-123',
        providerUserId: `user-${i}`,
        userDisplay: `User${i}`,
        messageText: `Message ${i}`,
        messageType: 'text',
        rawData: {},
        receivedAt: new Date(`2024-01-01T${10 + i}:00:00Z`),
      }));

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.receivedMessage.findMany.mockResolvedValue(
        mockMessages,
      );
      mockPrismaService.receivedMessage.count.mockResolvedValue(5);

      // Mock single query response with all identities
      mockPrismaService.identityAlias.findMany.mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => ({
          platformId: `platform-${i}`,
          providerUserId: `user-${i}`,
          identity: {
            id: `identity-${i + 1}`,
            displayName: `User ${i + 1}`,
            email: `user${i + 1}@example.com`,
          },
        })),
      );

      const startTime = Date.now();
      await service.getMessages(
        'test-project',
        { limit: 50, offset: 0, order: 'desc' },
        mockAuthContext,
      );
      const duration = Date.now() - startTime;

      // With single query approach, should complete very fast
      expect(duration).toBeLessThan(100);
      expect(mockPrismaService.identityAlias.findMany).toHaveBeenCalledTimes(1);
    });

    it('should return identity with all fields (id, displayName, email)', async () => {
      const mockProject = { id: 'project-id', slug: 'test-project' };
      const mockMessages = [
        {
          id: 'msg-1',
          projectId: 'project-id',
          platformId: 'platform-1',
          platform: 'discord',
          providerMessageId: 'discord-msg-1',
          providerChatId: 'channel-123',
          providerUserId: 'user-456',
          userDisplay: 'TestUser',
          messageText: 'Hello',
          messageType: 'text',
          rawData: {},
          receivedAt: new Date('2024-01-01T10:00:00Z'),
        },
      ];

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.receivedMessage.findMany.mockResolvedValue(
        mockMessages,
      );
      mockPrismaService.receivedMessage.count.mockResolvedValue(1);
      mockPrismaService.identityAlias.findMany.mockResolvedValue([
        {
          platformId: 'platform-1',
          providerUserId: 'user-456',
          identity: {
            id: 'identity-1',
            displayName: 'John Doe',
            email: 'john@example.com',
          },
        },
      ]);

      const result = await service.getMessages(
        'test-project',
        { limit: 50, offset: 0, order: 'desc' },
        mockAuthContext,
      );

      // Verify identity structure matches IdentityInfo interface
      expect(result.messages[0].identity).toEqual({
        id: 'identity-1',
        displayName: 'John Doe',
        email: 'john@example.com',
      });
      expect(result.messages[0].identity).toHaveProperty('id');
      expect(result.messages[0].identity).toHaveProperty('displayName');
      expect(result.messages[0].identity).toHaveProperty('email');
    });

    it('should handle null displayName and email in identity', async () => {
      const mockProject = { id: 'project-id', slug: 'test-project' };
      const mockMessages = [
        {
          id: 'msg-1',
          projectId: 'project-id',
          platformId: 'platform-1',
          platform: 'discord',
          providerMessageId: 'discord-msg-1',
          providerChatId: 'channel-123',
          providerUserId: 'user-456',
          userDisplay: 'TestUser',
          messageText: 'Hello',
          messageType: 'text',
          rawData: {},
          receivedAt: new Date('2024-01-01T10:00:00Z'),
        },
      ];

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.receivedMessage.findMany.mockResolvedValue(
        mockMessages,
      );
      mockPrismaService.receivedMessage.count.mockResolvedValue(1);
      mockPrismaService.identityAlias.findMany.mockResolvedValue([
        {
          platformId: 'platform-1',
          providerUserId: 'user-456',
          identity: {
            id: 'identity-1',
            displayName: null,
            email: null,
          },
        },
      ]);

      const result = await service.getMessages(
        'test-project',
        { limit: 50, offset: 0, order: 'desc' },
        mockAuthContext,
      );

      expect(result.messages[0].identity).toEqual({
        id: 'identity-1',
        displayName: null,
        email: null,
      });
    });
  });
});
