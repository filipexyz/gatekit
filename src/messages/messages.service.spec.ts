import { Test, TestingModule } from '@nestjs/testing';
import { MessagesService } from './messages.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('MessagesService', () => {
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
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    sentMessage: {
      findMany: jest.fn(),
      count: jest.fn(),
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

  describe('getMessages', () => {
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

    beforeEach(() => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
    });

    it('should return all messages when no filters applied', async () => {
      mockPrismaService.receivedMessage.findMany.mockResolvedValue(
        mockMessages,
      );
      mockPrismaService.receivedMessage.count.mockResolvedValue(2);

      const result = await service.getMessages(
        'test-project',
        { limit: 50, offset: 0, order: 'desc' },
        mockAuthContext,
      );

      expect(result.messages).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(mockPrismaService.receivedMessage.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-id' },
        orderBy: { receivedAt: 'desc' },
        take: 50,
        skip: 0,
        select: {
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
          rawData: false, // Should not include raw data by default
        },
      });
    });

    it('should filter messages by platformId', async () => {
      const filteredMessages = [mockMessages[0]]; // Only Discord message
      mockPrismaService.receivedMessage.findMany.mockResolvedValue(
        filteredMessages,
      );
      mockPrismaService.receivedMessage.count.mockResolvedValue(1);

      const result = await service.getMessages(
        'test-project',
        { platformId: 'platform-1', limit: 50, offset: 0, order: 'desc' },
        mockAuthContext,
      );

      expect(result.messages).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.messages[0].platform).toBe('discord');
      expect(mockPrismaService.receivedMessage.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'project-id',
          platformId: 'platform-1',
        },
        orderBy: { receivedAt: 'desc' },
        take: 50,
        skip: 0,
        select: {
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
          rawData: false,
        },
      });
    });

    it('should filter messages by platform type', async () => {
      const filteredMessages = [mockMessages[1]]; // Only Telegram message
      mockPrismaService.receivedMessage.findMany.mockResolvedValue(
        filteredMessages,
      );
      mockPrismaService.receivedMessage.count.mockResolvedValue(1);

      const result = await service.getMessages(
        'test-project',
        { platform: 'telegram', limit: 50, offset: 0, order: 'desc' },
        mockAuthContext,
      );

      expect(result.messages).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.messages[0].platform).toBe('telegram');
      expect(mockPrismaService.receivedMessage.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'project-id',
          platform: 'telegram',
        },
        orderBy: { receivedAt: 'desc' },
        take: 50,
        skip: 0,
        select: {
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
          rawData: false,
        },
      });
    });

    it('should include raw data when raw=true', async () => {
      mockPrismaService.receivedMessage.findMany.mockResolvedValue(
        mockMessages,
      );
      mockPrismaService.receivedMessage.count.mockResolvedValue(2);

      const result = await service.getMessages(
        'test-project',
        { raw: true, limit: 50, offset: 0, order: 'desc' },
        mockAuthContext,
      );

      expect(result.messages).toHaveLength(2);
      expect(mockPrismaService.receivedMessage.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-id' },
        orderBy: { receivedAt: 'desc' },
        take: 50,
        skip: 0,
        select: expect.objectContaining({
          rawData: true, // Should include raw data when requested
        }),
      });
    });

    it('should filter by chatId', async () => {
      const filteredMessages = [mockMessages[0]];
      mockPrismaService.receivedMessage.findMany.mockResolvedValue(
        filteredMessages,
      );
      mockPrismaService.receivedMessage.count.mockResolvedValue(1);

      await service.getMessages(
        'test-project',
        { chatId: 'channel-123', limit: 50, offset: 0, order: 'desc' },
        mockAuthContext,
      );

      expect(mockPrismaService.receivedMessage.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'project-id',
          providerChatId: 'channel-123',
        },
        orderBy: { receivedAt: 'desc' },
        take: 50,
        skip: 0,
        select: {
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
          rawData: false,
        },
      });
    });

    it('should filter by userId', async () => {
      const filteredMessages = [mockMessages[0]];
      mockPrismaService.receivedMessage.findMany.mockResolvedValue(
        filteredMessages,
      );
      mockPrismaService.receivedMessage.count.mockResolvedValue(1);

      await service.getMessages(
        'test-project',
        { userId: 'user-456', limit: 50, offset: 0, order: 'desc' },
        mockAuthContext,
      );

      expect(mockPrismaService.receivedMessage.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'project-id',
          providerUserId: 'user-456',
        },
        orderBy: { receivedAt: 'desc' },
        take: 50,
        skip: 0,
        select: {
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
          rawData: false,
        },
      });
    });

    it('should filter by date range', async () => {
      mockPrismaService.receivedMessage.findMany.mockResolvedValue(
        mockMessages,
      );
      mockPrismaService.receivedMessage.count.mockResolvedValue(2);

      await service.getMessages(
        'test-project',
        {
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-01-01T23:59:59Z',
          limit: 50,
          offset: 0,
          order: 'desc',
        },
        mockAuthContext,
      );

      expect(mockPrismaService.receivedMessage.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'project-id',
          receivedAt: {
            gte: new Date('2024-01-01T00:00:00Z'),
            lte: new Date('2024-01-01T23:59:59Z'),
          },
        },
        orderBy: { receivedAt: 'desc' },
        take: 50,
        skip: 0,
        select: {
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
          rawData: false,
        },
      });
    });

    it('should combine multiple filters', async () => {
      const filteredMessages = [mockMessages[0]];
      mockPrismaService.receivedMessage.findMany.mockResolvedValue(
        filteredMessages,
      );
      mockPrismaService.receivedMessage.count.mockResolvedValue(1);

      await service.getMessages(
        'test-project',
        {
          platformId: 'platform-1',
          chatId: 'channel-123',
          raw: true,
          limit: 20,
          offset: 10,
          order: 'desc',
        },
        mockAuthContext,
      );

      expect(mockPrismaService.receivedMessage.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'project-id',
          platformId: 'platform-1',
          providerChatId: 'channel-123',
        },
        orderBy: { receivedAt: 'desc' },
        take: 20,
        skip: 10,
        select: expect.objectContaining({
          rawData: true,
        }),
      });
    });

    it('should use ascending order when specified', async () => {
      mockPrismaService.receivedMessage.findMany.mockResolvedValue(
        mockMessages,
      );
      mockPrismaService.receivedMessage.count.mockResolvedValue(2);

      await service.getMessages(
        'test-project',
        { order: 'asc', limit: 50, offset: 0 },
        mockAuthContext,
      );

      expect(mockPrismaService.receivedMessage.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-id' },
        orderBy: { receivedAt: 'asc' },
        take: 50,
        skip: 0,
        select: {
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
          rawData: false,
        },
      });
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(
        service.getMessages(
          'non-existent',
          { limit: 50, offset: 0, order: 'desc' },
          mockAuthContext,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMessage', () => {
    it('should return single message by ID', async () => {
      const mockProject = { id: 'project-id' };
      const mockMessage = {
        id: 'msg-1',
        projectId: 'project-id',
        platformId: 'platform-1',
        platform: 'discord',
        messageText: 'Hello',
        rawData: { discord: 'data' },
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.receivedMessage.findUnique.mockResolvedValue(
        mockMessage,
      );

      const result = await service.getMessage('test-project', 'msg-1');

      expect(result).toEqual(mockMessage);
      expect(mockPrismaService.receivedMessage.findUnique).toHaveBeenCalledWith(
        {
          where: {
            id: 'msg-1',
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
        },
      );
    });

    it('should throw NotFoundException when message not found', async () => {
      const mockProject = { id: 'project-id' };
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.receivedMessage.findUnique.mockResolvedValue(null);

      await expect(
        service.getMessage('test-project', 'non-existent-msg'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
