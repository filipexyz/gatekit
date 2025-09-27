import { Test, TestingModule } from '@nestjs/testing';
import * as TelegramBot from 'node-telegram-bot-api';
import { TelegramProvider } from './telegram.provider';
import { EVENT_BUS } from '../interfaces/event-bus.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformLogsService } from '../services/platform-logs.service';

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

      const result = await provider.sendMessage(envelope, { text: 'Hello!' });

      expect(result.providerMessageId).toBe('telegram-not-ready');
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
});
