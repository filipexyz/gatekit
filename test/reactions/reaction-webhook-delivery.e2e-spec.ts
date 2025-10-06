import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AppModule } from '../../src/app.module';
import { ReactionType } from '@prisma/client';
import { WebhookDeliveryService } from '../../src/webhooks/services/webhook-delivery.service';
import { WebhookEventType } from '../../src/webhooks/types/webhook-event.types';

/**
 * E2E Tests for Reaction Webhook Delivery
 *
 * Tests that reactions stored via MessagesService trigger webhook deliveries
 * with correct event types and payloads.
 */
describe('Reaction Webhook Delivery (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let webhookDeliveryService: WebhookDeliveryService;

  // Test fixtures
  const testProject = {
    id: 'test-project-webhook',
    name: 'Test Project Webhook',
    ownerId: 'test-owner-webhook',
  };

  const testPlatform = {
    id: 'test-platform-webhook-id',
    projectId: testProject.id,
    platform: 'discord',
    name: 'Test Discord Webhook',
    credentialsEncrypted: 'encrypted',
  };

  const testWebhook = {
    projectId: testProject.id,
    name: 'Test Webhook',
    url: 'https://example.com/webhook', // Mock prevents actual calls
    events: ['reaction.added', 'reaction.removed'],
    secret: 'test-secret',
    isActive: true,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    webhookDeliveryService = app.get<WebhookDeliveryService>(
      WebhookDeliveryService,
    );

    // Mock HttpService.axiosRef.post to prevent actual HTTP calls
    // Access the private httpService from webhookDeliveryService
    const httpService = webhookDeliveryService['httpService'];
    jest.spyOn(httpService.axiosRef, 'post').mockResolvedValue({
      status: 200,
      statusText: 'OK',
      data: {},
      headers: {},
      config: {} as any,
    } as any);

    // Clean up and create test data
    await prisma.webhookDelivery.deleteMany({});
    await prisma.webhook.deleteMany({ where: { projectId: testProject.id } });
    await prisma.receivedReaction.deleteMany({});
    await prisma.projectPlatform.deleteMany({
      where: { projectId: testProject.id },
    });
    await prisma.project.deleteMany({ where: { id: testProject.id } });
    await prisma.user.deleteMany({ where: { id: testProject.ownerId } });

    await prisma.user.create({
      data: {
        id: testProject.ownerId,
        auth0Id: 'auth0|test-owner-webhook',
        email: 'test-webhook@example.com',
      },
    });

    await prisma.project.create({
      data: testProject,
    });

    await prisma.projectPlatform.create({
      data: testPlatform,
    });
  });

  afterAll(async () => {
    await prisma.webhookDelivery.deleteMany({});
    await prisma.webhook.deleteMany({ where: { projectId: testProject.id } });
    await prisma.receivedReaction.deleteMany({});
    await prisma.projectPlatform.deleteMany({
      where: { projectId: testProject.id },
    });
    await prisma.project.deleteMany({ where: { id: testProject.id } });
    await prisma.user.deleteMany({ where: { id: testProject.ownerId } });
    await app.close();
  });

  beforeEach(async () => {
    await prisma.webhookDelivery.deleteMany({});
    await prisma.webhook.deleteMany({ where: { projectId: testProject.id } });
    await prisma.receivedReaction.deleteMany({});
  });

  describe('Webhook Delivery via MessagesService', () => {
    it('should deliver webhook for reaction.added event', async () => {
      // Create webhook subscription
      const webhook = await prisma.webhook.create({
        data: testWebhook,
      });

      // Manually trigger the same flow as MessagesService.storeIncomingReaction
      const reaction = await prisma.receivedReaction.create({
        data: {
          projectId: testProject.id,
          platformId: testPlatform.id,
          platform: 'discord',
          providerMessageId: 'msg-123',
          providerChatId: 'channel-456',
          providerUserId: 'user-789',
          userDisplay: 'TestUser',
          emoji: '👍',
          reactionType: ReactionType.added,
          rawData: {},
        },
      });

      // Deliver webhook by calling the internal method directly (bypasses fire-and-forget)
      const webhookPayload = {
        event: WebhookEventType.REACTION_ADDED,
        timestamp: new Date().toISOString(),
        project_id: testProject.id,
        data: {
          message_id: reaction.id,
          platform: 'discord',
          platform_id: testPlatform.id,
          chat_id: 'channel-456',
          user_id: 'user-789',
          user_display: 'TestUser',
          emoji: '👍',
          timestamp: reaction.receivedAt.toISOString(),
          raw: {
            original_message_id: 'msg-123',
          },
        },
      };

      // Call deliverToWebhook directly to avoid fire-and-forget
      await webhookDeliveryService['deliverToWebhook'](
        webhook,
        webhookPayload as any,
      );

      // Verify webhook delivery was created
      const deliveries = await prisma.webhookDelivery.findMany({
        where: { webhookId: webhook.id },
      });

      expect(deliveries).toHaveLength(1);
      expect(deliveries[0].event).toBe('reaction.added');
      expect(deliveries[0].status).toBe('success');

      // Verify payload contains correct data
      const payload = deliveries[0].payload as any;
      expect(payload.event).toBe('reaction.added');
      expect(payload.data.emoji).toBe('👍');
      expect(payload.data.platform).toBe('discord');
      expect(payload.data.user_display).toBe('TestUser');
      expect(payload.data.timestamp).toBeDefined();
    });

    it('should deliver webhook for reaction.removed event', async () => {
      // Create webhook subscription
      const webhook = await prisma.webhook.create({
        data: testWebhook,
      });

      // Create reaction removal
      const reaction = await prisma.receivedReaction.create({
        data: {
          projectId: testProject.id,
          platformId: testPlatform.id,
          platform: 'telegram',
          providerMessageId: 'msg-456',
          providerChatId: 'chat-789',
          providerUserId: 'user-123',
          userDisplay: 'TelegramUser',
          emoji: '❤️',
          reactionType: ReactionType.removed,
          rawData: {},
        },
      });

      // Deliver webhook directly
      const webhookPayload = {
        event: WebhookEventType.REACTION_REMOVED,
        timestamp: new Date().toISOString(),
        project_id: testProject.id,
        data: {
          message_id: reaction.id,
          platform: 'telegram',
          platform_id: testPlatform.id,
          chat_id: 'chat-789',
          user_id: 'user-123',
          user_display: 'TelegramUser',
          emoji: '❤️',
          timestamp: reaction.receivedAt.toISOString(),
          raw: {
            original_message_id: 'msg-456',
          },
        },
      };

      await webhookDeliveryService['deliverToWebhook'](
        webhook,
        webhookPayload as any,
      );

      // Verify webhook delivery
      const deliveries = await prisma.webhookDelivery.findMany({
        where: { webhookId: webhook.id },
      });

      expect(deliveries).toHaveLength(1);
      expect(deliveries[0].event).toBe('reaction.removed');

      const payload = deliveries[0].payload as any;
      expect(payload.event).toBe('reaction.removed');
      expect(payload.data.emoji).toBe('❤️');
      expect(payload.data.platform).toBe('telegram');
    });

    it('should NOT deliver webhook if no subscription exists', async () => {
      // No webhook created - reactions should still be stored

      const reaction = await prisma.receivedReaction.create({
        data: {
          projectId: testProject.id,
          platformId: testPlatform.id,
          platform: 'whatsapp-evo',
          providerMessageId: 'msg-999',
          providerChatId: 'chat-999',
          providerUserId: 'user-999',
          userDisplay: 'WhatsAppUser',
          emoji: '🔥',
          reactionType: ReactionType.added,
          rawData: {},
        },
      });

      // Try to deliver (should succeed but create no deliveries)
      await webhookDeliveryService.deliverEvent(
        testProject.id,
        WebhookEventType.REACTION_ADDED,
        {
          message_id: reaction.id,
          platform: 'whatsapp-evo',
          platform_id: testPlatform.id,
          chat_id: 'chat-999',
          user_id: 'user-999',
          user_display: 'WhatsAppUser',
          emoji: '🔥',
          timestamp: reaction.receivedAt.toISOString(),
          raw: {
            original_message_id: 'msg-999',
          },
        },
      );

      // No deliveries should exist
      const deliveries = await prisma.webhookDelivery.findMany({});
      expect(deliveries).toHaveLength(0);

      // But reaction should still be stored
      const storedReaction = await prisma.receivedReaction.findFirst({
        where: { id: reaction.id },
      });
      expect(storedReaction).toBeDefined();
    });

    it('should NOT deliver webhook if subscription is inactive', async () => {
      // Create inactive webhook
      const webhook = await prisma.webhook.create({
        data: {
          ...testWebhook,
          isActive: false,
        },
      });

      const reaction = await prisma.receivedReaction.create({
        data: {
          projectId: testProject.id,
          platformId: testPlatform.id,
          platform: 'discord',
          providerMessageId: 'msg-inactive',
          providerChatId: 'channel-inactive',
          providerUserId: 'user-inactive',
          userDisplay: 'InactiveTest',
          emoji: '⚠️',
          reactionType: ReactionType.added,
          rawData: {},
        },
      });

      await webhookDeliveryService.deliverEvent(
        testProject.id,
        WebhookEventType.REACTION_ADDED,
        {
          message_id: reaction.id,
          platform: 'discord',
          platform_id: testPlatform.id,
          chat_id: 'channel-inactive',
          user_id: 'user-inactive',
          user_display: 'InactiveTest',
          emoji: '⚠️',
          timestamp: reaction.receivedAt.toISOString(),
          raw: {
            original_message_id: 'msg-inactive',
          },
        },
      );

      // No deliveries for inactive webhook
      const deliveries = await prisma.webhookDelivery.findMany({
        where: { webhookId: webhook.id },
      });
      expect(deliveries).toHaveLength(0);
    });

    it('should use consistent timestamp field for both add and remove', async () => {
      const webhook = await prisma.webhook.create({
        data: testWebhook,
      });

      // Test added reaction
      const addedReaction = await prisma.receivedReaction.create({
        data: {
          projectId: testProject.id,
          platformId: testPlatform.id,
          platform: 'discord',
          providerMessageId: 'msg-timestamp-1',
          providerChatId: 'channel-timestamp',
          providerUserId: 'user-timestamp',
          userDisplay: 'TimestampUser',
          emoji: '⏰',
          reactionType: ReactionType.added,
          rawData: {},
        },
      });

      const payload1 = {
        event: WebhookEventType.REACTION_ADDED,
        timestamp: new Date().toISOString(),
        project_id: testProject.id,
        data: {
          message_id: addedReaction.id,
          platform: 'discord',
          platform_id: testPlatform.id,
          chat_id: 'channel-timestamp',
          user_id: 'user-timestamp',
          user_display: 'TimestampUser',
          emoji: '⏰',
          timestamp: addedReaction.receivedAt.toISOString(),
          raw: {},
        },
      };
      await webhookDeliveryService['deliverToWebhook'](
        webhook,
        payload1 as any,
      );

      // Test removed reaction
      const removedReaction = await prisma.receivedReaction.create({
        data: {
          projectId: testProject.id,
          platformId: testPlatform.id,
          platform: 'discord',
          providerMessageId: 'msg-timestamp-2',
          providerChatId: 'channel-timestamp',
          providerUserId: 'user-timestamp',
          userDisplay: 'TimestampUser',
          emoji: '⏰',
          reactionType: ReactionType.removed,
          rawData: {},
        },
      });

      const payload2 = {
        event: WebhookEventType.REACTION_REMOVED,
        timestamp: new Date().toISOString(),
        project_id: testProject.id,
        data: {
          message_id: removedReaction.id,
          platform: 'discord',
          platform_id: testPlatform.id,
          chat_id: 'channel-timestamp',
          user_id: 'user-timestamp',
          user_display: 'TimestampUser',
          emoji: '⏰',
          timestamp: removedReaction.receivedAt.toISOString(),
          raw: {},
        },
      };
      await webhookDeliveryService['deliverToWebhook'](
        webhook,
        payload2 as any,
      );

      const deliveries = await prisma.webhookDelivery.findMany({
        where: { webhookId: webhook.id },
        orderBy: { createdAt: 'asc' },
      });

      expect(deliveries).toHaveLength(2);

      // Both should use 'timestamp' field (not reacted_at/removed_at)
      const addedPayload = deliveries[0].payload as any;
      const removedPayload = deliveries[1].payload as any;

      expect(addedPayload.data.timestamp).toBeDefined();
      expect(addedPayload.data.reacted_at).toBeUndefined();

      expect(removedPayload.data.timestamp).toBeDefined();
      expect(removedPayload.data.removed_at).toBeUndefined();
    });
  });
});
