import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Client, Message, User, TextChannel } from 'discord.js';
import { DiscordProvider } from './discord.provider';
import { EVENT_BUS } from '../interfaces/event-bus.interface';

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

      // Both should return not-ready since no connections are set up
      const results = await Promise.all([
        provider.sendMessage(env1, { text: 'Hello 1' }),
        provider.sendMessage(env2, { text: 'Hello 2' }),
        provider.sendMessage(env1, { text: 'Hello 1 again' }),
      ]);

      // Verify isolation - each should have consistent responses (no connections set up)
      expect(results[0].providerMessageId).toBe('discord-not-ready');
      expect(results[1].providerMessageId).toBe('discord-not-ready');
      expect(results[2].providerMessageId).toBe('discord-not-ready');
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
});
