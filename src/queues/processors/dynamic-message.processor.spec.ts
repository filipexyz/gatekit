import { Test, TestingModule } from '@nestjs/testing';
import { DynamicMessageProcessor } from './dynamic-message.processor';
import { PlatformRegistry } from '../../platforms/services/platform-registry.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WebhookDeliveryService } from '../../webhooks/services/webhook-delivery.service';

// Mock CryptoUtil
jest.mock('../../common/utils/crypto.util', () => ({
  CryptoUtil: {
    decrypt: jest.fn((data) => '{"token":"mock-decrypted-token"}'),
  },
}));

describe('DynamicMessageProcessor', () => {
  let processor: DynamicMessageProcessor;
  let prismaService: PrismaService;
  let platformRegistry: PlatformRegistry;

  const mockPrismaService = {
    projectPlatform: {
      findFirst: jest.fn(),
    },
    sentMessage: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const mockPlatformRegistry = {
    getProvider: jest.fn(),
  };

  const mockMessageQueue = {
    add: jest.fn(),
    getJobStatus: jest.fn(),
  };

  const mockProvider = {
    getAdapter: jest.fn(),
    createAdapter: jest.fn(),
  };

  const mockAdapter = {
    sendMessage: jest.fn(),
  };

  const mockWebhookDeliveryService = {
    deliverEvent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DynamicMessageProcessor,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: PlatformRegistry,
          useValue: mockPlatformRegistry,
        },
        {
          provide: 'BullQueue_messages',
          useValue: mockMessageQueue,
        },
        {
          provide: WebhookDeliveryService,
          useValue: mockWebhookDeliveryService,
        },
      ],
    }).compile();

    processor = module.get<DynamicMessageProcessor>(DynamicMessageProcessor);
    prismaService = module.get<PrismaService>(PrismaService);
    platformRegistry = module.get<PlatformRegistry>(PlatformRegistry);

    jest.clearAllMocks();

    // Setup default mock behaviors
    mockPrismaService.sentMessage.update.mockResolvedValue({
      id: 'updated-message',
    });
    mockPrismaService.sentMessage.updateMany.mockResolvedValue({ count: 1 });
  });

  describe('Platform Label Bug Fix', () => {
    it('should use correct platform type for Discord messages', async () => {
      const mockJob = {
        id: 'test-job-1',
        data: {
          projectId: 'project-id',
          projectId: 'project-id',
          message: {
            targets: [
              {
                platformId: 'discord-platform-id',
                type: 'channel',
                id: 'channel-123',
              },
            ],
            content: { text: 'Test message' },
          },
        },
      };

      // Mock Discord platform configuration (with all required fields)
      mockPrismaService.projectPlatform.findFirst.mockResolvedValue({
        id: 'discord-platform-id',
        projectId: 'project-id',
        platform: 'discord',
        isActive: true, // CRITICAL: Must be active to pass validation
        credentialsEncrypted: 'encrypted_credentials',
        project: { id: 'project-id', slug: 'test-project' },
      });

      mockPrismaService.sentMessage.create.mockResolvedValue({
        id: 'sent-message-id',
      });

      mockPlatformRegistry.getProvider.mockReturnValue(mockProvider);
      mockProvider.getAdapter.mockReturnValue(mockAdapter);
      mockAdapter.sendMessage.mockResolvedValue({
        providerMessageId: 'discord-msg-123',
      });

      mockPrismaService.sentMessage.updateMany.mockResolvedValue({ count: 1 });

      const result = await processor.process(mockJob as any);

      // Verify platform is correctly set to 'discord', not 'telegram'
      expect(mockPrismaService.sentMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          platform: 'discord', // Should be 'discord', not 'telegram'
          platformId: 'discord-platform-id',
        }),
      });

      expect(result.results[0].target.platform).toBe('discord');
    });

    it('should use correct platform type for WhatsApp messages', async () => {
      const mockJob = {
        id: 'test-job-2',
        data: {
          projectId: 'project-id',
          projectId: 'project-id',
          message: {
            targets: [
              {
                platformId: 'whatsapp-platform-id',
                type: 'user',
                id: '5511999999999',
              },
            ],
            content: { text: 'WhatsApp test message' },
          },
        },
      };

      // Mock WhatsApp platform configuration (with all required fields)
      mockPrismaService.projectPlatform.findFirst.mockResolvedValue({
        id: 'whatsapp-platform-id',
        projectId: 'project-id',
        platform: 'whatsapp-evo',
        isActive: true, // CRITICAL: Must be active to pass validation
        credentialsEncrypted: 'encrypted_whatsapp_credentials',
        project: { id: 'project-id', slug: 'test-project' },
      });

      mockPrismaService.sentMessage.create.mockResolvedValue({
        id: 'sent-message-id-2',
      });

      mockPlatformRegistry.getProvider.mockReturnValue(mockProvider);
      mockProvider.getAdapter.mockReturnValue(mockAdapter);
      mockAdapter.sendMessage.mockResolvedValue({
        providerMessageId: 'whatsapp-msg-456',
      });

      mockPrismaService.sentMessage.updateMany.mockResolvedValue({ count: 1 });

      const result = await processor.process(mockJob as any);

      // Verify platform is correctly set to 'whatsapp-evo', not 'telegram'
      expect(mockPrismaService.sentMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          platform: 'whatsapp-evo', // Should be 'whatsapp-evo', not 'telegram'
          platformId: 'whatsapp-platform-id',
        }),
      });

      expect(result.results[0].target.platform).toBe('whatsapp-evo');
    });
  });

  describe('Multi-Target Delivery Fix', () => {
    it('should process all targets even when one fails permanently', async () => {
      const mockJob = {
        id: 'test-job-multi',
        data: {
          projectId: 'project-id',
          projectId: 'project-id',
          message: {
            targets: [
              {
                platformId: 'discord-platform-id',
                type: 'channel',
                id: 'channel-123',
              },
              {
                platformId: 'whatsapp-platform-id',
                type: 'user',
                id: '5511999999999',
              },
            ],
            content: { text: 'Multi-platform message' },
          },
        },
      };

      // Mock both platforms found, but Discord provider missing (permanent failure)
      mockPrismaService.projectPlatform.findFirst
        .mockResolvedValueOnce({
          id: 'discord-platform-id',
          projectId: 'project-id',
          platform: 'discord',
          isActive: true,
          credentialsEncrypted: 'encrypted_discord_creds',
          project: { id: 'project-id', slug: 'test-project' },
        })
        .mockResolvedValueOnce({
          id: 'whatsapp-platform-id',
          projectId: 'project-id',
          platform: 'whatsapp-evo',
          isActive: true,
          credentialsEncrypted: 'encrypted_whatsapp_creds',
          project: { id: 'project-id', slug: 'test-project' },
        });

      mockPrismaService.sentMessage.create.mockResolvedValueOnce({
        id: 'sent-whatsapp',
      });

      // Mock Discord provider not found (permanent failure), WhatsApp provider found
      mockPlatformRegistry.getProvider
        .mockReturnValueOnce(null) // Discord provider missing
        .mockReturnValueOnce(mockProvider); // WhatsApp provider found
      mockProvider.getAdapter.mockReturnValue(mockAdapter);
      mockAdapter.sendMessage.mockResolvedValue({
        providerMessageId: 'whatsapp-success-123',
      });

      mockPrismaService.sentMessage.updateMany.mockResolvedValue({ count: 1 });

      const result = await processor.process(mockJob as any);

      // Should have results for all targets, not just the first one
      expect(result.totalTargets).toBe(2);
      expect(result.successCount).toBe(1); // WhatsApp succeeded
      expect(result.failureCount).toBe(1); // Discord failed
      expect(result.results).toHaveLength(1); // WhatsApp result
      expect(result.errors).toHaveLength(1); // Discord error

      // Verify WhatsApp result shows correct platform
      expect(result.results[0].target.platform).toBe('whatsapp-evo');

      // Verify Discord error shows platform (known when platform lookup succeeds but provider fails)
      expect(result.errors[0].target.platform).toBe('discord');
      expect(result.errors[0].permanent).toBe(true); // Should be marked as permanent
    });

    it('should handle multiple successful deliveries', async () => {
      const mockJob = {
        id: 'test-job-success',
        data: {
          projectId: 'project-id',
          projectId: 'project-id',
          message: {
            targets: [
              {
                platformId: 'discord-platform-id',
                type: 'channel',
                id: 'channel-123',
              },
              {
                platformId: 'telegram-platform-id',
                type: 'chat',
                id: 'chat-456',
              },
            ],
            content: { text: 'Multi-success message' },
          },
        },
      };

      // Mock active platform configurations for both Discord and Telegram
      mockPrismaService.projectPlatform.findFirst
        .mockResolvedValueOnce({
          id: 'discord-platform-id',
          projectId: 'project-id',
          platform: 'discord',
          isActive: true,
          credentialsEncrypted: 'encrypted_discord_creds',
          project: { id: 'project-id', slug: 'test-project' },
        })
        .mockResolvedValueOnce({
          id: 'telegram-platform-id',
          projectId: 'project-id',
          platform: 'telegram',
          isActive: true,
          credentialsEncrypted: 'encrypted_telegram_creds',
          project: { id: 'project-id', slug: 'test-project' },
        });

      mockPrismaService.sentMessage.create
        .mockResolvedValueOnce({ id: 'sent-discord' })
        .mockResolvedValueOnce({ id: 'sent-telegram' });

      mockPlatformRegistry.getProvider.mockReturnValue(mockProvider);
      mockProvider.getAdapter.mockReturnValue(mockAdapter);
      mockAdapter.sendMessage
        .mockResolvedValueOnce({ providerMessageId: 'discord-msg-123' })
        .mockResolvedValueOnce({ providerMessageId: 'telegram-msg-456' });

      mockPrismaService.sentMessage.updateMany.mockResolvedValue({ count: 1 });

      const result = await processor.process(mockJob as any);

      // Should have results for both targets
      expect(result.totalTargets).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(result.results).toHaveLength(2);
      expect(result.errors).toHaveLength(0);

      // Verify both platforms show correct types
      expect(result.results[0].target.platform).toBe('discord');
      expect(result.results[1].target.platform).toBe('telegram');
    });

    it('should continue processing after permanent failure without throwing', async () => {
      const mockJob = {
        id: 'test-job-permanent-fail',
        data: {
          projectId: 'project-id',
          projectId: 'project-id',
          message: {
            targets: [
              {
                platformId: 'invalid-platform-id',
                type: 'channel',
                id: 'channel-123',
              },
              {
                platformId: 'valid-platform-id',
                type: 'user',
                id: 'user-456',
              },
            ],
            content: { text: 'Test permanent failure' },
          },
        },
      };

      // Mock first platform fails (not found), second succeeds
      mockPrismaService.projectPlatform.findFirst
        .mockResolvedValueOnce(null) // First target: platform not found (permanent failure)
        .mockResolvedValueOnce({
          // Second target: WhatsApp succeeds
          id: 'whatsapp-platform-id',
          projectId: 'project-id',
          platform: 'whatsapp-evo',
          isActive: true,
          credentialsEncrypted: 'encrypted_whatsapp_creds',
          project: { id: 'project-id', slug: 'test-project' },
        });

      mockPrismaService.sentMessage.create.mockResolvedValueOnce({
        id: 'sent-whatsapp',
      });

      mockPlatformRegistry.getProvider.mockReturnValue(mockProvider);
      mockProvider.getAdapter.mockReturnValue(mockAdapter);
      mockAdapter.sendMessage.mockResolvedValue({
        providerMessageId: 'telegram-success-789',
      });

      mockPrismaService.sentMessage.updateMany.mockResolvedValue({ count: 1 });

      // Should not throw despite permanent failure
      const result = await processor.process(mockJob as any);

      expect(result.totalTargets).toBe(2);
      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(1);
      expect(result.results).toHaveLength(1); // Telegram success
      expect(result.errors).toHaveLength(1); // Discord permanent failure

      // Verify permanent failure is marked correctly
      expect(result.errors[0].permanent).toBe(true);
      expect(result.errors[0].target.platform).toBe('unknown'); // Platform unknown when lookup fails
    });
  });

  describe('Platform Configuration Lookup', () => {
    it('should skip targets with missing platform configuration', async () => {
      const mockJob = {
        id: 'test-job-missing-config',
        data: {
          projectId: 'project-id',
          projectId: 'project-id',
          message: {
            targets: [
              {
                platformId: 'missing-platform-id',
                type: 'channel',
                id: 'channel-123',
              },
            ],
            content: { text: 'Test missing config' },
          },
        },
      };

      // Mock missing platform configuration
      mockPrismaService.projectPlatform.findFirst.mockResolvedValue(null);

      const result = await processor.process(mockJob as any);

      // Should not create sent message record for missing platform (validation fails early)
      expect(mockPrismaService.sentMessage.create).not.toHaveBeenCalled();

      // Should record as error (missing platform = permanent failure)
      expect(result.totalTargets).toBe(1);
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(1); // Platform not found = 1 error
      expect(result.results).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].target.platform).toBe('unknown');
      expect(result.errors[0].permanent).toBe(true);
    });

    it('should handle database errors gracefully when looking up platform', async () => {
      const mockJob = {
        id: 'test-job-db-error',
        data: {
          projectId: 'project-id',
          projectId: 'project-id',
          message: {
            targets: [
              {
                platformId: 'platform-id',
                type: 'channel',
                id: 'channel-123',
              },
            ],
            content: { text: 'Test DB error' },
          },
        },
      };

      // Mock database error
      mockPrismaService.projectPlatform.findFirst.mockRejectedValue(
        new Error('Database connection lost'),
      );

      const result = await processor.process(mockJob as any);

      // Should handle error gracefully and record as failure
      expect(result.totalTargets).toBe(1);
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(1); // Database error = 1 error
      expect(result.results).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].target.platform).toBe('unknown');
      expect(result.errors[0].permanent).toBe(false); // DB errors are retryable
    });
  });

  describe('Message Deduplication (Anti-Spam)', () => {
    it('should deduplicate identical targets within same job', async () => {
      const mockJob = {
        id: 'test-job-duplicates',
        data: {
          projectId: 'project-id',
          projectId: 'project-id',
          message: {
            targets: [
              {
                platformId: 'discord-platform-id',
                type: 'channel',
                id: 'channel-123',
              },
              {
                platformId: 'discord-platform-id',
                type: 'channel',
                id: 'channel-123', // EXACT DUPLICATE!
              },
              {
                platformId: 'telegram-platform-id',
                type: 'chat',
                id: 'chat-456',
              },
              {
                platformId: 'discord-platform-id',
                type: 'channel',
                id: 'channel-123', // TRIPLE DUPLICATE!
              },
            ],
            content: { text: 'Test deduplication' },
          },
        },
      };

      // Mock platform configurations (Discord + Telegram)
      mockPrismaService.projectPlatform.findFirst
        .mockResolvedValueOnce({
          id: 'discord-platform-id',
          projectId: 'project-id',
          platform: 'discord',
          isActive: true,
          credentialsEncrypted: 'encrypted_discord_creds',
          project: { id: 'project-id', slug: 'test-project' },
        })
        .mockResolvedValueOnce({
          id: 'telegram-platform-id',
          projectId: 'project-id',
          platform: 'telegram',
          isActive: true,
          credentialsEncrypted: 'encrypted_telegram_creds',
          project: { id: 'project-id', slug: 'test-project' },
        });

      mockPrismaService.sentMessage.create
        .mockResolvedValueOnce({ id: 'sent-discord' })
        .mockResolvedValueOnce({ id: 'sent-telegram' });

      mockPlatformRegistry.getProvider.mockReturnValue(mockProvider);
      mockProvider.getAdapter.mockReturnValue(mockAdapter);
      mockAdapter.sendMessage
        .mockResolvedValueOnce({ providerMessageId: 'discord-msg-123' })
        .mockResolvedValueOnce({ providerMessageId: 'telegram-msg-456' });

      mockPrismaService.sentMessage.updateMany.mockResolvedValue({ count: 1 });

      const result = await processor.process(mockJob as any);

      // Should process only 2 unique targets (Discord once, Telegram once)
      expect(result.totalTargets).toBe(4); // Original count
      expect(result.uniqueTargets).toBe(2); // After deduplication
      expect(result.duplicatesRemoved).toBe(2); // 2 Discord duplicates removed
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(result.results).toHaveLength(2);

      // Verify platforms are correct
      expect(result.results[0].target.platform).toBe('discord');
      expect(result.results[1].target.platform).toBe('telegram');
    });
  });
});
