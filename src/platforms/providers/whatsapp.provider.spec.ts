import { Test, TestingModule } from '@nestjs/testing';
import { WhatsAppProvider } from './whatsapp.provider';
import { EVENT_BUS } from '../interfaces/event-bus.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformLogsService } from '../services/platform-logs.service';
import { WebhookDeliveryService } from '../../webhooks/services/webhook-delivery.service';
import { MessagesService } from '../messages/messages.service';
import { TranscriptionService } from '../../voice/services/transcription.service';
import { NotFoundException } from '@nestjs/common';

// Mock fetch globally
global.fetch = jest.fn();

describe('WhatsAppProvider', () => {
  let provider: WhatsAppProvider;
  let eventBus: any;
  let prisma: any;
  let platformLogsService: any;

  const mockEventBus = {
    publish: jest.fn(),
  };

  const mockPrisma = {
    projectPlatform: {
      findUnique: jest.fn(),
    },
    receivedMessage: {
      create: jest.fn(),
    },
  };

  const mockPlatformLogsService = {
    logActivity: jest.fn().mockResolvedValue(undefined),
  };

  const mockWebhookDeliveryService = {
    deliverEvent: jest.fn().mockResolvedValue(undefined),
  };

  const mockMessagesService = {
    storeIncomingMessage: jest.fn().mockResolvedValue(undefined),
  };

  const mockTranscriptionService = {
    transcribe: jest.fn().mockResolvedValue({
      text: 'Mock transcription',
      provider: 'whisper',
    }),
    isAvailable: jest.fn().mockResolvedValue(true),
  };

  const mockCredentials = {
    evolutionApiUrl: 'https://evolution.example.com',
    evolutionApiKey: 'test-api-key',
    webhookToken: '12345678-1234-4321-8765-123456789abc',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppProvider,
        {
          provide: EVENT_BUS,
          useValue: mockEventBus,
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: PlatformLogsService,
          useValue: mockPlatformLogsService,
        },
        {
          provide: WebhookDeliveryService,
          useValue: mockWebhookDeliveryService,
        },
        {
          provide: MessagesService,
          useValue: mockMessagesService,
        },
        {
          provide: TranscriptionService,
          useValue: mockTranscriptionService,
        },
      ],
    }).compile();

    provider = module.get<WhatsAppProvider>(WhatsAppProvider);
    eventBus = module.get(EVENT_BUS);
    prisma = module.get<PrismaService>(PrismaService);
    platformLogsService = module.get<PlatformLogsService>(PlatformLogsService);

    jest.clearAllMocks();

    // Default mock for webhook setup success
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue('Success'),
      json: jest
        .fn()
        .mockResolvedValue({ id: 'webhook-id', url: 'webhook-url' }),
    });
  });

  describe('Basic Provider Functionality', () => {
    it('should be defined', () => {
      expect(provider).toBeDefined();
    });

    it('should have correct metadata', () => {
      expect(provider.name).toBe('whatsapp-evo');
      expect(provider.displayName).toBe('WhatsApp (Evolution API)');
      expect(provider.connectionType).toBe('webhook');
      expect(provider.channel).toBe('whatsapp-evo');
    });

    it('should initialize successfully', async () => {
      await expect(provider.initialize()).resolves.toBeUndefined();
    });

    it('should be healthy by default', async () => {
      await expect(provider.isHealthy()).resolves.toBe(true);
    });
  });

  describe('Edge Case: Evolution API Connectivity Issues', () => {
    it('should handle Evolution API server unreachable', async () => {
      // Mock network error for webhook setup
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(
        provider.createAdapter('project1:platform1', mockCredentials),
      ).rejects.toThrow('Network error');
    });

    it('should handle Evolution API returning non-200 status', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        text: jest.fn().mockResolvedValue('Webhook setup failed'),
      });

      await expect(
        provider.createAdapter('project1:platform1', mockCredentials),
      ).rejects.toThrow('Failed to setup webhook: Webhook setup failed');
    });

    it('should handle Evolution API timeout', async () => {
      // Mock slow response that rejects after timeout
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.reject(new Error('Request timeout')),
      );

      await expect(
        provider.createAdapter('project1:platform1', mockCredentials),
      ).rejects.toThrow('Request timeout');
    });

    it('should handle malformed Evolution API response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      await expect(
        provider.createAdapter('project1:platform1', mockCredentials),
      ).resolves.toBeDefined(); // Should not crash on response parsing issues
    });
  });

  describe('Edge Case: Instance Management', () => {
    it('should handle duplicate adapter creation for same connection', async () => {
      const connectionKey = 'project1:platform1';

      // First creation should succeed
      const adapter1 = await provider.createAdapter(
        connectionKey,
        mockCredentials,
      );
      expect(adapter1).toBe(provider);

      // Second creation should return existing
      const adapter2 = await provider.createAdapter(
        connectionKey,
        mockCredentials,
      );
      expect(adapter2).toBe(provider);

      // Should call Evolution API twice (webhook setup + connection status check)
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should cleanup connection on adapter creation failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(
        new Error('Creation failed'),
      );

      const connectionKey = 'project1:platform1';
      await expect(
        provider.createAdapter(connectionKey, mockCredentials),
      ).rejects.toThrow();

      // Connection should not exist after failure
      expect(provider.getAdapter(connectionKey)).toBeUndefined();
    });

    it('should handle instance deletion failure gracefully', async () => {
      const connectionKey = 'project1:platform1';

      // Create adapter successfully
      await provider.createAdapter(connectionKey, mockCredentials);

      // Mock deletion failure (webhook cleanup doesn't exist)
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        text: jest.fn().mockResolvedValue('Not Found'),
      });

      // Should not throw error
      await expect(
        provider.removeAdapter(connectionKey),
      ).resolves.toBeUndefined();
    });
  });

  describe('Edge Case: QR Code Management', () => {
    it('should return null for non-existent connection QR code', async () => {
      const qrCode = await provider.getQRCode('non-existent-connection');
      expect(qrCode).toBeNull();
    });

    it('should handle QR code updates', async () => {
      const connectionKey = 'project1:platform1';
      await provider.createAdapter(connectionKey, mockCredentials);

      // Simulate QR code update webhook
      const qrCodeBody = {
        event: 'qrcode.updated',
        data: { qrcode: 'mock-qr-code-data' },
      };

      await provider['processEvolutionWebhook'](
        'project1',
        qrCodeBody,
        'platform1',
      );

      const qrCode = await provider.getQRCode(connectionKey);
      expect(qrCode).toBe('mock-qr-code-data');
    });

    it('should handle connection state changes', async () => {
      const connectionKey = 'project1:platform1';
      await provider.createAdapter(connectionKey, mockCredentials);

      // Simulate connection update webhook
      const connectionBody = {
        event: 'connection.update',
        data: { state: 'open' },
      };

      await provider['processEvolutionWebhook'](
        'project1',
        connectionBody,
        'platform1',
      );

      const stats = provider.getConnectionStats();
      expect(stats.connections[0].isConnected).toBe(true);
      expect(stats.connections[0].connectionState).toBe('open');
    });
  });

  describe('Edge Case: Webhook Processing', () => {
    it('should handle invalid webhook token format', async () => {
      const webhookConfig = provider.getWebhookConfig();

      await expect(
        webhookConfig.handler({ webhookToken: 'invalid-uuid' }, {}, {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle webhook for disabled platform', () => {
      const webhookConfig = provider.getWebhookConfig();

      mockPrisma.projectPlatform.findUnique.mockResolvedValue({
        id: 'platform1',
        projectId: 'project1',
        platform: 'whatsapp-evo',
        isActive: false,
        project: { slug: 'test-project' },
      });

      return expect(
        webhookConfig.handler(
          { webhookToken: '12345678-1234-4321-8765-123456789abc' },
          {},
          {},
        ),
      ).resolves.toEqual({ ok: false, error: 'Platform disabled' });
    });

    it('should handle webhook for non-existent platform', async () => {
      const webhookConfig = provider.getWebhookConfig();

      mockPrisma.projectPlatform.findUnique.mockResolvedValue(null);

      await expect(
        webhookConfig.handler(
          { webhookToken: '12345678-1234-4321-8765-123456789abc' },
          {},
          {},
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle malformed webhook payload gracefully', async () => {
      const connectionKey = 'project1:platform1';
      await provider.createAdapter(connectionKey, mockCredentials);

      // Malformed message payload
      const malformedBody = {
        event: 'messages.upsert',
        data: { messages: [{ key: null, message: undefined }] },
      };

      // Should not throw error
      await expect(
        provider['processEvolutionWebhook'](
          'project1',
          malformedBody,
          'platform1',
        ),
      ).resolves.toBeUndefined();
    });

    it('should skip processing messages from self', async () => {
      const connectionKey = 'project1:platform1';
      await provider.createAdapter(connectionKey, mockCredentials);

      const selfMessageBody = {
        event: 'messages.upsert',
        data: {
          messages: [
            {
              key: {
                fromMe: true,
                id: 'msg1',
                remoteJid: '1234567890@s.whatsapp.net',
              },
              message: { conversation: 'test message' },
            },
          ],
        },
      };

      await provider['processEvolutionWebhook'](
        'project1',
        selfMessageBody,
        'platform1',
      );

      // Should not publish to event bus
      expect(eventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('Edge Case: Message Sending', () => {
    it('should handle missing platformId in envelope', async () => {
      const envelope = {
        version: '1' as const,
        id: 'test-id',
        ts: Date.now(),
        channel: 'whatsapp-evo' as const,
        projectId: 'project1',
        threadId: '1234567890@s.whatsapp.net',
        user: { providerUserId: 'user1' },
        message: { text: 'test' },
        provider: { raw: {} }, // Missing platformId
      };

      await expect(
        provider.sendMessage(envelope, { text: 'reply' }),
      ).rejects.toThrow('No platformId in envelope, cannot route message');
    });

    it('should handle sending to disconnected instance', async () => {
      const connectionKey = 'project1:platform1';
      await provider.createAdapter(connectionKey, mockCredentials);

      const envelope = {
        version: '1' as const,
        id: 'test-id',
        ts: Date.now(),
        channel: 'whatsapp-evo' as const,
        projectId: 'project1',
        threadId: '1234567890@s.whatsapp.net',
        user: { providerUserId: 'user1' },
        message: { text: 'test' },
        provider: { raw: { platformId: 'platform1' } },
      };

      // Connection exists but not connected
      await expect(
        provider.sendMessage(envelope, { text: 'reply' }),
      ).rejects.toThrow(
        'WhatsApp not connected for project1:platform1, cannot send message',
      );
    });

    it('should handle Evolution API send message failure', async () => {
      const connectionKey = 'project1:platform1';
      await provider.createAdapter(connectionKey, mockCredentials);

      // Set connection as connected
      await provider['handleConnectionUpdate'](
        (provider as any).connections.get(connectionKey),
        { data: { state: 'open' } },
      );

      // Mock API failure
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        statusText: 'Rate Limited',
        text: jest.fn().mockResolvedValue('Rate Limited'),
      });

      const envelope = {
        version: '1' as const,
        id: 'test-id',
        ts: Date.now(),
        channel: 'whatsapp-evo' as const,
        projectId: 'project1',
        threadId: '1234567890@s.whatsapp.net',
        user: { providerUserId: 'user1' },
        message: { text: 'test' },
        provider: { raw: { platformId: 'platform1' } },
      };

      await expect(
        provider.sendMessage(envelope, { text: 'reply' }),
      ).rejects.toThrow('Evolution API error: Rate Limited');
    });
  });

  describe('Edge Case: Database Constraints', () => {
    it('should handle duplicate message storage gracefully', async () => {
      const connectionKey = 'project1:platform1';
      await provider.createAdapter(connectionKey, mockCredentials);

      // Mock duplicate constraint error
      mockPrisma.receivedMessage.create.mockRejectedValue({
        code: 'P2002', // Prisma unique constraint violation
      });

      const messageBody = {
        event: 'messages.upsert',
        data: {
          messages: [
            {
              key: {
                fromMe: false,
                id: 'msg1',
                remoteJid: '1234567890@s.whatsapp.net',
              },
              message: { conversation: 'test message' },
            },
          ],
        },
      };

      // Should not throw error on duplicate
      await expect(
        provider['processEvolutionWebhook'](
          'project1',
          messageBody,
          'platform1',
        ),
      ).resolves.toBeUndefined();

      // Should still publish to event bus
      expect(eventBus.publish).toHaveBeenCalled();
    });

    it('should handle other database errors during message storage', async () => {
      const connectionKey = 'project1:platform1';
      await provider.createAdapter(connectionKey, mockCredentials);

      // Mock other database error
      mockPrisma.receivedMessage.create.mockRejectedValue(
        new Error('Database connection lost'),
      );

      const messageBody = {
        event: 'messages.upsert',
        data: {
          messages: [
            {
              key: {
                fromMe: false,
                id: 'msg1',
                remoteJid: '1234567890@s.whatsapp.net',
              },
              message: { conversation: 'test message' },
            },
          ],
        },
      };

      // Should not throw error
      await expect(
        provider['processEvolutionWebhook'](
          'project1',
          messageBody,
          'platform1',
        ),
      ).resolves.toBeUndefined();

      // Should still publish to event bus despite storage failure
      expect(eventBus.publish).toHaveBeenCalled();
    });
  });

  describe('Edge Case: Concurrent Operations', () => {
    it('should handle rapid connection creation/removal', async () => {
      const connectionKey = 'project1:platform1';

      // Simulate rapid operations
      const createPromise = provider.createAdapter(
        connectionKey,
        mockCredentials,
      );
      const removePromise = provider.removeAdapter(connectionKey);

      await Promise.allSettled([createPromise, removePromise]);

      // Should not crash and end in consistent state
      expect(
        provider.getConnectionStats().totalConnections,
      ).toBeLessThanOrEqual(1);
    });

    it('should handle auto-connection creation failure gracefully', async () => {
      // Mock platform config retrieval failure
      mockPrisma.projectPlatform.findUnique.mockRejectedValue(
        new Error('Database error'),
      );

      // Should not throw when auto-creating connection fails
      await expect(
        provider['processEvolutionWebhook'](
          'project1',
          { event: 'messages.upsert' },
          'platform1',
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('Edge Case: Resource Limits', () => {
    it('should handle empty or missing message text', async () => {
      const connectionKey = 'project1:platform1';
      await provider.createAdapter(connectionKey, mockCredentials);

      const envelope = {
        version: '1' as const,
        id: 'test-id',
        ts: Date.now(),
        channel: 'whatsapp-evo' as const,
        projectId: 'project1',
        threadId: '1234567890@s.whatsapp.net',
        user: { providerUserId: 'user1' },
        message: {},
        provider: { raw: { platformId: 'platform1' } },
      };

      // Set connection as connected
      await provider['handleConnectionUpdate'](
        (provider as any).connections.get(connectionKey),
        { data: { state: 'open' } },
      );

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ key: { id: 'sent-msg-id' } }),
        text: jest.fn().mockResolvedValue('Success'),
      });

      // Should handle empty text gracefully
      const result = await provider.sendMessage(envelope, {});
      expect(result.providerMessageId).toBe('sent-msg-id');
    });

    it('should extract text from different Evolution message formats', () => {
      const testCases = [
        {
          message: { conversation: 'direct text' },
          expected: 'direct text',
        },
        {
          message: { extendedTextMessage: { text: 'extended text' } },
          expected: 'extended text',
        },
        {
          message: { imageMessage: { caption: 'image caption' } },
          expected: '[Media message]',
        },
        {
          message: {},
          expected: '[Media message]',
        },
      ];

      testCases.forEach(({ message, expected }) => {
        const result = provider['extractMessageText']({ message } as any);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Platform Lifecycle Events', () => {
    beforeEach(() => {
      // Mock successful webhook setup
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue('Webhook configured'),
      });
    });

    it('should automatically setup webhook on platform created event', async () => {
      const event = {
        type: 'created' as const,
        projectId: 'project1',
        platformId: 'platform1',
        platform: 'whatsapp-evo',
        credentials: {
          evolutionApiUrl: 'https://evo.example.com',
          evolutionApiKey: 'test-key',
        },
        webhookToken: 'webhook-token-123',
      };

      await provider.onPlatformEvent(event);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://evo.example.com/webhook/set/gatekit',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: 'test-key',
          },
          body: expect.stringContaining('"enabled":true'),
        }),
      );
    });

    it('should automatically setup webhook on platform activated event', async () => {
      const event = {
        type: 'activated' as const,
        projectId: 'project1',
        platformId: 'platform1',
        platform: 'whatsapp-evo',
        credentials: {
          evolutionApiUrl: 'https://evo.example.com',
          evolutionApiKey: 'test-key',
        },
        webhookToken: 'webhook-token-123',
      };

      await provider.onPlatformEvent(event);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://evo.example.com/webhook/set/gatekit',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: 'test-key',
          },
        }),
      );
    });

    it('should re-setup webhook on platform updated event', async () => {
      const event = {
        type: 'updated' as const,
        projectId: 'project1',
        platformId: 'platform1',
        platform: 'whatsapp-evo',
        credentials: {
          evolutionApiUrl: 'https://evo-new.example.com',
          evolutionApiKey: 'new-test-key',
        },
        webhookToken: 'new-webhook-token',
      };

      await provider.onPlatformEvent(event);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://evo-new.example.com/webhook/set/gatekit',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: 'new-test-key',
          },
        }),
      );
    });

    it('should cleanup connection on platform deactivated event', async () => {
      const connectionKey = 'project1:platform1';
      const event = {
        type: 'deactivated' as const,
        projectId: 'project1',
        platformId: 'platform1',
        platform: 'whatsapp-evo',
        credentials: {},
      };

      // First create a connection
      await provider.createAdapter(connectionKey, mockCredentials);
      expect(provider.getAdapter(connectionKey)).toBeDefined();

      // Then deactivate
      await provider.onPlatformEvent(event);

      // Connection should be removed
      expect(provider.getAdapter(connectionKey)).toBeUndefined();
    });

    it('should cleanup connection on platform deleted event', async () => {
      const connectionKey = 'project1:platform1';
      const event = {
        type: 'deleted' as const,
        projectId: 'project1',
        platformId: 'platform1',
        platform: 'whatsapp-evo',
        credentials: {},
      };

      // First create a connection
      await provider.createAdapter(connectionKey, mockCredentials);
      expect(provider.getAdapter(connectionKey)).toBeDefined();

      // Then delete
      await provider.onPlatformEvent(event);

      // Connection should be removed
      expect(provider.getAdapter(connectionKey)).toBeUndefined();
    });

    it('should handle webhook setup failure gracefully', async () => {
      // Mock webhook setup failure
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        text: jest.fn().mockResolvedValue('Webhook setup failed'),
      });

      const event = {
        type: 'created' as const,
        projectId: 'project1',
        platformId: 'platform1',
        platform: 'whatsapp-evo',
        credentials: {
          evolutionApiUrl: 'https://evo.example.com',
          evolutionApiKey: 'test-key',
        },
        webhookToken: 'webhook-token-123',
      };

      // Should not throw error even if webhook setup fails
      await expect(provider.onPlatformEvent(event)).resolves.not.toThrow();
    });

    it('should skip webhook setup when no webhook token provided', async () => {
      const event = {
        type: 'created' as const,
        projectId: 'project1',
        platformId: 'platform1',
        platform: 'whatsapp-evo',
        credentials: {
          evolutionApiUrl: 'https://evo.example.com',
          evolutionApiKey: 'test-key',
        },
        // No webhookToken
      };

      await provider.onPlatformEvent(event);

      // Should not attempt webhook setup
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle network errors during webhook setup', async () => {
      // Mock network error
      (global.fetch as jest.Mock).mockRejectedValue(
        new Error('Network timeout'),
      );

      const event = {
        type: 'created' as const,
        projectId: 'project1',
        platformId: 'platform1',
        platform: 'whatsapp-evo',
        credentials: {
          evolutionApiUrl: 'https://evo.example.com',
          evolutionApiKey: 'test-key',
        },
        webhookToken: 'webhook-token-123',
      };

      // Should handle error gracefully without throwing
      await expect(provider.onPlatformEvent(event)).resolves.not.toThrow();
    });
  });

  describe('Attachment Sending', () => {
    const projectId = 'project-123';
    const platformId = 'platform-456';
    const chatId = '5511999999999';

    beforeEach(async () => {
      // Mock successful connection
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/sendMedia/')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ key: { id: 'msg-123' } }),
          });
        }
        if (url.includes('/sendText/')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ key: { id: 'msg-456' } }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      // Manually create connection for testing
      const mockConnection = {
        connectionKey: `${projectId}:${platformId}`,
        projectId,
        platformId,
        instanceName: 'test-instance',
        evolutionApiUrl: 'https://evo.example.com',
        evolutionApiKey: 'test-key',
        isConnected: true,
      };

      (provider as any).connections.set(
        `${projectId}:${platformId}`,
        mockConnection,
      );
    });

    it('should send image attachment via sendMedia endpoint', async () => {
      const connection = (provider as any).connections.get(
        `${projectId}:${platformId}`,
      );

      const envelope = {
        projectId,
        threadId: chatId,
        provider: { raw: { platformId } },
      } as any;

      await provider.sendMessage(envelope, {
        text: 'Check this image',
        attachments: [
          {
            url: 'https://example.com/image.png',
            mimeType: 'image/png',
          },
        ],
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sendMedia/'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            apikey: 'test-key',
          }),
          body: expect.stringContaining('"mediatype":"image"'),
        }),
      );
    });

    it('should send video attachment', async () => {
      const connection = (provider as any).connections.get(
        `${projectId}:${platformId}`,
      );

      const envelope = {
        projectId,
        threadId: chatId,
        provider: { raw: { platformId } },
      } as any;

      await provider.sendMessage(envelope, {
        attachments: [
          {
            url: 'https://example.com/video.mp4',
            mimeType: 'video/mp4',
            caption: 'Video caption',
          },
        ],
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sendMedia/'),
        expect.objectContaining({
          body: expect.stringContaining('"mediatype":"video"'),
        }),
      );
    });

    it('should send audio attachment', async () => {
      const connection = (provider as any).connections.get(
        `${projectId}:${platformId}`,
      );

      const envelope = {
        projectId,
        threadId: chatId,
        provider: { raw: { platformId } },
      } as any;

      await provider.sendMessage(envelope, {
        attachments: [
          {
            url: 'https://example.com/audio.mp3',
            mimeType: 'audio/mpeg',
          },
        ],
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sendMedia/'),
        expect.objectContaining({
          body: expect.stringContaining('"mediatype":"audio"'),
        }),
      );
    });

    it('should send document attachment', async () => {
      const connection = (provider as any).connections.get(
        `${projectId}:${platformId}`,
      );

      const envelope = {
        projectId,
        threadId: chatId,
        provider: { raw: { platformId } },
      } as any;

      await provider.sendMessage(envelope, {
        attachments: [
          {
            url: 'https://example.com/document.pdf',
            mimeType: 'application/pdf',
          },
        ],
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sendMedia/'),
        expect.objectContaining({
          body: expect.stringContaining('"mediatype":"document"'),
        }),
      );
    });

    it('should send base64 attachment with raw base64 string', async () => {
      const connection = (provider as any).connections.get(
        `${projectId}:${platformId}`,
      );

      const envelope = {
        projectId,
        threadId: chatId,
        provider: { raw: { platformId } },
      } as any;

      const base64Data = Buffer.from('test file content').toString('base64');

      await provider.sendMessage(envelope, {
        attachments: [
          {
            data: base64Data,
            filename: 'test.txt',
            mimeType: 'text/plain',
          },
        ],
      });

      // Evolution API expects raw base64 string (not data URI)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sendMedia/'),
        expect.objectContaining({
          body: expect.stringContaining(base64Data),
        }),
      );
    });

    it('should send multiple attachments individually', async () => {
      const connection = (provider as any).connections.get(
        `${projectId}:${platformId}`,
      );

      const envelope = {
        projectId,
        threadId: chatId,
        provider: { raw: { platformId } },
      } as any;

      await provider.sendMessage(envelope, {
        text: 'Multiple files',
        attachments: [
          { url: 'https://example.com/file1.png', mimeType: 'image/png' },
          { url: 'https://example.com/file2.pdf', mimeType: 'application/pdf' },
        ],
      });

      // Should call sendMedia twice (once per attachment)
      const sendMediaCalls = (global.fetch as jest.Mock).mock.calls.filter(
        (call) => call[0].includes('/sendMedia/'),
      );
      expect(sendMediaCalls.length).toBe(2);
    });

    it('should include caption in attachment', async () => {
      const connection = (provider as any).connections.get(
        `${projectId}:${platformId}`,
      );

      const envelope = {
        projectId,
        threadId: chatId,
        provider: { raw: { platformId } },
      } as any;

      await provider.sendMessage(envelope, {
        text: 'Main text',
        attachments: [
          {
            url: 'https://example.com/image.png',
            mimeType: 'image/png',
            caption: 'Image caption',
          },
        ],
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"caption":"Image caption"'),
        }),
      );
    });

    it('should auto-detect MIME type from filename', async () => {
      const connection = (provider as any).connections.get(
        `${projectId}:${platformId}`,
      );

      const envelope = {
        projectId,
        threadId: chatId,
        provider: { raw: { platformId } },
      } as any;

      await provider.sendMessage(envelope, {
        attachments: [
          {
            url: 'https://example.com/photo.jpg',
          },
        ],
      });

      // Should detect image type and send as image
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sendMedia/'),
        expect.objectContaining({
          body: expect.stringContaining('"mediatype":"image"'),
        }),
      );
    });

    it('should handle Evolution API errors', async () => {
      const connection = (provider as any).connections.get(
        `${projectId}:${platformId}`,
      );

      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          statusText: 'Bad Request',
          text: () => Promise.resolve('File too large'),
        }),
      );

      const envelope = {
        projectId,
        threadId: chatId,
        provider: { raw: { platformId } },
      } as any;

      await expect(
        provider.sendMessage(envelope, {
          attachments: [
            {
              url: 'https://example.com/large-file.zip',
              mimeType: 'application/zip',
            },
          ],
        }),
      ).rejects.toThrow();
    });

    it('should include filename in sendMedia payload', async () => {
      const connection = (provider as any).connections.get(
        `${projectId}:${platformId}`,
      );

      const envelope = {
        projectId,
        threadId: chatId,
        provider: { raw: { platformId } },
      } as any;

      await provider.sendMessage(envelope, {
        attachments: [
          {
            url: 'https://example.com/report.pdf',
            filename: 'quarterly-report.pdf',
          },
        ],
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"fileName":"quarterly-report.pdf"'),
        }),
      );
    });
  });
});
