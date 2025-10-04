import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TelegramProvider } from './telegram.provider';
import { EVENT_BUS } from '../interfaces/event-bus.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformLogsService } from '../services/platform-logs.service';
import { WebhookDeliveryService } from '../../webhooks/services/webhook-delivery.service';
import { MessagesService } from '../messages/messages.service';
import { TranscriptionService } from '../../voice/services/transcription.service';

describe('TelegramProvider - Embed Transformation', () => {
  let provider: TelegramProvider;
  let mockBot: any;

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
        TelegramProvider,
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

    provider = module.get<TelegramProvider>(TelegramProvider);

    // Mock Telegram bot
    mockBot = {
      sendMessage: jest.fn().mockResolvedValue({ message_id: 123 }),
      sendPhoto: jest.fn().mockResolvedValue({ message_id: 124 }),
      sendMediaGroup: jest.fn().mockResolvedValue([{ message_id: 125 }]),
      sendDocument: jest.fn().mockResolvedValue({ message_id: 126 }),
      sendVideo: jest.fn().mockResolvedValue({ message_id: 127 }),
      sendAudio: jest.fn().mockResolvedValue({ message_id: 128 }),
    };

    // Inject mock connection
    const mockConnection = {
      connectionKey: 'project-123:platform-456',
      projectId: 'project-123',
      platformId: 'platform-456',
      bot: mockBot,
      isConnected: true,
      isActive: true,
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

  describe('HTML Formatting', () => {
    it('should transform embed to HTML with all fields', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: '123456789',
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

      expect(mockBot.sendMessage).toHaveBeenCalled();
      const [chatId, text, options] = mockBot.sendMessage.mock.calls[0];

      // Check HTML formatting
      expect(text).toContain('📬');
      expect(text).toContain('<a href=');
      expect(text).toContain('<b>');
      expect(text).toContain('━━━━━━━━━━━━━━━━━');
      expect(text).toContain('⏰');
      expect(text).toContain('💡');
      expect(options.parse_mode).toBe('HTML');
    });

    it('should escape HTML special characters', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: '123456789',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      await provider.sendMessage(envelope, {
        embeds: [
          {
            title: '<script>alert("xss")</script>',
            description: 'Test & "quotes" < > symbols',
          },
        ],
      });

      expect(mockBot.sendMessage).toHaveBeenCalled();
      const [, text] = mockBot.sendMessage.mock.calls[0];

      // Should escape HTML
      expect(text).not.toContain('<script>');
      expect(text).toContain('&lt;');
      expect(text).toContain('&gt;');
      expect(text).toContain('&amp;');
      expect(text).toContain('&quot;');
    });

    it('should group inline fields (max 2 per line)', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: '123456789',
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

      expect(mockBot.sendMessage).toHaveBeenCalled();
      const [, text] = mockBot.sendMessage.mock.calls[0];

      // Should have bullet separator for inline fields
      expect(text).toContain('•');
    });
  });

  describe('SSRF Protection', () => {
    it('should reject unsafe author URL', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: '123456789',
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

      expect(mockBot.sendMessage).toHaveBeenCalled();
      const [, text] = mockBot.sendMessage.mock.calls[0];

      // Should not contain the unsafe URL
      expect(text).not.toContain('169.254.169.254');
      // But should still contain the author name
      expect(text).toContain('Test');
    });

    it('should reject unsafe embed URL', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: '123456789',
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

      expect(mockBot.sendMessage).toHaveBeenCalled();
      const [, text] = mockBot.sendMessage.mock.calls[0];

      // Should not contain the unsafe URL
      expect(text).not.toContain('localhost:8080');
    });

    it('should accept safe HTTPS URLs', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: '123456789',
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

      expect(mockBot.sendMessage).toHaveBeenCalled();
      const [, text] = mockBot.sendMessage.mock.calls[0];

      // Should contain safe URLs
      expect(text).toContain('https://example.com');
    });
  });

  describe('Image Handling', () => {
    it('should send first embed image as photo', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: '123456789',
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

      // Should send photo with caption
      expect(mockBot.sendPhoto).toHaveBeenCalled();
      const [chatId, photo, options] = mockBot.sendPhoto.mock.calls[0];
      expect(photo).toBe('https://example.com/image.png');
      expect(options.caption).toContain('Test');
      expect(options.parse_mode).toBe('HTML');
    });

    it('should use thumbnailUrl if imageUrl not present', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: '123456789',
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

      expect(mockBot.sendPhoto).toHaveBeenCalled();
      const [, photo] = mockBot.sendPhoto.mock.calls[0];
      expect(photo).toBe('https://example.com/thumb.png');
    });

    it('should send text only if no images', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: '123456789',
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

      expect(mockBot.sendMessage).toHaveBeenCalled();
      expect(mockBot.sendPhoto).not.toHaveBeenCalled();
    });

    it('should only send first embed image (platform limitation)', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: '123456789',
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

      // Should only send one photo
      expect(mockBot.sendPhoto).toHaveBeenCalledTimes(1);
      const [, photo] = mockBot.sendPhoto.mock.calls[0];
      expect(photo).toBe('https://example.com/image1.png');
    });
  });

  describe('Multiple Embeds', () => {
    it('should merge multiple embeds with separators', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: '123456789',
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

      expect(mockBot.sendMessage).toHaveBeenCalled();
      const [, text] = mockBot.sendMessage.mock.calls[0];

      // Should contain both embeds with separator
      expect(text).toContain('Embed 1');
      expect(text).toContain('Embed 2');
      expect(text).toContain('---');
    });

    it('should merge embeds with existing text', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: '123456789',
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

      expect(mockBot.sendMessage).toHaveBeenCalled();
      const [, text] = mockBot.sendMessage.mock.calls[0];

      expect(text).toContain('Original message');
      expect(text).toContain('Embed title');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty embed gracefully', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: '123456789',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      await provider.sendMessage(envelope, {
        text: 'Text only',
        embeds: [{}],
      });

      expect(mockBot.sendMessage).toHaveBeenCalled();
    });

    it('should handle invalid timestamp gracefully', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: '123456789',
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

      expect(mockBot.sendMessage).toHaveBeenCalled();
    });

    it('should handle embeds with attachments', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: '123456789',
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

      // Should handle both attachments and embeds by sending document
      expect(mockBot.sendDocument).toHaveBeenCalled();
    });
  });
});
