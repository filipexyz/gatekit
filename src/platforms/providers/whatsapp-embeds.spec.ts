import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WhatsAppProvider } from './whatsapp.provider';
import { EVENT_BUS } from '../interfaces/event-bus.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformLogsService } from '../services/platform-logs.service';
import { WebhookDeliveryService } from '../../webhooks/services/webhook-delivery.service';
import { MessagesService } from '../messages/messages.service';
import { TranscriptionService } from '../../voice/services/transcription.service';

describe('WhatsAppProvider - Embed Transformation', () => {
  let provider: WhatsAppProvider;
  let fetchMock: jest.Mock;

  const mockEventBus = {
    publish: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockPrismaService = {
    projectPlatform: {
      findUnique: jest.fn(),
    },
    receivedMessage: {
      create: jest.fn(),
    },
  };

  const mockPlatformLogsService = {
    logMessage: jest.fn(),
    logError: jest.fn(),
    logWarning: jest.fn(),
    logActivity: jest.fn().mockResolvedValue(undefined),
  };

  const mockWebhookDeliveryService = {
    deliverWebhook: jest.fn(),
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppProvider,
        {
          provide: EVENT_BUS,
          useValue: mockEventBus,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
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

    // Mock fetch
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        key: { id: 'message-id-123' },
      }),
    });
    global.fetch = fetchMock as any;

    // Inject mock connection
    const mockConnection = {
      connectionKey: 'project-123:platform-456',
      projectId: 'project-123',
      platformId: 'platform-456',
      instanceName: 'test-instance',
      apiUrl: 'https://evo-api.example.com',
      apiKey: 'test-api-key',
      isConnected: true,
    };

    (provider as any).connections.set(
      'project-123:platform-456',
      mockConnection,
    );

    jest.clearAllMocks();
  });

  afterEach(async () => {
    await provider.shutdown();
  });

  describe('Markdown Formatting', () => {
    it('should transform embed to Markdown with all fields', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: '5511999999999@s.whatsapp.net',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      await provider.sendMessage(envelope, {
        embeds: [
          {
            author: {
              name: 'Test Author',
              url: 'https://example.com/author',
            },
            title: 'Test Title',
            url: 'https://example.com',
            description: 'Test description',
            fields: [
              { name: 'Field 1', value: 'Value 1', inline: true },
              { name: 'Field 2', value: 'Value 2', inline: true },
            ],
            footer: {
              text: 'Footer text',
            },
            timestamp: '2025-09-30T20:00:00.000Z',
          },
        ],
      });

      expect(fetchMock).toHaveBeenCalled();
      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);

      // Check Markdown formatting
      expect(callBody.text).toContain('📬');
      expect(callBody.text).toContain('*');
      expect(callBody.text).toContain('🔗');
      expect(callBody.text).toContain('━━━━━━━━━━━━━━━━━');
      expect(callBody.text).toContain('⏰');
      expect(callBody.text).toContain('💡');
    });

    it('should escape Markdown special characters', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: '5511999999999@s.whatsapp.net',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      await provider.sendMessage(envelope, {
        embeds: [
          {
            title: '*Bold* _Italic_ `Code` ~Strike~',
            description: 'Test with special chars: * _ ` ~ \\',
          },
        ],
      });

      expect(fetchMock).toHaveBeenCalled();
      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);

      // Should escape Markdown
      expect(callBody.text).toContain('\\*');
      expect(callBody.text).toContain('\\_');
      expect(callBody.text).toContain('\\`');
      expect(callBody.text).toContain('\\~');
      expect(callBody.text).toContain('\\\\');
    });

    it('should group inline fields (max 2 per line)', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: '5511999999999@s.whatsapp.net',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      await provider.sendMessage(envelope, {
        embeds: [
          {
            title: 'Inline fields test',
            fields: [
              { name: 'F1', value: 'V1', inline: true },
              { name: 'F2', value: 'V2', inline: true },
              { name: 'F3', value: 'V3', inline: true },
              { name: 'F4', value: 'V4', inline: false },
            ],
          },
        ],
      });

      expect(fetchMock).toHaveBeenCalled();
      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);

      // Should have bullet separator for inline fields
      expect(callBody.text).toContain('•');
    });
  });

  describe('SSRF Protection', () => {
    it('should reject unsafe author URL', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: '5511999999999@s.whatsapp.net',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      await provider.sendMessage(envelope, {
        embeds: [
          {
            author: {
              name: 'Test',
              url: 'http://169.254.169.254/metadata',
            },
            title: 'Test',
          },
        ],
      });

      expect(fetchMock).toHaveBeenCalled();
      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);

      // Should not contain the unsafe URL
      expect(callBody.text).not.toContain('169.254.169.254');
      // But should still contain the author name
      expect(callBody.text).toContain('Test');
    });

    it('should reject unsafe embed URL', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: '5511999999999@s.whatsapp.net',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      await provider.sendMessage(envelope, {
        embeds: [
          {
            title: 'Test',
            url: 'http://localhost:8080/admin',
          },
        ],
      });

      expect(fetchMock).toHaveBeenCalled();
      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);

      // Should not contain the unsafe URL
      expect(callBody.text).not.toContain('localhost:8080');
    });

    it('should accept safe HTTPS URLs', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: '5511999999999@s.whatsapp.net',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      await provider.sendMessage(envelope, {
        embeds: [
          {
            author: {
              name: 'Test',
              url: 'https://example.com/author',
            },
            title: 'Test',
            url: 'https://example.com/page',
          },
        ],
      });

      expect(fetchMock).toHaveBeenCalled();
      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);

      // Should contain safe URLs
      expect(callBody.text).toContain('https://example.com');
    });
  });

  describe('Image Handling', () => {
    it('should send first embed image as media', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: '5511999999999@s.whatsapp.net',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      await provider.sendMessage(envelope, {
        embeds: [
          {
            title: 'Test',
            imageUrl: 'https://example.com/image.png',
          },
        ],
      });

      expect(fetchMock).toHaveBeenCalled();
      const url = fetchMock.mock.calls[0][0];

      // Should call media endpoint
      expect(url).toContain('/message/sendMedia');
    });

    it('should use thumbnailUrl if imageUrl not present', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: '5511999999999@s.whatsapp.net',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      await provider.sendMessage(envelope, {
        embeds: [
          {
            title: 'Test',
            thumbnailUrl: 'https://example.com/thumb.png',
          },
        ],
      });

      expect(fetchMock).toHaveBeenCalled();
      const url = fetchMock.mock.calls[0][0];
      expect(url).toContain('/message/sendMedia');
    });

    it('should send text only if no images', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: '5511999999999@s.whatsapp.net',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      await provider.sendMessage(envelope, {
        embeds: [
          {
            title: 'Test',
            description: 'No images',
          },
        ],
      });

      expect(fetchMock).toHaveBeenCalled();
      const url = fetchMock.mock.calls[0][0];

      // Should call text endpoint
      expect(url).toContain('/message/sendText');
    });

    it('should only send first embed image (platform limitation)', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: '5511999999999@s.whatsapp.net',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      await provider.sendMessage(envelope, {
        embeds: [
          {
            title: 'Embed 1',
            imageUrl: 'https://example.com/image1.png',
          },
          {
            title: 'Embed 2',
            imageUrl: 'https://example.com/image2.png',
          },
        ],
      });

      // Should call media endpoint only once
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const url = fetchMock.mock.calls[0][0];
      expect(url).toContain('/message/sendMedia');
    });
  });

  describe('Multiple Embeds', () => {
    it('should merge multiple embeds with separators', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: '5511999999999@s.whatsapp.net',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      await provider.sendMessage(envelope, {
        embeds: [
          {
            title: 'Embed 1',
            description: 'First embed',
          },
          {
            title: 'Embed 2',
            description: 'Second embed',
          },
        ],
      });

      expect(fetchMock).toHaveBeenCalled();
      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);

      // Should contain both embeds with separator
      expect(callBody.text).toContain('Embed 1');
      expect(callBody.text).toContain('Embed 2');
      expect(callBody.text).toContain('---');
    });

    it('should merge embeds with existing text', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: '5511999999999@s.whatsapp.net',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      await provider.sendMessage(envelope, {
        text: 'Original message',
        embeds: [
          {
            title: 'Embed title',
          },
        ],
      });

      expect(fetchMock).toHaveBeenCalled();
      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);

      expect(callBody.text).toContain('Original message');
      expect(callBody.text).toContain('Embed title');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty embed gracefully', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: '5511999999999@s.whatsapp.net',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      await provider.sendMessage(envelope, {
        text: 'Text only',
        embeds: [{}],
      });

      expect(fetchMock).toHaveBeenCalled();
    });

    it('should handle invalid timestamp gracefully', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: '5511999999999@s.whatsapp.net',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      await provider.sendMessage(envelope, {
        embeds: [
          {
            title: 'Test',
            timestamp: 'invalid-date',
          },
        ],
      });

      expect(fetchMock).toHaveBeenCalled();
    });

    it('should handle embeds with attachments', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: '5511999999999@s.whatsapp.net',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      await provider.sendMessage(envelope, {
        attachments: [
          {
            url: 'https://example.com/file.pdf',
          },
        ],
        embeds: [
          {
            title: 'Document attached',
          },
        ],
      });

      // Should handle both attachments and embeds
      expect(fetchMock).toHaveBeenCalled();
    });

    it('should preserve markdown in field values that are not special chars', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: '5511999999999@s.whatsapp.net',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      await provider.sendMessage(envelope, {
        embeds: [
          {
            title: 'Test',
            fields: [
              {
                name: 'Normal text',
                value: 'No special chars here',
                inline: false,
              },
            ],
          },
        ],
      });

      expect(fetchMock).toHaveBeenCalled();
      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);

      expect(callBody.text).toContain('Normal text');
      expect(callBody.text).toContain('No special chars here');
    });
  });
});
