import { Test, TestingModule } from '@nestjs/testing';
import { MessagesService } from './messages.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MessageQueue } from '../../queues/message.queue';
import { PlatformsService } from '../platforms.service';
import { PlatformRegistry } from '../services/platform-registry.service';
import { WebhookDeliveryService } from '../../webhooks/services/webhook-delivery.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SecurityUtil } from '../../common/utils/security.util';

jest.mock('../../common/utils/security.util');

describe('MessagesService - Reactions', () => {
  let service: MessagesService;
  let prismaService: PrismaService;
  let platformsService: PlatformsService;
  let platformRegistry: PlatformRegistry;

  const mockPrisma = {
    project: {
      findUnique: jest.fn(),
    },
    receivedMessage: {
      findFirst: jest.fn(),
    },
    sentMessage: {
      findFirst: jest.fn(),
    },
  };

  const mockPlatformsService = {
    validatePlatformConfigById: jest.fn(),
  };

  const mockPlatformRegistry = {
    getProvider: jest.fn(),
  };

  const mockMessageQueue = {};

  const mockWebhookDeliveryService = {
    deliverEvent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PlatformsService, useValue: mockPlatformsService },
        { provide: MessageQueue, useValue: mockMessageQueue },
        { provide: PlatformRegistry, useValue: mockPlatformRegistry },
        {
          provide: WebhookDeliveryService,
          useValue: mockWebhookDeliveryService,
        },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    prismaService = module.get<PrismaService>(PrismaService);
    platformsService = module.get<PlatformsService>(PlatformsService);
    platformRegistry = module.get<PlatformRegistry>(PlatformRegistry);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('reactToMessage', () => {
    const projectId = 'test-project';
    const platformId = 'platform-123';
    const messageId = '42';
    const emoji = '👍';

    const mockProject = {
      id: 'project-id-123',
    };

    const mockAuthContext = {
      authType: 'api-key' as const,
      project: { id: 'project-id-123' },
    };

    const mockPlatformConfig = {
      id: platformId,
      platform: 'telegram',
      projectId: 'project-id-123',
    };

    const mockReceivedMessage = {
      id: 'msg-id-123',
      providerMessageId: messageId,
      platformId: platformId,
      providerChatId: '253191879',
    };

    const mockSentMessage = {
      id: 'sent-msg-id-123',
      providerMessageId: messageId,
      platformId: platformId,
      targetChatId: '253191879',
    };

    const mockProvider = {
      sendReaction: jest.fn().mockResolvedValue(undefined),
    };

    it('should react to a received message successfully', async () => {
      (SecurityUtil.getProjectWithAccess as jest.Mock).mockResolvedValue(
        mockProject,
      );
      mockPlatformsService.validatePlatformConfigById.mockResolvedValue(
        mockPlatformConfig,
      );
      mockPrisma.receivedMessage.findFirst.mockResolvedValue(
        mockReceivedMessage,
      );
      mockPlatformRegistry.getProvider.mockReturnValue(mockProvider);

      const result = await service.reactToMessage(
        projectId,
        {
          platformId,
          messageId,
          emoji,
        },
        mockAuthContext,
      );

      expect(result).toEqual({
        success: true,
        platformId,
        messageId,
        emoji,
        timestamp: expect.any(String),
      });

      expect(mockProvider.sendReaction).toHaveBeenCalledWith(
        `${mockProject.id}:${platformId}`,
        mockReceivedMessage.providerChatId,
        messageId,
        emoji,
        false, // fromMe
      );
    });

    it('should react to a sent message successfully when not found in received messages', async () => {
      (SecurityUtil.getProjectWithAccess as jest.Mock).mockResolvedValue(
        mockProject,
      );
      mockPlatformsService.validatePlatformConfigById.mockResolvedValue(
        mockPlatformConfig,
      );
      mockPrisma.receivedMessage.findFirst.mockResolvedValue(null);
      mockPrisma.sentMessage.findFirst.mockResolvedValue(mockSentMessage);
      mockPlatformRegistry.getProvider.mockReturnValue(mockProvider);

      const result = await service.reactToMessage(
        projectId,
        {
          platformId,
          messageId,
          emoji,
        },
        mockAuthContext,
      );

      expect(result.success).toBe(true);
      expect(mockProvider.sendReaction).toHaveBeenCalledWith(
        `${mockProject.id}:${platformId}`,
        mockSentMessage.targetChatId,
        messageId,
        emoji,
        true, // fromMe
      );
    });

    it('should throw NotFoundException when message not found', async () => {
      (SecurityUtil.getProjectWithAccess as jest.Mock).mockResolvedValue(
        mockProject,
      );
      mockPlatformsService.validatePlatformConfigById.mockResolvedValue(
        mockPlatformConfig,
      );
      mockPrisma.receivedMessage.findFirst.mockResolvedValue(null);
      mockPrisma.sentMessage.findFirst.mockResolvedValue(null);
      mockPlatformRegistry.getProvider.mockReturnValue(mockProvider);

      await expect(
        service.reactToMessage(
          projectId,
          {
            platformId,
            messageId,
            emoji,
          },
          mockAuthContext,
        ),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.reactToMessage(
          projectId,
          {
            platformId,
            messageId,
            emoji,
          },
          mockAuthContext,
        ),
      ).rejects.toThrow(
        `Message ${messageId} not found on platform ${platformId}`,
      );
    });

    it('should throw BadRequestException when platform does not support reactions', async () => {
      const providerWithoutReactions = {};

      (SecurityUtil.getProjectWithAccess as jest.Mock).mockResolvedValue(
        mockProject,
      );
      mockPlatformsService.validatePlatformConfigById.mockResolvedValue(
        mockPlatformConfig,
      );
      mockPrisma.receivedMessage.findFirst.mockResolvedValue(
        mockReceivedMessage,
      );
      mockPlatformRegistry.getProvider.mockReturnValue(
        providerWithoutReactions,
      );

      await expect(
        service.reactToMessage(
          projectId,
          {
            platformId,
            messageId,
            emoji,
          },
          mockAuthContext,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.reactToMessage(
          projectId,
          {
            platformId,
            messageId,
            emoji,
          },
          mockAuthContext,
        ),
      ).rejects.toThrow(
        `Platform ${mockPlatformConfig.platform} does not support sending reactions`,
      );
    });
  });

  describe('unreactToMessage', () => {
    const projectId = 'test-project';
    const platformId = 'platform-123';
    const messageId = '42';
    const emoji = '👍';

    const mockProject = {
      id: 'project-id-123',
    };

    const mockAuthContext = {
      authType: 'api-key' as const,
      project: { id: 'project-id-123' },
    };

    const mockPlatformConfig = {
      id: platformId,
      platform: 'discord',
      projectId: 'project-id-123',
    };

    const mockReceivedMessage = {
      id: 'msg-id-123',
      providerMessageId: messageId,
      platformId: platformId,
      providerChatId: '1422641807983902932',
    };

    const mockProvider = {
      unreactFromMessage: jest.fn().mockResolvedValue(undefined),
    };

    it('should remove reaction from message successfully', async () => {
      (SecurityUtil.getProjectWithAccess as jest.Mock).mockResolvedValue(
        mockProject,
      );
      mockPlatformsService.validatePlatformConfigById.mockResolvedValue(
        mockPlatformConfig,
      );
      mockPrisma.receivedMessage.findFirst.mockResolvedValue(
        mockReceivedMessage,
      );
      mockPlatformRegistry.getProvider.mockReturnValue(mockProvider);

      const result = await service.unreactToMessage(
        projectId,
        {
          platformId,
          messageId,
          emoji,
        },
        mockAuthContext,
      );

      expect(result).toEqual({
        success: true,
        platformId,
        messageId,
        emoji,
        timestamp: expect.any(String),
      });

      expect(mockProvider.unreactFromMessage).toHaveBeenCalledWith(
        `${mockProject.id}:${platformId}`,
        mockReceivedMessage.providerChatId,
        messageId,
        emoji,
        false, // fromMe
      );
    });

    it('should throw BadRequestException when platform does not support unreact', async () => {
      const providerWithoutUnreact = {};

      (SecurityUtil.getProjectWithAccess as jest.Mock).mockResolvedValue(
        mockProject,
      );
      mockPlatformsService.validatePlatformConfigById.mockResolvedValue(
        mockPlatformConfig,
      );
      mockPrisma.receivedMessage.findFirst.mockResolvedValue(
        mockReceivedMessage,
      );
      mockPlatformRegistry.getProvider.mockReturnValue(providerWithoutUnreact);

      await expect(
        service.unreactToMessage(
          projectId,
          {
            platformId,
            messageId,
            emoji,
          },
          mockAuthContext,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
