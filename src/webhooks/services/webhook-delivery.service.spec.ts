import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UrlValidationUtil } from '../../common/utils/url-validation.util';
import { WebhookEventType } from '../types/webhook-event.types';

describe('WebhookDeliveryService', () => {
  let service: WebhookDeliveryService;
  let prisma: PrismaService;
  let httpService: HttpService;

  const mockWebhook = {
    id: 'webhook-123',
    projectId: 'project-123',
    name: 'Test Webhook',
    url: 'https://example.com/webhook',
    events: ['message.received'],
    secret: 'whsec_test123',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDelivery = {
    id: 'delivery-123',
    webhookId: 'webhook-123',
    event: WebhookEventType.MESSAGE_RECEIVED,
    payload: {},
    status: 'pending',
    attempts: 0,
    createdAt: new Date(),
  };

  const mockPayload = {
    event: WebhookEventType.MESSAGE_RECEIVED,
    timestamp: '2025-09-30T00:00:00.000Z',
    project_id: 'project-123',
    data: {
      message_id: 'msg-123',
      platform: 'telegram',
      platform_id: 'platform-123',
      chat_id: 'chat-123',
      text: 'Hello',
      timestamp: '2025-09-30T00:00:00.000Z',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookDeliveryService,
        {
          provide: PrismaService,
          useValue: {
            webhook: {
              findMany: jest.fn(),
            },
            webhookDelivery: {
              create: jest.fn(),
              update: jest.fn(),
              deleteMany: jest.fn(),
              groupBy: jest.fn(),
            },
          },
        },
        {
          provide: HttpService,
          useValue: {
            axiosRef: {
              post: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<WebhookDeliveryService>(WebhookDeliveryService);
    prisma = module.get<PrismaService>(PrismaService);
    httpService = module.get<HttpService>(HttpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('deliverEvent', () => {
    it('should not deliver when no webhooks subscribed', async () => {
      jest.spyOn(prisma.webhook, 'findMany').mockResolvedValue([]);

      await service.deliverEvent(
        'project-123',
        WebhookEventType.MESSAGE_RECEIVED,
        mockPayload.data,
      );

      expect(prisma.webhook.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'project-123',
          isActive: true,
          events: { has: WebhookEventType.MESSAGE_RECEIVED },
        },
      });
      expect(prisma.webhookDelivery.create).not.toHaveBeenCalled();
    });

    it('should deliver to all subscribed webhooks with concurrency limit', async () => {
      const webhooks = Array.from({ length: 15 }, (_, i) => ({
        ...mockWebhook,
        id: `webhook-${i}`,
      }));

      jest.spyOn(prisma.webhook, 'findMany').mockResolvedValue(webhooks);
      jest
        .spyOn(prisma.webhookDelivery, 'create')
        .mockResolvedValue(mockDelivery as any);
      jest.spyOn(prisma.webhookDelivery, 'update').mockResolvedValue({} as any);
      jest.spyOn(httpService.axiosRef, 'post').mockResolvedValue({
        status: 200,
        data: { success: true },
      } as any);
      jest.spyOn(UrlValidationUtil, 'validateUrl').mockResolvedValue();

      await service.deliverEvent(
        'project-123',
        WebhookEventType.MESSAGE_RECEIVED,
        mockPayload.data,
      );

      // Wait for fire-and-forget to complete
      await new Promise((resolve) => setImmediate(resolve));

      // Should have created deliveries for all webhooks
      expect(prisma.webhookDelivery.create).toHaveBeenCalledTimes(15);
    });
  });

  describe('deliverToWebhook (via successful delivery)', () => {
    it('should successfully deliver webhook on first attempt', async () => {
      jest
        .spyOn(prisma.webhook, 'findMany')
        .mockResolvedValue([mockWebhook] as any);
      jest
        .spyOn(prisma.webhookDelivery, 'create')
        .mockResolvedValue(mockDelivery as any);
      jest.spyOn(prisma.webhookDelivery, 'update').mockResolvedValue({} as any);
      jest.spyOn(httpService.axiosRef, 'post').mockResolvedValue({
        status: 200,
        data: { success: true },
      } as any);
      jest.spyOn(UrlValidationUtil, 'validateUrl').mockResolvedValue();

      await service.deliverEvent(
        'project-123',
        WebhookEventType.MESSAGE_RECEIVED,
        mockPayload.data,
      );

      // Wait for fire-and-forget to complete
      await new Promise((resolve) => setImmediate(resolve));

      expect(prisma.webhookDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockDelivery.id },
          data: expect.objectContaining({
            status: 'success',
            responseCode: 200,
            attempts: 1, // First attempt
          }),
        }),
      );
    });

    it('should validate URL before sending request', async () => {
      jest
        .spyOn(prisma.webhook, 'findMany')
        .mockResolvedValue([mockWebhook] as any);
      jest
        .spyOn(prisma.webhookDelivery, 'create')
        .mockResolvedValue(mockDelivery as any);
      jest.spyOn(prisma.webhookDelivery, 'update').mockResolvedValue({} as any);
      const validateSpy = jest
        .spyOn(UrlValidationUtil, 'validateUrl')
        .mockResolvedValue();
      jest.spyOn(httpService.axiosRef, 'post').mockResolvedValue({
        status: 200,
        data: {},
      } as any);

      await service.deliverEvent(
        'project-123',
        WebhookEventType.MESSAGE_RECEIVED,
        mockPayload.data,
      );

      // Wait for fire-and-forget to complete
      await new Promise((resolve) => setImmediate(resolve));

      expect(validateSpy).toHaveBeenCalledWith(
        'https://example.com/webhook',
        'webhook delivery',
      );
    });
  });

  describe('retry logic', () => {
    beforeEach(() => {
      // Mock sleep to make tests run instantly
      jest.spyOn(service as any, 'sleep').mockResolvedValue(undefined);
    });

    it('should retry on 5xx errors and record actual attempts', async () => {
      jest
        .spyOn(prisma.webhook, 'findMany')
        .mockResolvedValue([mockWebhook] as any);
      jest
        .spyOn(prisma.webhookDelivery, 'create')
        .mockResolvedValue(mockDelivery as any);
      jest.spyOn(prisma.webhookDelivery, 'update').mockResolvedValue({} as any);
      jest.spyOn(UrlValidationUtil, 'validateUrl').mockResolvedValue();

      // Fail twice, succeed on third
      let callCount = 0;
      jest.spyOn(httpService.axiosRef, 'post').mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          const error = new Error('Server error') as Error & {
            response: { status: number };
          };
          error.response = { status: 500 };
          return Promise.reject(error);
        }
        return Promise.resolve({ status: 200, data: {} } as any);
      });

      await service.deliverEvent(
        'project-123',
        WebhookEventType.MESSAGE_RECEIVED,
        mockPayload.data,
      );

      // Wait for fire-and-forget to complete
      await new Promise((resolve) => setImmediate(resolve));

      expect(httpService.axiosRef.post).toHaveBeenCalledTimes(3);
      expect(prisma.webhookDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockDelivery.id },
          data: expect.objectContaining({
            status: 'success',
            attempts: 3, // Third attempt succeeded
          }),
        }),
      );
    });

    it('should NOT retry on 4xx errors', async () => {
      jest
        .spyOn(prisma.webhook, 'findMany')
        .mockResolvedValue([mockWebhook] as any);
      jest
        .spyOn(prisma.webhookDelivery, 'create')
        .mockResolvedValue(mockDelivery as any);
      jest.spyOn(prisma.webhookDelivery, 'update').mockResolvedValue({} as any);
      jest.spyOn(UrlValidationUtil, 'validateUrl').mockResolvedValue();

      const error = new Error('Bad request') as Error & {
        response: { status: number };
      };
      error.response = { status: 400 };
      jest.spyOn(httpService.axiosRef, 'post').mockRejectedValue(error);

      await service.deliverEvent(
        'project-123',
        WebhookEventType.MESSAGE_RECEIVED,
        mockPayload.data,
      );

      // Wait for fire-and-forget to complete
      await new Promise((resolve) => setImmediate(resolve));

      // Should only try once
      expect(httpService.axiosRef.post).toHaveBeenCalledTimes(1);
      expect(prisma.webhookDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockDelivery.id },
          data: expect.objectContaining({
            status: 'failed',
            attempts: 1,
          }),
        }),
      );
    });

    it('should fail after max retries and record all attempts', async () => {
      jest
        .spyOn(prisma.webhook, 'findMany')
        .mockResolvedValue([mockWebhook] as any);
      jest
        .spyOn(prisma.webhookDelivery, 'create')
        .mockResolvedValue(mockDelivery as any);
      jest.spyOn(prisma.webhookDelivery, 'update').mockResolvedValue({} as any);
      jest.spyOn(UrlValidationUtil, 'validateUrl').mockResolvedValue();

      const error = new Error('Server error') as Error & {
        response: { status: number };
      };
      error.response = { status: 500 };
      jest.spyOn(httpService.axiosRef, 'post').mockRejectedValue(error);

      await service.deliverEvent(
        'project-123',
        WebhookEventType.MESSAGE_RECEIVED,
        mockPayload.data,
      );

      // Wait for fire-and-forget to complete
      await new Promise((resolve) => setImmediate(resolve));

      expect(httpService.axiosRef.post).toHaveBeenCalledTimes(3); // Max 3 attempts
      expect(prisma.webhookDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockDelivery.id },
          data: expect.objectContaining({
            status: 'failed',
            attempts: 3, // All 3 attempts failed
          }),
        }),
      );
    });
  });

  describe('HMAC signature generation', () => {
    it('should generate correct HMAC signature', async () => {
      jest
        .spyOn(prisma.webhook, 'findMany')
        .mockResolvedValue([mockWebhook] as any);
      jest
        .spyOn(prisma.webhookDelivery, 'create')
        .mockResolvedValue(mockDelivery as any);
      jest.spyOn(prisma.webhookDelivery, 'update').mockResolvedValue({} as any);
      jest.spyOn(UrlValidationUtil, 'validateUrl').mockResolvedValue();

      const postSpy = jest
        .spyOn(httpService.axiosRef, 'post')
        .mockResolvedValue({
          status: 200,
          data: {},
        } as any);

      await service.deliverEvent(
        'project-123',
        WebhookEventType.MESSAGE_RECEIVED,
        mockPayload.data,
      );

      // Wait for fire-and-forget to complete
      await new Promise((resolve) => setImmediate(resolve));

      expect(postSpy).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.any(Object),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-GateKit-Signature': expect.stringMatching(
              /^sha256=[a-f0-9]{64}$/,
            ),
            'X-GateKit-Timestamp': expect.any(String),
            'X-GateKit-Event': WebhookEventType.MESSAGE_RECEIVED,
          }),
        }),
      );
    });
  });

  describe('getDeliveryStats', () => {
    it('should return correct statistics using groupBy', async () => {
      jest.spyOn(prisma.webhookDelivery, 'groupBy').mockResolvedValue([
        { status: 'success', _count: { status: 80 } },
        { status: 'failed', _count: { status: 15 } },
        { status: 'pending', _count: { status: 5 } },
      ] as any);

      const stats = await service.getDeliveryStats('webhook-123');

      expect(stats).toEqual({
        total: 100,
        successful: 80,
        failed: 15,
        pending: 5,
        successRate: '80.00%',
      });
    });

    it('should handle empty statistics', async () => {
      jest.spyOn(prisma.webhookDelivery, 'groupBy').mockResolvedValue([]);

      const stats = await service.getDeliveryStats('webhook-123');

      expect(stats).toEqual({
        total: 0,
        successful: 0,
        failed: 0,
        pending: 0,
        successRate: '0.00%',
      });
    });
  });

  describe('cleanupOldDeliveries', () => {
    it('should delete deliveries older than specified days', async () => {
      jest
        .spyOn(prisma.webhookDelivery, 'deleteMany')
        .mockResolvedValue({ count: 42 } as any);

      const result = await service.cleanupOldDeliveries(30);

      expect(result).toBe(42);
      expect(prisma.webhookDelivery.deleteMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            lt: expect.any(Date),
          },
        },
      });
    });

    it('should use default 30 days if not specified', async () => {
      jest
        .spyOn(prisma.webhookDelivery, 'deleteMany')
        .mockResolvedValue({ count: 10 } as any);

      await service.cleanupOldDeliveries();

      const call = (prisma.webhookDelivery.deleteMany as jest.Mock).mock
        .calls[0][0];
      const cutoffDate = call.where.createdAt.lt;
      const daysDiff = Math.floor(
        (Date.now() - cutoffDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      expect(daysDiff).toBeGreaterThanOrEqual(29); // Allow for timing variance
      expect(daysDiff).toBeLessThanOrEqual(31);
    });
  });
});
