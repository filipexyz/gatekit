import { Test, TestingModule } from '@nestjs/testing';
import { MessagesService } from './messages.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MessageQueue } from '../../queues/message.queue';
import { PlatformsService } from '../platforms.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('MessagesService', () => {
  let service: MessagesService;
  let prisma: PrismaService;
  let messageQueue: MessageQueue;

  const mockPrismaService = {
    project: {
      findUnique: jest.fn(),
    },
    projectPlatform: {
      findUnique: jest.fn(),
    },
  };

  const mockMessageQueue = {
    addMessage: jest.fn(),
    getJobStatus: jest.fn(),
    getQueueMetrics: jest.fn(),
    retryFailedJob: jest.fn(),
  };

  const mockPlatformsService = {
    getDecryptedCredentials: jest.fn(),
    validatePlatformConfigById: jest.fn(),
  };


  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        {
          provide: PlatformsService,
          useValue: mockPlatformsService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: MessageQueue,
          useValue: mockMessageQueue,
        },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    prisma = module.get<PrismaService>(PrismaService);
    messageQueue = module.get<MessageQueue>(MessageQueue);

    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('should queue message for Discord platform', async () => {
      const projectSlug = 'test-project';
      const sendMessageDto = {
        targets: [{ type: 'channel' as any, id: 'channel-123', platformId: 'platform-uuid-123' }],
        content: { text: 'Hello Discord!' },
      };

      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-id',
        slug: projectSlug,
      });

      mockPrismaService.projectPlatform.findUnique.mockResolvedValue({
        id: 'platform-config-id',
        projectId: 'project-id',
        platform: 'discord',
        isActive: true,
      });

      mockMessageQueue.addMessage.mockResolvedValue({
        jobId: 'job-123',
        status: 'waiting',
      });

      const result = await service.sendMessage(projectSlug, sendMessageDto);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('jobId', 'job-123');
      expect(result).toHaveProperty('targets');
      expect(result).toHaveProperty('platformIds');
      expect(result.platformIds).toContain('platform-uuid-123');
      expect(mockMessageQueue.addMessage).toHaveBeenCalledWith({
        projectSlug,
        projectId: 'project-id',
        message: sendMessageDto,
      });
    });

    it('should queue message for Telegram platform', async () => {
      const projectSlug = 'test-project';
      const sendMessageDto = {
        targets: [{ type: 'user' as any, id: 'user-123', platformId: 'platform-uuid-456' }],
        content: { text: 'Hello Telegram!' },
      };

      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-id',
        slug: projectSlug,
      });

      mockPrismaService.projectPlatform.findUnique.mockResolvedValue({
        id: 'platform-config-id',
        projectId: 'project-id',
        platform: 'telegram',
        isActive: true,
      });

      mockMessageQueue.addMessage.mockResolvedValue({
        jobId: 'job-456',
        status: 'waiting',
      });

      const result = await service.sendMessage(projectSlug, sendMessageDto);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('jobId', 'job-456');
      expect(result).toHaveProperty('platformIds');
      expect(result.platformIds).toContain('platform-uuid-456');
      expect(result).toHaveProperty('status', 'waiting');
      expect(mockMessageQueue.addMessage).toHaveBeenCalledWith({
        projectSlug,
        projectId: 'project-id',
        message: sendMessageDto,
      });
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(
        service.sendMessage('non-existent', {
          targets: [{ type: 'channel' as any, id: '123', platformId: 'platform-123' }],
          content: { text: 'test' },
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when platform is not configured', async () => {
      const projectSlug = 'test-project';
      const sendMessageDto = {
        targets: [{ type: 'channel' as any, id: 'channel-123', platformId: 'platform-123' }],
        content: { text: 'Test' },
      };

      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-id',
        slug: projectSlug,
      });

      mockPlatformsService.validatePlatformConfigById.mockRejectedValue(
        new NotFoundException('Platform configuration with ID \'platform-123\' not found')
      );

      await expect(
        service.sendMessage(projectSlug, sendMessageDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when platform is disabled', async () => {
      const projectSlug = 'test-project';
      const sendMessageDto = {
        targets: [{ type: 'channel' as any, id: 'channel-123', platformId: 'disabled-platform-123' }],
        content: { text: 'Test' },
      };

      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-id',
        slug: projectSlug,
      });

      mockPlatformsService.validatePlatformConfigById.mockRejectedValue(
        new BadRequestException('Platform configuration \'disabled-platform-123\' is currently disabled')
      );

      await expect(
        service.sendMessage(projectSlug, sendMessageDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getMessageStatus', () => {
    it('should return message status', async () => {
      const jobId = 'job-123';
      const mockStatus = {
        jobId,
        status: 'completed',
        progress: 100,
        result: { success: true },
      };

      mockMessageQueue.getJobStatus.mockResolvedValue(mockStatus);

      const result = await service.getMessageStatus(jobId);

      expect(result).toEqual(mockStatus);
      expect(mockMessageQueue.getJobStatus).toHaveBeenCalledWith(jobId);
    });

    it('should throw NotFoundException when job does not exist', async () => {
      mockMessageQueue.getJobStatus.mockResolvedValue(null);

      await expect(service.getMessageStatus('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getQueueMetrics', () => {
    it('should return queue metrics', async () => {
      const mockMetrics = {
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
      };

      mockMessageQueue.getQueueMetrics.mockResolvedValue(mockMetrics);

      const result = await service.getQueueMetrics();

      expect(result).toEqual(mockMetrics);
      expect(mockMessageQueue.getQueueMetrics).toHaveBeenCalled();
    });
  });

  describe('retryMessage', () => {
    it('should retry failed message', async () => {
      const jobId = 'job-123';
      const mockResult = {
        jobId,
        status: 'waiting',
        retryAttempt: 1,
      };

      mockMessageQueue.retryFailedJob.mockResolvedValue(mockResult);

      const result = await service.retryMessage(jobId);

      expect(result).toEqual(mockResult);
      expect(mockMessageQueue.retryFailedJob).toHaveBeenCalledWith(jobId);
    });
  });
});