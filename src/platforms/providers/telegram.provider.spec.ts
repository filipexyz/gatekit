import { Test, TestingModule } from '@nestjs/testing';
import TelegramBot = require('node-telegram-bot-api');
import { TelegramProvider } from './telegram.provider';
import { EVENT_BUS } from '../interfaces/event-bus.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformLogsService } from '../services/platform-logs.service';
import { WebhookDeliveryService } from '../../webhooks/services/webhook-delivery.service';
import { MessagesService } from '../messages/messages.service';

describe('TelegramProvider', () => {
  let provider: TelegramProvider;
  let eventBus: any;
  let prisma: any;

  const mockEventBus = {
    publish: jest.fn(),
  };

  const mockPrisma = {
    projectPlatform: {
      findUnique: jest.fn(),
    },
  };

  const mockPlatformLogsService = {
    logActivity: jest.fn().mockResolvedValue(undefined),
  };

  const mockWebhookDeliveryService = {
    deliverEvent: jest.fn(),
  };

  const mockMessagesService = {
    storeIncomingMessage: jest.fn().mockResolvedValue(undefined),
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
      ],
    }).compile();

    provider = module.get<TelegramProvider>(TelegramProvider);
    eventBus = module.get(EVENT_BUS);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  afterEach(async () => {
    await provider.shutdown();
  });

  describe('Project Isolation', () => {
    it('should create envelopes with correct projectId for different projects', async () => {
      const project1 = 'project-1';
      const project2 = 'project-2';

      const mockMessage1 = {
        message_id: 1,
        from: { id: 123, username: 'user1', is_bot: false },
        chat: { id: 456 },
        text: 'Hello from project 1',
      } as TelegramBot.Message;

      const mockMessage2 = {
        message_id: 2,
        from: { id: 789, username: 'user2', is_bot: false },
        chat: { id: 12 },
        text: 'Hello from project 2',
      } as TelegramBot.Message;

      // Create envelopes for different projects
      const envelope1 = provider.toEnvelope(mockMessage1, project1);
      const envelope2 = provider.toEnvelope(mockMessage2, project2);

      // Verify correct project isolation
      expect(envelope1.projectId).toBe(project1);
      expect(envelope2.projectId).toBe(project2);

      // Verify no cross-contamination
      expect(envelope1.threadId).toBe('456');
      expect(envelope2.threadId).toBe('12');
      expect(envelope1.user.providerUserId).toBe('123');
      expect(envelope2.user.providerUserId).toBe('789');
    });

    it('should handle callback queries with correct projectId', async () => {
      const projectId = 'test-project';

      const mockCallbackQuery = {
        id: 'callback1',
        from: { id: 123, username: 'user1' },
        message: { chat: { id: 456 } },
        data: 'button_clicked',
      } as TelegramBot.CallbackQuery;

      const envelope = provider.toEnvelope(mockCallbackQuery, projectId);

      expect(envelope.projectId).toBe(projectId);
      expect(envelope.message.text).toBe('button_clicked');
      expect(envelope.action?.type).toBe('button');
      expect(envelope.action?.value).toBe('button_clicked');
    });
  });

  describe('Webhook Processing', () => {
    it('should process webhook updates for specific project', async () => {
      const projectId = 'test-project';

      const mockUpdate = {
        message: {
          message_id: 1,
          from: { id: 123, username: 'user1', is_bot: false },
          chat: { id: 456 },
          text: 'Test message',
        },
      } as TelegramBot.Update;

      // Set up connection
      const mockBot = {
        sendMessage: jest.fn(),
      } as any;

      (provider as any).connections.set(projectId, {
        projectId,
        bot: mockBot,
        isActive: true,
      });

      // Process webhook
      const result = await provider.processWebhookUpdate(projectId, mockUpdate);

      expect(result).toBe(true);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId,
          channel: 'telegram',
          message: { text: 'Test message' },
        }),
      );
    });

    it('should return false for unknown project', async () => {
      const unknownProjectId = 'unknown-project';

      const mockUpdate = {
        message: {
          message_id: 1,
          from: { id: 123, username: 'user1', is_bot: false },
          chat: { id: 456 },
          text: 'Test message',
        },
      } as TelegramBot.Update;

      const result = await provider.processWebhookUpdate(
        unknownProjectId,
        mockUpdate,
      );

      expect(result).toBe(false);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('Connection Management', () => {
    it('should handle sendMessage with active connection', async () => {
      const projectId = 'test-project';

      const mockBot = {
        sendMessage: jest.fn().mockResolvedValue({ message_id: 123 }),
      } as any;

      const platformId = 'platform-123';
      const connectionKey = `${projectId}:${platformId}`;

      // Set up active connection with composite key
      (provider as any).connections.set(connectionKey, {
        connectionKey,
        projectId,
        platformId,
        bot: mockBot,
        isActive: true,
      });

      const envelope = {
        projectId,
        threadId: '456',
        channel: 'telegram',
        user: { providerUserId: 'user1', display: 'User1' },
        message: { text: 'test' },
        provider: { eventId: 'event1', raw: { platformId } },
      } as any;

      const result = await provider.sendMessage(envelope, { text: 'Hello!' });

      expect(result.providerMessageId).toBe('123');
      expect(mockBot.sendMessage).toHaveBeenCalledWith('456', 'Hello!', {
        parse_mode: 'HTML',
      });
    });

    it('should handle sendMessage with inactive connection', async () => {
      const projectId = 'test-project';
      const platformId = 'platform-456';
      const connectionKey = `${projectId}:${platformId}`;

      // Set up inactive connection
      (provider as any).connections.set(connectionKey, {
        connectionKey,
        projectId,
        platformId,
        bot: null,
        isActive: false,
      });

      const envelope = {
        projectId,
        threadId: '456',
        provider: { raw: { platformId } },
      } as any;

      await expect(
        provider.sendMessage(envelope, { text: 'Hello!' }),
      ).rejects.toThrow('Telegram bot not ready');
    });
  });

  describe('Platform Provider Interface', () => {
    it('should have correct metadata', () => {
      expect(provider.name).toBe('telegram');
      expect(provider.displayName).toBe('Telegram');
      expect(provider.connectionType).toBe('webhook');
      expect(provider.channel).toBe('telegram');
    });

    it('should provide webhook configuration', () => {
      const config = provider.getWebhookConfig();

      expect(config).toHaveProperty('path');
      expect(config).toHaveProperty('handler');
      expect(config.path).toBe('telegram/:webhookToken');
      expect(typeof config.handler).toBe('function');
    });
  });

  describe('Attachment Sending', () => {
    const projectId = 'project-123';
    const platformId = 'platform-456';
    const chatId = '123456789';

    let mockBot: any;

    beforeEach(async () => {
      mockBot = {
        sendMessage: jest.fn().mockResolvedValue({ message_id: 1 }),
        sendPhoto: jest.fn().mockResolvedValue({ message_id: 2 }),
        sendVideo: jest.fn().mockResolvedValue({ message_id: 3 }),
        sendAudio: jest.fn().mockResolvedValue({ message_id: 4 }),
        sendDocument: jest.fn().mockResolvedValue({ message_id: 5 }),
        sendMediaGroup: jest.fn().mockResolvedValue([{ message_id: 6 }]),
      };

      // Manually create connection for testing
      const mockConnection = {
        connectionKey: `${projectId}:${platformId}`,
        projectId,
        platformId,
        bot: mockBot,
        isActive: true,
      };

      (provider as any).connections.set(
        `${projectId}:${platformId}`,
        mockConnection,
      );
    });

    it('should send image attachment using sendPhoto', async () => {
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

      expect(mockBot.sendPhoto).toHaveBeenCalledWith(
        chatId,
        'https://example.com/image.png',
        expect.objectContaining({
          caption: 'Check this image',
          parse_mode: 'HTML',
        }),
      );
    });

    it('should send video attachment using sendVideo', async () => {
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

      expect(mockBot.sendVideo).toHaveBeenCalledWith(
        chatId,
        'https://example.com/video.mp4',
        expect.objectContaining({
          caption: 'Video caption',
          parse_mode: 'HTML',
        }),
      );
    });

    it('should send audio attachment using sendAudio', async () => {
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

      expect(mockBot.sendAudio).toHaveBeenCalled();
    });

    it('should send document attachment using sendDocument', async () => {
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

      expect(mockBot.sendDocument).toHaveBeenCalledWith(
        chatId,
        'https://example.com/document.pdf',
        expect.any(Object),
      );
    });

    it('should send base64 image using Buffer', async () => {
      const envelope = {
        projectId,
        threadId: chatId,
        provider: { raw: { platformId } },
      } as any;

      const base64Data = Buffer.from('fake image data').toString('base64');

      await provider.sendMessage(envelope, {
        attachments: [
          {
            data: base64Data,
            filename: 'image.png',
            mimeType: 'image/png',
          },
        ],
      });

      expect(mockBot.sendPhoto).toHaveBeenCalledWith(
        chatId,
        expect.any(Buffer),
        expect.any(Object),
      );
    });

    it('should send media group for multiple images', async () => {
      const envelope = {
        projectId,
        threadId: chatId,
        provider: { raw: { platformId } },
      } as any;

      await provider.sendMessage(envelope, {
        text: 'Multiple images',
        attachments: [
          { url: 'https://example.com/image1.png', mimeType: 'image/png' },
          { url: 'https://example.com/image2.jpg', mimeType: 'image/jpeg' },
        ],
      });

      expect(mockBot.sendMediaGroup).toHaveBeenCalledWith(
        chatId,
        expect.arrayContaining([
          expect.objectContaining({
            type: 'photo',
            media: 'https://example.com/image1.png',
          }),
          expect.objectContaining({
            type: 'photo',
            media: 'https://example.com/image2.jpg',
          }),
        ]),
      );
    });

    it('should use per-attachment caption', async () => {
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

      expect(mockBot.sendPhoto).toHaveBeenCalledWith(
        chatId,
        expect.any(String),
        expect.objectContaining({
          caption: 'Image caption',
        }),
      );
    });

    it('should auto-detect MIME type from filename', async () => {
      const envelope = {
        projectId,
        threadId: chatId,
        provider: { raw: { platformId } },
      } as any;

      await provider.sendMessage(envelope, {
        attachments: [
          {
            url: 'https://example.com/file.jpg',
          },
        ],
      });

      // Should detect image/jpeg and use sendPhoto
      expect(mockBot.sendPhoto).toHaveBeenCalled();
    });

    it('should handle mixed media types individually', async () => {
      const envelope = {
        projectId,
        threadId: chatId,
        provider: { raw: { platformId } },
      } as any;

      await provider.sendMessage(envelope, {
        attachments: [
          { url: 'https://example.com/image.png', mimeType: 'image/png' },
          { url: 'https://example.com/video.mp4', mimeType: 'video/mp4' },
        ],
      });

      // Mixed types should be sent via media group if images/videos, or individually
      expect(mockBot.sendMediaGroup).toHaveBeenCalled();
    });

    it('should fall back to sendDocument for unknown types', async () => {
      const envelope = {
        projectId,
        threadId: chatId,
        provider: { raw: { platformId } },
      } as any;

      await provider.sendMessage(envelope, {
        attachments: [
          {
            url: 'https://example.com/file.unknown',
            mimeType: 'application/octet-stream',
          },
        ],
      });

      expect(mockBot.sendDocument).toHaveBeenCalled();
    });

    it('should handle attachment sending errors gracefully', async () => {
      const envelope = {
        projectId,
        threadId: chatId,
        provider: { raw: { platformId } },
      } as any;

      mockBot.sendPhoto.mockRejectedValue(new Error('File too large'));

      await expect(
        provider.sendMessage(envelope, {
          attachments: [
            {
              url: 'https://example.com/large-image.png',
              mimeType: 'image/png',
            },
          ],
        }),
      ).rejects.toThrow('File too large');
    });
  });

  describe('Button Support', () => {
    const projectId = 'project-123';
    const platformId = 'platform-456';
    const chatId = '987654321';
    const connectionKey = `${projectId}:${platformId}`;

    let mockBot: any;

    beforeEach(() => {
      // Mock Telegram bot
      mockBot = {
        sendMessage: jest.fn().mockResolvedValue({
          message_id: 123,
          chat: { id: chatId },
        }),
        sendPhoto: jest.fn().mockResolvedValue({
          message_id: 124,
          chat: { id: chatId },
        }),
        setWebHook: jest.fn().mockResolvedValue(true),
        getWebHookInfo: jest.fn().mockResolvedValue({
          url: 'https://example.com/webhook',
          pending_update_count: 0,
        }),
      };

      // Create mock connection
      const mockConnection = {
        connectionKey,
        projectId,
        platformId,
        bot: mockBot,
        isActive: true,
      };
      provider['connections'].set(connectionKey, mockConnection as any);
    });

    it('should transform buttons with values to Telegram inline keyboard', async () => {
      const envelope = {
        projectId,
        threadId: chatId,
        provider: { raw: { platformId } },
      } as any;

      await provider.sendMessage(envelope, {
        text: 'Choose an action',
        buttons: [
          { text: 'Confirm', value: 'confirm', style: 'success' },
          { text: 'Cancel', value: 'cancel', style: 'danger' },
        ],
      });

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        chatId,
        'Choose an action',
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  text: 'Confirm',
                  callback_data: 'confirm',
                }),
                expect.objectContaining({
                  text: 'Cancel',
                  callback_data: 'cancel',
                }),
              ]),
            ]),
          }),
        }),
      );
    });

    it('should transform buttons with URLs to Telegram URL buttons', async () => {
      const envelope = {
        projectId,
        threadId: chatId,
        provider: { raw: { platformId } },
      } as any;

      await provider.sendMessage(envelope, {
        text: 'Visit our website',
        buttons: [
          {
            text: 'Visit GateKit',
            url: 'https://gatekit.dev',
            style: 'link',
          },
        ],
      });

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        chatId,
        'Visit our website',
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  text: 'Visit GateKit',
                  url: 'https://gatekit.dev',
                }),
              ]),
            ]),
          }),
        }),
      );
    });

    it('should arrange buttons in rows (2 per row)', async () => {
      const envelope = {
        projectId,
        threadId: chatId,
        provider: { raw: { platformId } },
      } as any;

      await provider.sendMessage(envelope, {
        buttons: [
          { text: 'Button 1', value: 'btn1' },
          { text: 'Button 2', value: 'btn2' },
          { text: 'Button 3', value: 'btn3' },
          { text: 'Button 4', value: 'btn4' },
          { text: 'Button 5', value: 'btn5' },
        ],
      });

      const call = mockBot.sendMessage.mock.calls[0][2];
      const keyboard = call.reply_markup.inline_keyboard;

      // Should have 3 rows: [2 buttons], [2 buttons], [1 button]
      expect(keyboard.length).toBe(3);
      expect(keyboard[0].length).toBe(2);
      expect(keyboard[1].length).toBe(2);
      expect(keyboard[2].length).toBe(1);
    });

    it('should handle many buttons (up to ~100)', async () => {
      const envelope = {
        projectId,
        threadId: chatId,
        provider: { raw: { platformId } },
      } as any;

      const buttons = Array.from({ length: 20 }, (_, i) => ({
        text: `Button ${i + 1}`,
        value: `button_${i + 1}`,
      }));

      await provider.sendMessage(envelope, {
        text: 'Many buttons',
        buttons,
      });

      const call = mockBot.sendMessage.mock.calls[0][2];
      const keyboard = call.reply_markup.inline_keyboard;

      // Count total buttons
      let totalButtons = 0;
      for (const row of keyboard) {
        totalButtons += row.length;
        expect(row.length).toBeLessThanOrEqual(2); // Max 2 per row in implementation
      }
      expect(totalButtons).toBe(20);
    });

    it('should validate callback_data length (64 bytes max)', async () => {
      const envelope = {
        projectId,
        threadId: chatId,
        provider: { raw: { platformId } },
      } as any;

      const longValue = 'a'.repeat(100);

      await provider.sendMessage(envelope, {
        buttons: [{ text: 'Button', value: longValue }],
      });

      const call = mockBot.sendMessage.mock.calls[0][2];
      const button = call.reply_markup.inline_keyboard[0][0];

      // Should be truncated to 64 bytes
      expect(Buffer.from(button.callback_data).length).toBeLessThanOrEqual(64);
    });

    it('should handle button-only message', async () => {
      const envelope = {
        projectId,
        threadId: chatId,
        provider: { raw: { platformId } },
      } as any;

      await provider.sendMessage(envelope, {
        buttons: [
          { text: 'Option A', value: 'option_a' },
          { text: 'Option B', value: 'option_b' },
        ],
      });

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.any(String),
        expect.objectContaining({
          reply_markup: expect.any(Object),
        }),
      );
    });

    it('should handle empty buttons array', async () => {
      const envelope = {
        projectId,
        threadId: chatId,
        provider: { raw: { platformId } },
      } as any;

      await provider.sendMessage(envelope, {
        text: 'No buttons',
        buttons: [],
      });

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        chatId,
        'No buttons',
        expect.not.objectContaining({
          reply_markup: expect.anything(),
        }),
      );
    });

    it('should mix value and URL buttons in same message', async () => {
      const envelope = {
        projectId,
        threadId: chatId,
        provider: { raw: { platformId } },
      } as any;

      await provider.sendMessage(envelope, {
        buttons: [
          { text: 'Confirm', value: 'confirm', style: 'success' },
          { text: 'Cancel', value: 'cancel', style: 'danger' },
          { text: 'Help', url: 'https://help.example.com', style: 'link' },
        ],
      });

      const call = mockBot.sendMessage.mock.calls[0][2];
      const keyboard = call.reply_markup.inline_keyboard;

      // Find buttons
      const confirmBtn = keyboard.flat().find((b: any) => b.text === 'Confirm');
      const cancelBtn = keyboard.flat().find((b: any) => b.text === 'Cancel');
      const helpBtn = keyboard.flat().find((b: any) => b.text === 'Help');

      expect(confirmBtn.callback_data).toBe('confirm');
      expect(cancelBtn.callback_data).toBe('cancel');
      expect(helpBtn.url).toBe('https://help.example.com');
    });

    it('should handle buttons with attachments', async () => {
      const envelope = {
        projectId,
        threadId: chatId,
        provider: { raw: { platformId } },
      } as any;

      await provider.sendMessage(envelope, {
        text: 'Check this out',
        attachments: [
          {
            url: 'https://example.com/image.jpg',
            mimeType: 'image/jpeg',
          },
        ],
        buttons: [{ text: 'Download', value: 'download' }],
      });

      // Telegram sends image and buttons (either in photo or separate message)
      expect(mockBot.sendPhoto).toHaveBeenCalled();
    });
  });
});
