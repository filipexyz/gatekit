import { Test, TestingModule } from '@nestjs/testing';
import { PlatformsService } from './platforms.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { CryptoUtil } from '../common/utils/crypto.util';
import { CredentialValidationService } from './services/credential-validation.service';
import { PlatformRegistry } from './services/platform-registry.service';

jest.mock('../common/utils/crypto.util', () => ({
  CryptoUtil: {
    encrypt: jest.fn((data) => `encrypted_${data}`),
    decrypt: jest.fn((data) => data.replace('encrypted_', '')),
  },
}));

describe('PlatformsService', () => {
  let service: PlatformsService;
  let prisma: PrismaService;

  const mockAuthContext = {
    authType: 'api-key' as const,
    project: { id: 'project-id' },
  };

  const mockPrismaService = {
    project: {
      findUnique: jest.fn(),
    },
    projectPlatform: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockCredentialValidationService = {
    validateAndThrow: jest.fn(),
    validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
  };

  const mockPlatformRegistry = {
    getProvider: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CredentialValidationService,
          useValue: mockCredentialValidationService,
        },
        {
          provide: PlatformRegistry,
          useValue: mockPlatformRegistry,
        },
      ],
    }).compile();

    service = module.get<PlatformsService>(PlatformsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a platform configuration', async () => {
      const projectId = 'project-id';
      const createDto = {
        platform: 'discord' as any,
        name: 'Test Discord Bot',
        description: 'Bot for testing purposes',
        credentials: { token: 'discord-token' },
        isActive: true,
        testMode: false,
      };

      const mockProject = { id: 'project-id' };
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.projectPlatform.findUnique.mockResolvedValue(null);
      mockPrismaService.projectPlatform.create.mockResolvedValue({
        id: 'platform-id',
        platform: 'discord',
        name: 'Test Discord Bot',
        description: 'Bot for testing purposes',
        credentialsEncrypted: 'encrypted_credentials',
        isActive: true,
        testMode: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(
        projectId,
        createDto,
        mockAuthContext,
      );

      expect(result).toHaveProperty('id', 'platform-id');
      expect(result).toHaveProperty('platform', 'discord');
      expect(result).toHaveProperty('name', 'Test Discord Bot');
      expect(result).toHaveProperty('description', 'Bot for testing purposes');
      expect(result).toHaveProperty('isActive', true);
      expect(CryptoUtil.encrypt).toHaveBeenCalledWith(
        JSON.stringify(createDto.credentials),
      );
      expect(mockPrismaService.projectPlatform.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Test Discord Bot',
          description: 'Bot for testing purposes',
        }),
      });
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          'non-existent',
          {
            platform: 'discord' as any,
            name: 'Test Bot',
            credentials: {},
          },
          mockAuthContext,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow multiple instances of same platform per project', async () => {
      const mockProject = { id: 'project-id' };
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      // Mock successful creation of second Discord instance
      mockPrismaService.projectPlatform.create.mockResolvedValue({
        id: 'second-discord-instance',
        projectId: 'project-id',
        platform: 'discord',
        isActive: true,
        testMode: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(
        'test-project',
        {
          platform: 'discord' as any,
          name: 'Second Discord Instance',
          credentials: {},
        },
        mockAuthContext,
      );

      expect(result).toHaveProperty('platform', 'discord');
      expect(result).toHaveProperty('id', 'second-discord-instance');
    });

    it('should create platform with valid name characters', async () => {
      const createDto = {
        platform: 'discord' as any,
        name: 'test-bot.v1',
        credentials: { token: 'discord-token' },
      };

      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-id',
      });
      mockPrismaService.projectPlatform.create.mockResolvedValue({
        id: 'platform-id',
        platform: 'discord',
        name: 'test-bot.v1',
        description: null,
        credentialsEncrypted: 'encrypted_credentials',
        isActive: true,
        testMode: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        webhookToken: 'webhook-token',
      });

      const result = await service.create(
        'test-project',
        createDto,
        mockAuthContext,
      );

      expect(result).toHaveProperty('name', 'test-bot.v1');
      expect(mockPrismaService.projectPlatform.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'test-bot.v1',
        }),
      });
    });

    it('should create platform with name only (no description)', async () => {
      const createDto = {
        platform: 'telegram' as any,
        name: 'Simple Telegram Bot',
        credentials: { token: 'telegram-token' },
      };

      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-id',
      });
      mockPrismaService.projectPlatform.create.mockResolvedValue({
        id: 'platform-id',
        platform: 'telegram',
        name: 'Simple Telegram Bot',
        description: null,
        credentialsEncrypted: 'encrypted_credentials',
        isActive: true,
        testMode: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        webhookToken: 'webhook-token',
      });

      const result = await service.create(
        'test-project',
        createDto,
        mockAuthContext,
      );

      expect(result).toHaveProperty('name', 'Simple Telegram Bot');
      expect(result).toHaveProperty('description', null);
      expect(mockPrismaService.projectPlatform.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Simple Telegram Bot',
          description: undefined,
        }),
      });
    });
  });

  describe('findAll', () => {
    it('should return all platforms for a project', async () => {
      const projectId = 'test-project';
      const mockProject = {
        id: 'project-id',

        projectPlatforms: [
          {
            id: 'platform-1',
            platform: 'discord',
            name: 'Main Discord Bot',
            description: 'Primary Discord integration',
            isActive: true,
            testMode: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'platform-2',
            platform: 'telegram',
            name: 'Test Telegram Bot',
            description: null,
            isActive: false,
            testMode: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      const result = await service.findAll(projectId);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('platform', 'discord');
      expect(result[0]).toHaveProperty('name', 'Main Discord Bot');
      expect(result[0]).toHaveProperty(
        'description',
        'Primary Discord integration',
      );
      expect(result[1]).toHaveProperty('platform', 'telegram');
      expect(result[1]).toHaveProperty('name', 'Test Telegram Bot');
      expect(result[1]).toHaveProperty('description', null);
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.findAll('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findOne', () => {
    it('should return platform with decrypted credentials', async () => {
      const projectId = 'test-project';
      const platformId = 'platform-id';
      const mockCredentials = { token: 'discord-token' };

      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-id',
      });
      mockPrismaService.projectPlatform.findFirst.mockResolvedValue({
        id: platformId,
        platform: 'discord',
        credentialsEncrypted: `encrypted_${JSON.stringify(mockCredentials)}`,
        isActive: true,
        testMode: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.findOne(projectId, platformId);

      expect(result).toHaveProperty('credentials');
      // Credentials should be masked in response
      expect(result.credentials).toEqual({ token: '*****' });
      expect(CryptoUtil.decrypt).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update platform configuration', async () => {
      const projectId = 'test-project';
      const platformId = 'platform-id';
      const updateDto = {
        credentials: { token: 'new-token' },
        isActive: false,
      };

      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-id',
      });
      mockPrismaService.projectPlatform.findFirst.mockResolvedValue({
        id: platformId,
      });
      mockPrismaService.projectPlatform.update.mockResolvedValue({
        id: platformId,
        platform: 'discord',
        isActive: false,
        testMode: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.update(projectId, platformId, updateDto);

      expect(result).toHaveProperty('isActive', false);
      expect(mockPrismaService.projectPlatform.update).toHaveBeenCalledWith({
        where: { id: platformId },
        data: expect.objectContaining({
          credentialsEncrypted: expect.stringContaining('encrypted_'),
          isActive: false,
        }),
      });
    });

    it('should update platform name and description', async () => {
      const projectId = 'test-project';
      const platformId = 'platform-id';
      const updateDto = {
        name: 'Updated Bot Name',
        description: 'New description for the bot',
      };

      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-id',
      });
      mockPrismaService.projectPlatform.findFirst.mockResolvedValue({
        id: platformId,
        platform: 'discord',
        name: 'Old Name',
        description: 'Old description',
      });
      mockPrismaService.projectPlatform.update.mockResolvedValue({
        id: platformId,
        platform: 'discord',
        name: 'Updated Bot Name',
        description: 'New description for the bot',
        isActive: true,
        testMode: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.update(projectId, platformId, updateDto);

      expect(result).toHaveProperty('name', 'Updated Bot Name');
      expect(result).toHaveProperty(
        'description',
        'New description for the bot',
      );
      expect(mockPrismaService.projectPlatform.update).toHaveBeenCalledWith({
        where: { id: platformId },
        data: expect.objectContaining({
          name: 'Updated Bot Name',
          description: 'New description for the bot',
        }),
      });
    });

    it('should update only name (clear description)', async () => {
      const projectId = 'test-project';
      const platformId = 'platform-id';
      const updateDto = {
        name: 'Simple Bot',
        description: null,
      };

      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-id',
      });
      mockPrismaService.projectPlatform.findFirst.mockResolvedValue({
        id: platformId,
      });
      mockPrismaService.projectPlatform.update.mockResolvedValue({
        id: platformId,
        platform: 'telegram',
        name: 'Simple Bot',
        description: null,
        isActive: true,
        testMode: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.update(projectId, platformId, updateDto);

      expect(result).toHaveProperty('name', 'Simple Bot');
      expect(result).toHaveProperty('description', null);
      expect(mockPrismaService.projectPlatform.update).toHaveBeenCalledWith({
        where: { id: platformId },
        data: expect.objectContaining({
          name: 'Simple Bot',
          description: null,
        }),
      });
    });

    it('should update only name without changing isActive or testMode', async () => {
      const projectId = 'test-project';
      const platformId = 'platform-id';
      const updateDto = {
        name: 'New Name Only',
      };

      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-id',
      });
      mockPrismaService.projectPlatform.findFirst.mockResolvedValue({
        id: platformId,
        platform: 'discord',
        name: 'Old Name',
        isActive: true,
        testMode: false,
        credentialsEncrypted: 'encrypted_{"token":"test"}',
      });
      mockPrismaService.projectPlatform.update.mockResolvedValue({
        id: platformId,
        platform: 'discord',
        name: 'New Name Only',
        isActive: true,
        testMode: false,
        webhookToken: 'webhook-token',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.update(projectId, platformId, updateDto);

      // Verify that ONLY name is in the update data
      const updateCall =
        mockPrismaService.projectPlatform.update.mock.calls[0][0];
      expect(updateCall.data).toEqual({ name: 'New Name Only' });
      expect(updateCall.data).not.toHaveProperty('isActive');
      expect(updateCall.data).not.toHaveProperty('testMode');
      expect(updateCall.data).not.toHaveProperty('description');
      expect(updateCall.data).not.toHaveProperty('credentialsEncrypted');
    });

    it('should update only credentials without changing isActive', async () => {
      const projectId = 'test-project';
      const platformId = 'platform-id';
      const updateDto = {
        credentials: { token: 'new-token' },
      };

      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-id',
      });
      mockPrismaService.projectPlatform.findFirst.mockResolvedValue({
        id: platformId,
        platform: 'discord',
        name: 'Bot',
        isActive: true,
        testMode: false,
      });
      mockPrismaService.projectPlatform.update.mockResolvedValue({
        id: platformId,
        platform: 'discord',
        name: 'Bot',
        isActive: true,
        testMode: false,
        webhookToken: 'webhook-token',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.update(projectId, platformId, updateDto);

      // Verify that ONLY credentialsEncrypted is in the update data
      const updateCall =
        mockPrismaService.projectPlatform.update.mock.calls[0][0];
      expect(updateCall.data).toHaveProperty('credentialsEncrypted');
      expect(updateCall.data).not.toHaveProperty('isActive');
      expect(updateCall.data).not.toHaveProperty('testMode');
      expect(updateCall.data).not.toHaveProperty('name');
      expect(updateCall.data).not.toHaveProperty('description');
    });

    it('should update only description without changing other fields', async () => {
      const projectId = 'test-project';
      const platformId = 'platform-id';
      const updateDto = {
        description: 'New description',
      };

      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-id',
      });
      mockPrismaService.projectPlatform.findFirst.mockResolvedValue({
        id: platformId,
        platform: 'telegram',
        name: 'Bot',
        isActive: true,
        testMode: true,
        credentialsEncrypted: 'encrypted_{"token":"test"}',
      });
      mockPrismaService.projectPlatform.update.mockResolvedValue({
        id: platformId,
        platform: 'telegram',
        name: 'Bot',
        description: 'New description',
        isActive: true,
        testMode: true,
        webhookToken: 'webhook-token',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.update(projectId, platformId, updateDto);

      // Verify that ONLY description is in the update data
      const updateCall =
        mockPrismaService.projectPlatform.update.mock.calls[0][0];
      expect(updateCall.data).toEqual({ description: 'New description' });
      expect(updateCall.data).not.toHaveProperty('isActive');
      expect(updateCall.data).not.toHaveProperty('testMode');
      expect(updateCall.data).not.toHaveProperty('name');
      expect(updateCall.data).not.toHaveProperty('credentialsEncrypted');
    });
  });

  describe('remove', () => {
    it('should remove platform configuration', async () => {
      const projectId = 'test-project';
      const platformId = 'platform-id';

      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-id',
      });
      mockPrismaService.projectPlatform.findFirst.mockResolvedValue({
        id: platformId,
        platform: 'discord',
        credentialsEncrypted: 'encrypted_{"token":"test-token"}',
        webhookToken: 'webhook-token',
      });

      const result = await service.remove(projectId, platformId);

      expect(result).toHaveProperty('message', 'Platform removed successfully');
      expect(mockPrismaService.projectPlatform.delete).toHaveBeenCalledWith({
        where: { id: platformId },
      });
    });
  });

  describe('Platform Lifecycle Events', () => {
    let mockProvider: any;

    beforeEach(() => {
      mockProvider = {
        name: 'whatsapp-evo',
        onPlatformEvent: jest.fn(),
      };
      mockPlatformRegistry.getProvider.mockReturnValue(mockProvider);
    });

    it('should fire created event when platform is created and active', async () => {
      const projectId = 'test-project';
      const createDto = {
        platform: 'whatsapp-evo',
        credentials: {
          evolutionApiUrl: 'https://evo.example.com',
          evolutionApiKey: 'test-key',
        },
        isActive: true,
      };

      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-id',
      });
      mockPrismaService.projectPlatform.create.mockResolvedValue({
        id: 'platform-id',
        platform: 'whatsapp-evo',
        isActive: true,
        webhookToken: 'webhook-token',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.create(projectId, createDto, mockAuthContext);

      expect(mockProvider.onPlatformEvent).toHaveBeenCalledWith({
        type: 'created',
        projectId: 'project-id',
        platformId: 'platform-id',
        platform: 'whatsapp-evo',
        credentials: createDto.credentials,
        webhookToken: 'webhook-token',
      });
    });

    it('should not fire created event when platform is created but inactive', async () => {
      const projectId = 'test-project';
      const createDto = {
        platform: 'whatsapp-evo',
        credentials: {
          evolutionApiUrl: 'https://evo.example.com',
          evolutionApiKey: 'test-key',
        },
        isActive: false,
      };

      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-id',
      });
      mockPrismaService.projectPlatform.create.mockResolvedValue({
        id: 'platform-id',
        platform: 'whatsapp-evo',
        isActive: false,
        webhookToken: 'webhook-token',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.create(projectId, createDto, mockAuthContext);

      expect(mockProvider.onPlatformEvent).not.toHaveBeenCalled();
    });

    it('should fire activated event when platform is activated', async () => {
      const projectId = 'test-project';
      const platformId = 'platform-id';
      const updateDto = { isActive: true };

      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-id',
      });
      mockPrismaService.projectPlatform.findFirst.mockResolvedValue({
        id: platformId,
        platform: 'whatsapp-evo',
        isActive: false, // Was inactive
        credentialsEncrypted:
          'encrypted_{"evolutionApiUrl":"https://evo.example.com","evolutionApiKey":"test-key"}',
      });
      mockPrismaService.projectPlatform.update.mockResolvedValue({
        id: platformId,
        platform: 'whatsapp-evo',
        isActive: true, // Now active
        webhookToken: 'webhook-token',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.update(projectId, platformId, updateDto);

      expect(mockProvider.onPlatformEvent).toHaveBeenCalledWith({
        type: 'activated',
        projectId: 'project-id',
        platformId: 'platform-id',
        platform: 'whatsapp-evo',
        credentials: {
          evolutionApiUrl: 'https://evo.example.com',
          evolutionApiKey: 'test-key',
        },
        webhookToken: 'webhook-token',
      });
    });

    it('should fire deactivated event when platform is deactivated', async () => {
      const projectId = 'test-project';
      const platformId = 'platform-id';
      const updateDto = { isActive: false };

      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-id',
      });
      mockPrismaService.projectPlatform.findFirst.mockResolvedValue({
        id: platformId,
        platform: 'whatsapp-evo',
        isActive: true, // Was active
        credentialsEncrypted:
          'encrypted_{"evolutionApiUrl":"https://evo.example.com","evolutionApiKey":"test-key"}',
      });
      mockPrismaService.projectPlatform.update.mockResolvedValue({
        id: platformId,
        platform: 'whatsapp-evo',
        isActive: false, // Now inactive
        webhookToken: 'webhook-token',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.update(projectId, platformId, updateDto);

      expect(mockProvider.onPlatformEvent).toHaveBeenCalledWith({
        type: 'deactivated',
        projectId: 'project-id',
        platformId: 'platform-id',
        platform: 'whatsapp-evo',
        credentials: {
          evolutionApiUrl: 'https://evo.example.com',
          evolutionApiKey: 'test-key',
        },
        webhookToken: 'webhook-token',
      });
    });

    it('should fire deleted event when platform is removed', async () => {
      const projectId = 'test-project';
      const platformId = 'platform-id';

      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-id',
      });
      mockPrismaService.projectPlatform.findFirst.mockResolvedValue({
        id: platformId,
        platform: 'whatsapp-evo',
        credentialsEncrypted:
          'encrypted_{"evolutionApiUrl":"https://evo.example.com","evolutionApiKey":"test-key"}',
        webhookToken: 'webhook-token',
      });

      await service.remove(projectId, platformId);

      expect(mockProvider.onPlatformEvent).toHaveBeenCalledWith({
        type: 'deleted',
        projectId: 'project-id',
        platformId: 'platform-id',
        platform: 'whatsapp-evo',
        credentials: {
          evolutionApiUrl: 'https://evo.example.com',
          evolutionApiKey: 'test-key',
        },
        webhookToken: 'webhook-token',
      });
    });

    it('should handle missing provider gracefully', async () => {
      mockPlatformRegistry.getProvider.mockReturnValue(null);

      const projectId = 'test-project';
      const createDto = {
        platform: 'unknown-platform',
        credentials: {},
        isActive: true,
      };

      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-id',
      });
      mockPrismaService.projectPlatform.create.mockResolvedValue({
        id: 'platform-id',
        platform: 'unknown-platform',
        isActive: true,
        webhookToken: 'webhook-token',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Should not throw even if provider doesn't exist
      await expect(
        service.create(projectId, createDto, mockAuthContext),
      ).resolves.toBeDefined();
    });

    it('should handle provider without onPlatformEvent method', async () => {
      const providerWithoutEvents = { name: 'simple-provider' };
      mockPlatformRegistry.getProvider.mockReturnValue(providerWithoutEvents);

      const projectId = 'test-project';
      const createDto = {
        platform: 'simple-platform',
        credentials: {},
        isActive: true,
      };

      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-id',
      });
      mockPrismaService.projectPlatform.create.mockResolvedValue({
        id: 'platform-id',
        platform: 'simple-platform',
        isActive: true,
        webhookToken: 'webhook-token',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Should not throw even if provider doesn't support events
      await expect(
        service.create(projectId, createDto, mockAuthContext),
      ).resolves.toBeDefined();
    });
  });

  describe('getDecryptedCredentials', () => {
    it('should return decrypted credentials for active platform', async () => {
      const projectId = 'project-id';
      const platform = 'discord';
      const mockCredentials = { token: 'discord-token' };

      mockPrismaService.projectPlatform.findFirst.mockResolvedValue({
        credentialsEncrypted: `encrypted_${JSON.stringify(mockCredentials)}`,
        isActive: true,
      });

      const result = await service.getDecryptedCredentials(projectId, platform);

      expect(result).toEqual(mockCredentials);
    });

    it('should throw NotFoundException when platform not configured', async () => {
      mockPrismaService.projectPlatform.findFirst.mockResolvedValue(null);

      await expect(
        service.getDecryptedCredentials('project-id', 'discord'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when platform is not active', async () => {
      // Inactive platforms are filtered out by the query, so they appear as "not found"
      mockPrismaService.projectPlatform.findFirst.mockResolvedValue(null);

      await expect(
        service.getDecryptedCredentials('project-id', 'discord'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
