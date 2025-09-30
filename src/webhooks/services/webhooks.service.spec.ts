import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SecurityUtil } from '../../common/utils/security.util';
import { UrlValidationUtil } from '../../common/utils/url-validation.util';
import { CreateWebhookDto } from '../dto/create-webhook.dto';
import { UpdateWebhookDto } from '../dto/update-webhook.dto';
import { QueryDeliveriesDto } from '../dto/query-deliveries.dto';
import { WebhookEventType } from '../types/webhook-event.types';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let prisma: PrismaService;
  let webhookDeliveryService: WebhookDeliveryService;

  const mockAuthContext = {
    authType: 'api-key' as const,
    project: { id: 'project-123', slug: 'test-project' },
  };

  const mockProject = {
    id: 'project-123',
    slug: 'test-project',
    name: 'Test Project',
  };

  const mockWebhook = {
    id: 'webhook-123',
    projectId: 'project-123',
    name: 'Test Webhook',
    url: 'https://example.com/webhook',
    events: [WebhookEventType.MESSAGE_RECEIVED],
    secret: 'whsec_test123456789012345678901234567890',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        {
          provide: PrismaService,
          useValue: {
            webhook: {
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
            webhookDelivery: {
              findMany: jest.fn(),
              count: jest.fn(),
            },
          },
        },
        {
          provide: WebhookDeliveryService,
          useValue: {
            getDeliveryStats: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
    prisma = module.get<PrismaService>(PrismaService);
    webhookDeliveryService = module.get<WebhookDeliveryService>(
      WebhookDeliveryService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createWebhook', () => {
    const createDto: CreateWebhookDto = {
      name: 'Test Webhook',
      url: 'https://example.com/webhook',
      events: [WebhookEventType.MESSAGE_RECEIVED],
    };

    beforeEach(() => {
      jest
        .spyOn(SecurityUtil, 'getProjectWithAccess')
        .mockResolvedValue(mockProject as any);
      jest.spyOn(UrlValidationUtil, 'validateUrl').mockResolvedValue();
    });

    it('should create webhook successfully with auto-generated secret', async () => {
      jest.spyOn(prisma.webhook, 'count').mockResolvedValue(5);
      jest
        .spyOn(prisma.webhook, 'create')
        .mockResolvedValue(mockWebhook as any);

      const result = await service.createWebhook(
        'test-project',
        createDto,
        mockAuthContext,
      );

      expect(SecurityUtil.getProjectWithAccess).toHaveBeenCalledWith(
        prisma,
        'test-project',
        mockAuthContext,
        'webhook creation',
      );
      expect(prisma.webhook.count).toHaveBeenCalledWith({
        where: { projectId: 'project-123' },
      });
      expect(UrlValidationUtil.validateUrl).toHaveBeenCalledWith(
        createDto.url,
        'webhook URL',
      );
      expect(result).toHaveProperty('secret');
      expect(result.secret).toMatch(/^whsec_/);
    });

    it('should create webhook with user-provided secret', async () => {
      jest.spyOn(prisma.webhook, 'count').mockResolvedValue(5);
      jest.spyOn(prisma.webhook, 'create').mockResolvedValue({
        ...mockWebhook,
        secret: 'whsec_custom_secret',
      } as any);

      const dtoWithSecret = { ...createDto, secret: 'whsec_custom_secret' };
      const result = await service.createWebhook(
        'test-project',
        dtoWithSecret,
        mockAuthContext,
      );

      expect(result.secret).toBe('whsec_custom_secret');
      expect(result.message).toBe('Webhook created with your custom secret');
    });

    it('should validate webhook URL for SSRF', async () => {
      jest.spyOn(prisma.webhook, 'count').mockResolvedValue(5);
      const validateSpy = jest
        .spyOn(UrlValidationUtil, 'validateUrl')
        .mockResolvedValue();

      jest
        .spyOn(prisma.webhook, 'create')
        .mockResolvedValue(mockWebhook as any);

      await service.createWebhook('test-project', createDto, mockAuthContext);

      expect(validateSpy).toHaveBeenCalledWith(
        'https://example.com/webhook',
        'webhook URL',
      );
    });

    it('should reject webhook creation when limit reached', async () => {
      jest.spyOn(prisma.webhook, 'count').mockResolvedValue(50); // At limit

      await expect(
        service.createWebhook('test-project', createDto, mockAuthContext),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.webhook.create).not.toHaveBeenCalled();
    });

    it('should reject SSRF attempts', async () => {
      jest.spyOn(prisma.webhook, 'count').mockResolvedValue(5);
      jest
        .spyOn(UrlValidationUtil, 'validateUrl')
        .mockRejectedValue(
          new BadRequestException('Localhost addresses not allowed'),
        );

      const maliciousDto = { ...createDto, url: 'http://localhost:6379' };

      await expect(
        service.createWebhook('test-project', maliciousDto, mockAuthContext),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.webhook.create).not.toHaveBeenCalled();
    });
  });

  describe('listWebhooks', () => {
    it('should list all webhooks with masked secrets', async () => {
      jest
        .spyOn(SecurityUtil, 'getProjectWithAccess')
        .mockResolvedValue(mockProject as any);
      jest
        .spyOn(prisma.webhook, 'findMany')
        .mockResolvedValue([
          mockWebhook,
          { ...mockWebhook, id: 'webhook-456', name: 'Second Webhook' },
        ] as any);

      const result = await service.listWebhooks(
        'test-project',
        mockAuthContext,
      );

      expect(result).toHaveLength(2);
      expect(result[0].secret).toBe('whsec_test12...');
      expect(result[0].secret).not.toBe(mockWebhook.secret);
    });

    it('should return empty array when no webhooks exist', async () => {
      jest
        .spyOn(SecurityUtil, 'getProjectWithAccess')
        .mockResolvedValue(mockProject as any);
      jest.spyOn(prisma.webhook, 'findMany').mockResolvedValue([]);

      const result = await service.listWebhooks(
        'test-project',
        mockAuthContext,
      );

      expect(result).toEqual([]);
    });
  });

  describe('getWebhook', () => {
    it('should return webhook with stats and masked secret', async () => {
      jest
        .spyOn(SecurityUtil, 'getProjectWithAccess')
        .mockResolvedValue(mockProject as any);
      jest
        .spyOn(prisma.webhook, 'findFirst')
        .mockResolvedValue(mockWebhook as any);
      jest.spyOn(webhookDeliveryService, 'getDeliveryStats').mockResolvedValue({
        total: 100,
        successful: 95,
        failed: 5,
        pending: 0,
        successRate: '95.00%',
      });

      const result = await service.getWebhook(
        'test-project',
        'webhook-123',
        mockAuthContext,
      );

      expect(result.id).toBe('webhook-123');
      expect(result.secret).toBe('whsec_test12...');
      expect(result.stats).toBeDefined();
      expect(result.stats.total).toBe(100);
    });

    it('should throw NotFoundException when webhook does not exist', async () => {
      jest
        .spyOn(SecurityUtil, 'getProjectWithAccess')
        .mockResolvedValue(mockProject as any);
      jest.spyOn(prisma.webhook, 'findFirst').mockResolvedValue(null);

      await expect(
        service.getWebhook('test-project', 'nonexistent', mockAuthContext),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not return webhook from different project', async () => {
      jest
        .spyOn(SecurityUtil, 'getProjectWithAccess')
        .mockResolvedValue(mockProject as any);
      jest.spyOn(prisma.webhook, 'findFirst').mockResolvedValue(null);

      await expect(
        service.getWebhook(
          'test-project',
          'webhook-from-other-project',
          mockAuthContext,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.webhook.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'webhook-from-other-project',
          projectId: 'project-123',
        },
      });
    });
  });

  describe('updateWebhook', () => {
    const updateDto: UpdateWebhookDto = {
      name: 'Updated Webhook',
      isActive: false,
    };

    beforeEach(() => {
      jest
        .spyOn(SecurityUtil, 'getProjectWithAccess')
        .mockResolvedValue(mockProject as any);
    });

    it('should update webhook successfully', async () => {
      jest
        .spyOn(prisma.webhook, 'findFirst')
        .mockResolvedValue(mockWebhook as any);
      jest.spyOn(prisma.webhook, 'update').mockResolvedValue({
        ...mockWebhook,
        ...updateDto,
      } as any);

      const result = await service.updateWebhook(
        'test-project',
        'webhook-123',
        updateDto,
        mockAuthContext,
      );

      expect(result.name).toBe('Updated Webhook');
      expect(result.isActive).toBe(false);
      expect(result.secret).toBe('whsec_test12...'); // Masked
    });

    it('should validate URL when updating webhook URL', async () => {
      jest
        .spyOn(prisma.webhook, 'findFirst')
        .mockResolvedValue(mockWebhook as any);
      const validateSpy = jest
        .spyOn(UrlValidationUtil, 'validateUrl')
        .mockResolvedValue();
      jest
        .spyOn(prisma.webhook, 'update')
        .mockResolvedValue(mockWebhook as any);

      const updateWithUrl = { url: 'https://newurl.com/webhook' };
      await service.updateWebhook(
        'test-project',
        'webhook-123',
        updateWithUrl,
        mockAuthContext,
      );

      expect(validateSpy).toHaveBeenCalledWith(
        'https://newurl.com/webhook',
        'webhook URL',
      );
    });

    it('should NOT validate URL when not updating URL', async () => {
      jest
        .spyOn(prisma.webhook, 'findFirst')
        .mockResolvedValue(mockWebhook as any);
      jest
        .spyOn(prisma.webhook, 'update')
        .mockResolvedValue(mockWebhook as any);

      // Clear any previous spy calls
      jest.clearAllMocks();
      const validateSpy = jest.spyOn(UrlValidationUtil, 'validateUrl');

      await service.updateWebhook(
        'test-project',
        'webhook-123',
        updateDto,
        mockAuthContext,
      );

      expect(validateSpy).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when webhook does not exist', async () => {
      jest.spyOn(prisma.webhook, 'findFirst').mockResolvedValue(null);

      await expect(
        service.updateWebhook(
          'test-project',
          'nonexistent',
          updateDto,
          mockAuthContext,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.webhook.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteWebhook', () => {
    beforeEach(() => {
      jest
        .spyOn(SecurityUtil, 'getProjectWithAccess')
        .mockResolvedValue(mockProject as any);
    });

    it('should delete webhook successfully', async () => {
      jest
        .spyOn(prisma.webhook, 'findFirst')
        .mockResolvedValue(mockWebhook as any);
      jest
        .spyOn(prisma.webhook, 'delete')
        .mockResolvedValue(mockWebhook as any);

      const result = await service.deleteWebhook(
        'test-project',
        'webhook-123',
        mockAuthContext,
      );

      expect(result).toEqual({
        message: 'Webhook deleted successfully',
        id: 'webhook-123',
      });
      expect(prisma.webhook.delete).toHaveBeenCalledWith({
        where: { id: 'webhook-123' },
      });
    });

    it('should throw NotFoundException when webhook does not exist', async () => {
      jest.spyOn(prisma.webhook, 'findFirst').mockResolvedValue(null);

      await expect(
        service.deleteWebhook('test-project', 'nonexistent', mockAuthContext),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.webhook.delete).not.toHaveBeenCalled();
    });
  });

  describe('getDeliveries', () => {
    const queryDto: QueryDeliveriesDto = {
      limit: 10,
      offset: 0,
    };

    beforeEach(() => {
      jest
        .spyOn(SecurityUtil, 'getProjectWithAccess')
        .mockResolvedValue(mockProject as any);
    });

    it('should return paginated deliveries', async () => {
      jest
        .spyOn(prisma.webhook, 'findFirst')
        .mockResolvedValue(mockWebhook as any);

      const mockDeliveries = Array.from({ length: 10 }, (_, i) => ({
        id: `delivery-${i}`,
        webhookId: 'webhook-123',
        event: WebhookEventType.MESSAGE_RECEIVED,
        status: 'success',
        attempts: 1,
        createdAt: new Date(),
      }));

      jest
        .spyOn(prisma.webhookDelivery, 'findMany')
        .mockResolvedValue(mockDeliveries as any);
      jest.spyOn(prisma.webhookDelivery, 'count').mockResolvedValue(50);

      const result = await service.getDeliveries(
        'test-project',
        'webhook-123',
        queryDto,
        mockAuthContext,
      );

      expect(result.deliveries).toHaveLength(10);
      expect(result.pagination).toEqual({
        total: 50,
        limit: 10,
        offset: 0,
        hasMore: true,
      });
    });

    it('should filter deliveries by event', async () => {
      jest
        .spyOn(prisma.webhook, 'findFirst')
        .mockResolvedValue(mockWebhook as any);
      jest.spyOn(prisma.webhookDelivery, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.webhookDelivery, 'count').mockResolvedValue(0);

      const queryWithEvent = {
        ...queryDto,
        event: WebhookEventType.MESSAGE_SENT,
      };
      await service.getDeliveries(
        'test-project',
        'webhook-123',
        queryWithEvent,
        mockAuthContext,
      );

      expect(prisma.webhookDelivery.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            webhookId: 'webhook-123',
            event: WebhookEventType.MESSAGE_SENT,
          }),
        }),
      );
    });

    it('should filter deliveries by status', async () => {
      jest
        .spyOn(prisma.webhook, 'findFirst')
        .mockResolvedValue(mockWebhook as any);
      jest.spyOn(prisma.webhookDelivery, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.webhookDelivery, 'count').mockResolvedValue(0);

      const queryWithStatus = { ...queryDto, status: 'failed' as const };
      await service.getDeliveries(
        'test-project',
        'webhook-123',
        queryWithStatus,
        mockAuthContext,
      );

      expect(prisma.webhookDelivery.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            webhookId: 'webhook-123',
            status: 'failed',
          }),
        }),
      );
    });

    it('should throw NotFoundException when webhook does not exist', async () => {
      jest.spyOn(prisma.webhook, 'findFirst').mockResolvedValue(null);

      await expect(
        service.getDeliveries(
          'test-project',
          'nonexistent',
          queryDto,
          mockAuthContext,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('maskSecret', () => {
    it('should mask long secrets properly', () => {
      const webhooks = [
        {
          ...mockWebhook,
          secret: 'whsec_1234567890abcdefghijklmnopqrstuvwxyz',
        },
      ];

      jest
        .spyOn(SecurityUtil, 'getProjectWithAccess')
        .mockResolvedValue(mockProject as any);
      jest.spyOn(prisma.webhook, 'findMany').mockResolvedValue(webhooks as any);

      return service
        .listWebhooks('test-project', mockAuthContext)
        .then((result) => {
          expect(result[0].secret).toBe('whsec_123456...');
          expect(result[0].secret).not.toContain('abcdefghijklmnopqrstuvwxyz');
        });
    });

    it('should fully mask short secrets', () => {
      const webhooks = [
        {
          ...mockWebhook,
          secret: 'short',
        },
      ];

      jest
        .spyOn(SecurityUtil, 'getProjectWithAccess')
        .mockResolvedValue(mockProject as any);
      jest.spyOn(prisma.webhook, 'findMany').mockResolvedValue(webhooks as any);

      return service
        .listWebhooks('test-project', mockAuthContext)
        .then((result) => {
          expect(result[0].secret).toBe('********');
        });
    });
  });
});
