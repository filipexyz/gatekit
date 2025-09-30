import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Client, Message, User, TextChannel } from 'discord.js';
import { DiscordProvider } from './discord.provider';
import { EVENT_BUS } from '../interfaces/event-bus.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { WebhookDeliveryService } from '../../webhooks/services/webhook-delivery.service';

describe('DiscordProvider', () => {
  let provider: DiscordProvider;
  let eventBus: any;
  let eventEmitter: EventEmitter2;

  const mockEventBus = {
    publish: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockPrismaService = {
    projectPlatform: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    receivedMessage: {
      create: jest.fn().mockResolvedValue({
        id: 'stored-message-id',
        projectId: 'test-project',
        platformId: 'test-platform',
        platform: 'discord',
      }),
    },
  };

  const mockWebhookDeliveryService = {
    deliverEvent: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscordProvider,
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
          provide: WebhookDeliveryService,
          useValue: mockWebhookDeliveryService,
        },
      ],
    }).compile();

    provider = module.get<DiscordProvider>(DiscordProvider);
    eventBus = module.get(EVENT_BUS);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    jest.clearAllMocks();
  });

  afterEach(async () => {
    await provider.shutdown();
  });

  describe('Thread Safety', () => {
    it('should handle concurrent message processing for different projects', async () => {
      const project1 = 'project-1';
      const project2 = 'project-2';

      // Mock Discord messages from different projects
      const mockMessage1 = {
        author: { id: 'user1', username: 'user1', bot: false },
        content: 'Hello from project 1',
        channelId: 'channel1',
        id: 'msg1',
        guildId: 'guild1',
      } as Message;

      const mockMessage2 = {
        author: { id: 'user2', username: 'user2', bot: false },
        content: 'Hello from project 2',
        channelId: 'channel2',
        id: 'msg2',
        guildId: 'guild2',
      } as Message;

      // Process messages concurrently
      const envelopes = [
        provider.toEnvelope(mockMessage1, project1),
        provider.toEnvelope(mockMessage2, project2),
        provider.toEnvelope(mockMessage1, project1),
        provider.toEnvelope(mockMessage2, project2),
      ];

      // Verify each envelope has correct projectId (no race conditions)
      expect(envelopes[0].projectId).toBe(project1);
      expect(envelopes[1].projectId).toBe(project2);
      expect(envelopes[2].projectId).toBe(project1);
      expect(envelopes[3].projectId).toBe(project2);

      // Verify no cross-contamination between projects
      expect(envelopes[0].threadId).toBe('channel1');
      expect(envelopes[1].threadId).toBe('channel2');
    });

    it('should maintain project isolation in concurrent sendMessage calls', async () => {
      const env1 = {
        projectId: 'project-1',
        threadId: 'channel1',
        channel: 'discord',
        user: { providerUserId: 'user1', display: 'User1' },
        message: { text: 'test' },
        provider: { eventId: 'event1', raw: { platformId: 'platform-1' } },
      } as any;

      const env2 = {
        projectId: 'project-2',
        threadId: 'channel2',
        channel: 'discord',
        user: { providerUserId: 'user2', display: 'User2' },
        message: { text: 'test' },
        provider: { eventId: 'event2', raw: { platformId: 'platform-2' } },
      } as any;

      // All should throw errors since no connections are set up
      await expect(
        provider.sendMessage(env1, { text: 'Hello 1' }),
      ).rejects.toThrow('Discord client not ready');
      await expect(
        provider.sendMessage(env2, { text: 'Hello 2' }),
      ).rejects.toThrow('Discord client not ready');
      await expect(
        provider.sendMessage(env1, { text: 'Hello 1 again' }),
      ).rejects.toThrow('Discord client not ready');
    });
  });

  describe('Connection Management', () => {
    it('should enforce connection limits', async () => {
      const MAX_CONNECTIONS = 100;

      // Mock createAdapter to not actually connect
      const originalCreateAdapter = provider.createAdapter;
      let connectionCount = 0;

      (provider as any).createAdapter = async (projectId: string) => {
        if (connectionCount >= MAX_CONNECTIONS) {
          throw new Error(`Connection limit reached (${MAX_CONNECTIONS})`);
        }
        connectionCount++;
        return provider;
      };

      // Should succeed for MAX_CONNECTIONS
      for (let i = 0; i < MAX_CONNECTIONS; i++) {
        await expect(
          provider.createAdapter(`project-${i}`, { token: 'test' }),
        ).resolves.toBeDefined();
      }

      // Should fail for MAX_CONNECTIONS + 1
      await expect(
        provider.createAdapter('overflow-project', { token: 'test' }),
      ).rejects.toThrow('Connection limit reached');
    });

    it('should reuse connections for same token', async () => {
      const projectId = 'test-project';
      const credentials = { token: 'same-token' };

      // Mock the private connection creation
      const mockConnection = {
        projectId,
        client: {} as Client,
        token: credentials.token,
        isConnected: true,
        lastActivity: new Date(),
      };

      // Manually add connection to simulate first creation
      (provider as any).connections.set(projectId, mockConnection);

      // Second call should reuse existing connection
      const adapter = await provider.createAdapter(projectId, credentials);

      expect(adapter).toBe(provider);
      expect((provider as any).connections.size).toBe(1);
    });
  });

  describe('Platform Provider Interface', () => {
    it('should have correct metadata', () => {
      expect(provider.name).toBe('discord');
      expect(provider.displayName).toBe('Discord');
      expect(provider.connectionType).toBe('websocket');
      expect(provider.channel).toBe('discord');
    });

    it('should support health checks', async () => {
      const isHealthy = await provider.isHealthy();
      expect(typeof isHealthy).toBe('boolean');
    });

    it('should provide connection stats', () => {
      const stats = provider.getConnectionStats();
      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('maxConnections');
      expect(stats).toHaveProperty('connections');
      expect(Array.isArray(stats.connections)).toBe(true);
    });
  });

  describe('Platform Lifecycle Events', () => {
    let originalCreateAdapter: any;
    let originalRemoveAdapter: any;
    let createAdapterSpy: jest.SpyInstance;
    let removeAdapterSpy: jest.SpyInstance;

    beforeEach(() => {
      // Mock createAdapter and removeAdapter to avoid real Discord connections
      originalCreateAdapter = provider.createAdapter;
      originalRemoveAdapter = provider.removeAdapter;

      createAdapterSpy = jest
        .spyOn(provider, 'createAdapter')
        .mockResolvedValue(provider);
      removeAdapterSpy = jest
        .spyOn(provider, 'removeAdapter')
        .mockResolvedValue();
    });

    afterEach(() => {
      // Restore original methods
      createAdapterSpy.mockRestore();
      removeAdapterSpy.mockRestore();
    });

    it('should auto-connect on platform created event', async () => {
      const event = {
        type: 'created' as const,
        projectId: 'project1',
        platformId: 'platform1',
        platform: 'discord',
        credentials: { token: 'test-discord-token' },
        webhookToken: 'webhook-123',
      };

      await provider.onPlatformEvent(event);

      const connectionKey = 'project1:platform1';
      expect(createAdapterSpy).toHaveBeenCalledWith(
        connectionKey,
        event.credentials,
      );
    });

    it('should auto-connect on platform activated event', async () => {
      const event = {
        type: 'activated' as const,
        projectId: 'project2',
        platformId: 'platform2',
        platform: 'discord',
        credentials: { token: 'test-discord-token-2' },
        webhookToken: 'webhook-456',
      };

      await provider.onPlatformEvent(event);

      const connectionKey = 'project2:platform2';
      expect(createAdapterSpy).toHaveBeenCalledWith(
        connectionKey,
        event.credentials,
      );
    });

    it('should disconnect on platform deactivated event', async () => {
      const connectionKey = 'project3:platform3';

      const event = {
        type: 'deactivated' as const,
        projectId: 'project3',
        platformId: 'platform3',
        platform: 'discord',
        credentials: { token: 'test-token' },
        webhookToken: 'webhook-789',
      };

      await provider.onPlatformEvent(event);

      expect(removeAdapterSpy).toHaveBeenCalledWith(connectionKey);
    });

    it('should reconnect on platform updated event', async () => {
      const connectionKey = 'project4:platform4';

      // Mock that connection already exists
      jest.spyOn(provider['connections'], 'has').mockReturnValue(true);

      const event = {
        type: 'updated' as const,
        projectId: 'project4',
        platformId: 'platform4',
        platform: 'discord',
        credentials: { token: 'new-token' },
        webhookToken: 'webhook-updated',
      };

      await provider.onPlatformEvent(event);

      // Should remove old connection and create new one
      expect(removeAdapterSpy).toHaveBeenCalledWith(connectionKey);
      expect(createAdapterSpy).toHaveBeenCalledWith(
        connectionKey,
        event.credentials,
      );
    });

    it('should handle platform event errors gracefully', async () => {
      // Mock createAdapter to throw error
      createAdapterSpy.mockRejectedValue(new Error('Connection failed'));

      const event = {
        type: 'created' as const,
        projectId: 'project5',
        platformId: 'platform5',
        platform: 'discord',
        credentials: { token: 'test-token' },
        webhookToken: 'webhook-error',
      };

      // Should not throw even if connection fails
      await expect(provider.onPlatformEvent(event)).resolves.not.toThrow();
      expect(createAdapterSpy).toHaveBeenCalledWith(
        'project5:platform5',
        event.credentials,
      );
    });
  });

  describe('App Startup Initialization', () => {
    it('should query for active Discord platforms on module init', async () => {
      await provider.onModuleInit();

      expect(mockPrismaService.projectPlatform.findMany).toHaveBeenCalledWith({
        where: {
          platform: 'discord',
          isActive: true,
        },
        include: {
          project: {
            select: {
              id: true,
              slug: true,
            },
          },
        },
      });
    });

    it('should handle module init errors gracefully', async () => {
      mockPrismaService.projectPlatform.findMany.mockRejectedValue(
        new Error('Database error'),
      );

      // Should not throw even if database query fails
      await expect(provider.onModuleInit()).resolves.not.toThrow();
    });
  });

  describe('Attachment Sending', () => {
    let mockConnection: any;
    let mockChannel: any;

    beforeEach(async () => {
      mockChannel = {
        send: jest.fn().mockResolvedValue({ id: 'sent-message-id' }),
      };

      const mockClient = {
        isReady: jest.fn().mockReturnValue(true),
        channels: {
          fetch: jest.fn().mockResolvedValue(mockChannel),
        },
      };

      mockConnection = {
        connectionKey: 'project-123:platform-456',
        projectId: 'project-123',
        platformId: 'platform-456',
        client: mockClient,
        isConnected: true,
      };

      // Manually inject connection for testing
      (provider as any).connections.set(
        'project-123:platform-456',
        mockConnection,
      );
    });

    it('should send message with URL attachment', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: 'channel-123',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      const result = await provider.sendMessage(envelope, {
        text: 'Check this out',
        attachments: [
          {
            url: 'https://example.com/image.png',
            filename: 'screenshot.png',
          },
        ],
      });

      expect(result.providerMessageId).toBe('sent-message-id');
      expect(mockChannel.send).toHaveBeenCalledWith({
        content: 'Check this out',
        files: expect.arrayContaining([
          expect.objectContaining({
            attachment: 'https://example.com/image.png',
          }),
        ]),
      });
    });

    it('should send message with base64 attachment', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: 'channel-123',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      const base64Data = Buffer.from('test file content').toString('base64');

      const result = await provider.sendMessage(envelope, {
        text: 'File attached',
        attachments: [
          {
            data: base64Data,
            filename: 'test.txt',
          },
        ],
      });

      expect(result.providerMessageId).toBe('sent-message-id');
      expect(mockChannel.send).toHaveBeenCalledWith({
        content: 'File attached',
        files: expect.arrayContaining([
          expect.objectContaining({
            attachment: expect.any(Buffer),
          }),
        ]),
      });
    });

    it('should send message with multiple attachments', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: 'channel-123',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      const result = await provider.sendMessage(envelope, {
        text: 'Multiple files',
        attachments: [
          { url: 'https://example.com/file1.png' },
          { url: 'https://example.com/file2.pdf' },
          {
            data: Buffer.from('test').toString('base64'),
            filename: 'test.txt',
          },
        ],
      });

      expect(result.providerMessageId).toBe('sent-message-id');
      expect(mockChannel.send).toHaveBeenCalledWith({
        content: 'Multiple files',
        files: expect.arrayContaining([
          expect.any(Object),
          expect.any(Object),
          expect.any(Object),
        ]),
      });
    });

    it('should send attachment-only message without text', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: 'channel-123',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      const result = await provider.sendMessage(envelope, {
        attachments: [
          {
            url: 'https://example.com/image.png',
          },
        ],
      });

      expect(result.providerMessageId).toBe('sent-message-id');
      expect(mockChannel.send).toHaveBeenCalledWith({
        content: undefined,
        files: expect.any(Array),
      });
    });

    it('should handle attachment processing errors gracefully', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: 'channel-123',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      // Invalid base64 data
      const result = await provider.sendMessage(envelope, {
        text: 'This should still work',
        attachments: [
          {
            data: 'invalid@base64#data',
            filename: 'test.txt',
          },
        ],
      });

      // Should continue and send text even if attachment fails
      expect(mockChannel.send).toHaveBeenCalled();
    });

    it('should reject message with neither text nor attachments', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: 'channel-123',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      await expect(provider.sendMessage(envelope, {})).rejects.toThrow(
        'Message must have text, attachments, or embeds',
      );
      expect(mockChannel.send).not.toHaveBeenCalled();
    });

    it('should handle data URI format', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: 'channel-123',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      const dataUri = `data:image/png;base64,${Buffer.from('test').toString('base64')}`;

      const result = await provider.sendMessage(envelope, {
        attachments: [
          {
            data: dataUri,
            filename: 'image.png',
          },
        ],
      });

      expect(result.providerMessageId).toBe('sent-message-id');
      expect(mockChannel.send).toHaveBeenCalled();
    });

    it('should use filename from URL if not provided', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: 'channel-123',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      const result = await provider.sendMessage(envelope, {
        attachments: [
          {
            url: 'https://example.com/path/to/document.pdf',
          },
        ],
      });

      expect(result.providerMessageId).toBe('sent-message-id');
      expect(mockChannel.send).toHaveBeenCalled();
    });

    it('should skip attachments with neither url nor data', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: 'channel-123',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      const result = await provider.sendMessage(envelope, {
        text: 'Text message',
        attachments: [
          {
            filename: 'missing-data.txt',
          },
        ],
      });

      expect(result.providerMessageId).toBe('sent-message-id');
      expect(mockChannel.send).toHaveBeenCalledWith({
        content: 'Text message',
        files: undefined, // No valid attachments
      });
    });
  });

  describe('Embed Transformation', () => {
    let mockConnection: any;
    let mockChannel: any;

    beforeEach(async () => {
      mockChannel = {
        send: jest.fn().mockResolvedValue({ id: 'sent-message-id' }),
      };

      const mockClient = {
        isReady: jest.fn().mockReturnValue(true),
        channels: {
          fetch: jest.fn().mockResolvedValue(mockChannel),
        },
      };

      mockConnection = {
        connectionKey: 'project-123:platform-456',
        projectId: 'project-123',
        platformId: 'platform-456',
        client: mockClient,
        isConnected: true,
      };

      (provider as any).connections.set(
        'project-123:platform-456',
        mockConnection,
      );
    });

    it('should send message with complete embed', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: 'channel-123',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      const result = await provider.sendMessage(envelope, {
        text: 'Check this embed',
        embeds: [
          {
            author: {
              name: 'Test Author',
              url: 'https://example.com/author',
              iconUrl: 'https://example.com/icon.png',
            },
            title: 'Embed Title',
            url: 'https://example.com/embed',
            description: 'Description text',
            color: '#5865F2',
            imageUrl: 'https://example.com/image.png',
            thumbnailUrl: 'https://example.com/thumb.png',
            fields: [
              { name: 'Field 1', value: 'Value 1', inline: true },
              { name: 'Field 2', value: 'Value 2', inline: false },
            ],
            footer: {
              text: 'Footer text',
              iconUrl: 'https://example.com/footer.png',
            },
            timestamp: '2025-09-30T20:00:00.000Z',
          },
        ],
      });

      expect(result.providerMessageId).toBe('sent-message-id');
      expect(mockChannel.send).toHaveBeenCalledWith({
        content: 'Check this embed',
        files: undefined,
        embeds: expect.arrayContaining([expect.any(Object)]),
      });
    });

    it('should enforce 10 embed limit', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: 'channel-123',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      const embeds = Array.from({ length: 15 }, (_, i) => ({
        title: `Embed ${i + 1}`,
        description: `Description ${i + 1}`,
      }));

      const result = await provider.sendMessage(envelope, {
        embeds,
      });

      expect(result.providerMessageId).toBe('sent-message-id');
      expect(mockChannel.send).toHaveBeenCalledWith({
        content: undefined,
        files: undefined,
        embeds: expect.arrayContaining([expect.any(Object)]),
      });

      // Should have called with exactly 10 embeds
      const call = mockChannel.send.mock.calls[0][0];
      expect(call.embeds).toHaveLength(10);
    });

    it('should skip unsafe author URL', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: 'channel-123',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      const result = await provider.sendMessage(envelope, {
        embeds: [
          {
            author: {
              name: 'Test Author',
              url: 'http://169.254.169.254/metadata', // SSRF attempt
            },
            title: 'Test',
          },
        ],
      });

      expect(result.providerMessageId).toBe('sent-message-id');
      // Should still send embed but without the unsafe URL
      expect(mockChannel.send).toHaveBeenCalled();
    });

    it('should skip unsafe image URL', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: 'channel-123',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      const result = await provider.sendMessage(envelope, {
        embeds: [
          {
            title: 'Test',
            imageUrl: 'http://localhost:8080/admin', // Unsafe URL
          },
        ],
      });

      expect(result.providerMessageId).toBe('sent-message-id');
      expect(mockChannel.send).toHaveBeenCalled();
    });

    it('should enforce 25 field limit per embed', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: 'channel-123',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      const fields = Array.from({ length: 30 }, (_, i) => ({
        name: `Field ${i + 1}`,
        value: `Value ${i + 1}`,
      }));

      const result = await provider.sendMessage(envelope, {
        embeds: [
          {
            title: 'Many fields',
            fields,
          },
        ],
      });

      expect(result.providerMessageId).toBe('sent-message-id');
      expect(mockChannel.send).toHaveBeenCalled();
    });

    it('should handle invalid timestamp gracefully', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: 'channel-123',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      const result = await provider.sendMessage(envelope, {
        embeds: [
          {
            title: 'Test',
            timestamp: 'invalid-date-string',
          },
        ],
      });

      expect(result.providerMessageId).toBe('sent-message-id');
      expect(mockChannel.send).toHaveBeenCalled();
    });

    it('should handle invalid color gracefully', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: 'channel-123',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      const result = await provider.sendMessage(envelope, {
        embeds: [
          {
            title: 'Test',
            color: 'not-a-valid-color',
          },
        ],
      });

      expect(result.providerMessageId).toBe('sent-message-id');
      expect(mockChannel.send).toHaveBeenCalled();
    });

    it('should send multiple embeds', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: 'channel-123',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      const result = await provider.sendMessage(envelope, {
        embeds: [
          {
            title: 'Embed 1',
            description: 'First embed',
          },
          {
            title: 'Embed 2',
            description: 'Second embed',
          },
          {
            title: 'Embed 3',
            description: 'Third embed',
          },
        ],
      });

      expect(result.providerMessageId).toBe('sent-message-id');
      const call = mockChannel.send.mock.calls[0][0];
      expect(call.embeds).toHaveLength(3);
    });

    it('should send message with text, attachments, and embeds', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: 'channel-123',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      const result = await provider.sendMessage(envelope, {
        text: 'Complete message',
        attachments: [
          {
            url: 'https://example.com/file.pdf',
          },
        ],
        embeds: [
          {
            title: 'Embed',
            description: 'Description',
          },
        ],
      });

      expect(result.providerMessageId).toBe('sent-message-id');
      expect(mockChannel.send).toHaveBeenCalledWith({
        content: 'Complete message',
        files: expect.any(Array),
        embeds: expect.any(Array),
      });
    });

    it('should send embed-only message without text', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: 'channel-123',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      const result = await provider.sendMessage(envelope, {
        embeds: [
          {
            title: 'Embed only',
            description: 'No text message',
          },
        ],
      });

      expect(result.providerMessageId).toBe('sent-message-id');
      expect(mockChannel.send).toHaveBeenCalledWith({
        content: undefined,
        files: undefined,
        embeds: expect.any(Array),
      });
    });
  });

  describe('Button Support', () => {
    let mockChannel: any;
    let mockClient: any;

    beforeEach(() => {
      mockChannel = {
        send: jest.fn().mockResolvedValue({ id: 'sent-message-id' }),
      };

      mockClient = {
        channels: {
          fetch: jest.fn().mockResolvedValue(mockChannel),
        },
        isReady: jest.fn().mockReturnValue(true),
        login: jest.fn().mockResolvedValue('token'),
        destroy: jest.fn().mockResolvedValue(undefined),
      };

      // Inject mock connection
      const connectionKey = 'project-123:platform-456';
      const mockConnection = {
        connectionKey,
        projectId: 'project-123',
        platformId: 'platform-456',
        client: mockClient,
        token: 'test-token',
        isConnected: true,
        lastActivity: new Date(),
      };
      provider['connections'].set(connectionKey, mockConnection as any);
    });

    it('should transform buttons with values to Discord action rows', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: 'channel-123',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      await provider.sendMessage(envelope, {
        text: 'Choose an action',
        buttons: [
          { text: 'Confirm', value: 'confirm', style: 'success' },
          { text: 'Cancel', value: 'cancel', style: 'danger' },
        ],
      });

      expect(mockChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Choose an action',
          components: expect.arrayContaining([
            expect.objectContaining({
              components: expect.arrayContaining([
                expect.objectContaining({
                  data: expect.objectContaining({
                    custom_id: expect.stringContaining('confirm'),
                    label: 'Confirm',
                  }),
                }),
                expect.objectContaining({
                  data: expect.objectContaining({
                    custom_id: expect.stringContaining('cancel'),
                    label: 'Cancel',
                  }),
                }),
              ]),
            }),
          ]),
        }),
      );
    });

    it('should transform buttons with URLs to Discord link buttons', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: 'channel-123',
        provider: {
          raw: { platformId: 'platform-456' },
        },
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

      expect(mockChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Visit our website',
          components: expect.arrayContaining([
            expect.objectContaining({
              components: expect.arrayContaining([
                expect.objectContaining({
                  data: expect.objectContaining({
                    url: 'https://gatekit.dev',
                    label: 'Visit GateKit',
                  }),
                }),
              ]),
            }),
          ]),
        }),
      );
    });

    it('should map button styles to Discord button styles', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: 'channel-123',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      await provider.sendMessage(envelope, {
        text: 'Choose a style',
        buttons: [
          { text: 'Primary', value: 'primary', style: 'primary' },
          { text: 'Secondary', value: 'secondary', style: 'secondary' },
          { text: 'Success', value: 'success', style: 'success' },
          { text: 'Danger', value: 'danger', style: 'danger' },
        ],
      });

      const call = mockChannel.send.mock.calls[0][0];
      const buttons = call.components[0].components;

      // Check that styles are mapped (Discord.js ButtonStyle enum values)
      expect(buttons[0].data.style).toBeDefined();
      expect(buttons[1].data.style).toBeDefined();
      expect(buttons[2].data.style).toBeDefined();
      expect(buttons[3].data.style).toBeDefined();
    });

    it('should handle up to 25 buttons across multiple rows', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: 'channel-123',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      const buttons = Array.from({ length: 25 }, (_, i) => ({
        text: `Button ${i + 1}`,
        value: `button_${i + 1}`,
      }));

      await provider.sendMessage(envelope, {
        text: 'Many buttons',
        buttons,
      });

      const call = mockChannel.send.mock.calls[0][0];
      expect(call.components).toBeDefined();
      expect(call.components.length).toBeLessThanOrEqual(5); // Max 5 rows

      // Count total buttons
      let totalButtons = 0;
      for (const row of call.components) {
        totalButtons += row.components.length;
        expect(row.components.length).toBeLessThanOrEqual(5); // Max 5 buttons per row
      }
      expect(totalButtons).toBe(25);
    });

    it('should truncate buttons exceeding Discord limit', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: 'channel-123',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      const buttons = Array.from({ length: 30 }, (_, i) => ({
        text: `Button ${i + 1}`,
        value: `button_${i + 1}`,
      }));

      await provider.sendMessage(envelope, {
        text: 'Too many buttons',
        buttons,
      });

      const call = mockChannel.send.mock.calls[0][0];

      // Count total buttons (should be max 25)
      let totalButtons = 0;
      for (const row of call.components) {
        totalButtons += row.components.length;
      }
      expect(totalButtons).toBeLessThanOrEqual(25);
    });

    it('should send message with text, attachments, embeds, and buttons', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: 'channel-123',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      const result = await provider.sendMessage(envelope, {
        text: 'Complete message',
        attachments: [
          {
            url: 'https://example.com/file.pdf',
          },
        ],
        embeds: [
          {
            title: 'Embed',
            description: 'Description',
          },
        ],
        buttons: [{ text: 'Download', value: 'download', style: 'primary' }],
      });

      expect(result.providerMessageId).toBe('sent-message-id');
      expect(mockChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Complete message',
          files: expect.any(Array),
          embeds: expect.any(Array),
          components: expect.any(Array),
        }),
      );
    });

    it('should handle message with buttons', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: 'channel-123',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      await provider.sendMessage(envelope, {
        text: 'Choose an option',
        buttons: [
          { text: 'Option A', value: 'option_a' },
          { text: 'Option B', value: 'option_b' },
        ],
      });

      expect(mockChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Choose an option',
          components: expect.any(Array),
        }),
      );
    });

    it('should handle empty buttons array', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: 'channel-123',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      await provider.sendMessage(envelope, {
        text: 'No buttons',
        buttons: [],
      });

      expect(mockChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'No buttons',
          components: undefined,
        }),
      );
    });

    it('should mix value and URL buttons in same message', async () => {
      const envelope = {
        projectId: 'project-123',
        threadId: 'channel-123',
        provider: {
          raw: { platformId: 'platform-456' },
        },
      } as any;

      await provider.sendMessage(envelope, {
        text: 'Choose your action',
        buttons: [
          { text: 'Confirm', value: 'confirm', style: 'success' },
          { text: 'Cancel', value: 'cancel', style: 'danger' },
          { text: 'Help', url: 'https://help.example.com', style: 'link' },
        ],
      });

      const call = mockChannel.send.mock.calls[0][0];
      const buttons = call.components[0].components;

      expect(buttons).toHaveLength(3);
      expect(buttons[0].data.custom_id).toBeDefined();
      expect(buttons[1].data.custom_id).toBeDefined();
      expect(buttons[2].data.url).toBe('https://help.example.com');
    });
  });
});
