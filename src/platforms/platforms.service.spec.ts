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
    project: { id: 'project-id', slug: 'test-project' },
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
      const projectSlug = 'test-project';
      const createDto = {
        platform: 'discord' as any,
        credentials: { token: 'discord-token' },
        isActive: true,
        testMode: false,
      };

      const mockProject = { id: 'project-id', slug: projectSlug };
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.projectPlatform.findUnique.mockResolvedValue(null);
      mockPrismaService.projectPlatform.create.mockResolvedValue({
        id: 'platform-id',
        platform: 'discord',
        credentialsEncrypted: 'encrypted_credentials',
        isActive: true,
        testMode: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(
        projectSlug,
        createDto,
        mockAuthContext,
      );

      expect(result).toHaveProperty('id', 'platform-id');
      expect(result).toHaveProperty('platform', 'discord');
      expect(result).toHaveProperty('isActive', true);
      expect(CryptoUtil.encrypt).toHaveBeenCalledWith(
        JSON.stringify(createDto.credentials),
      );
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          'non-existent',
          {
            platform: 'discord' as any,
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
          credentials: {},
        },
        mockAuthContext,
      );

      expect(result).toHaveProperty('platform', 'discord');
      expect(result).toHaveProperty('id', 'second-discord-instance');
    });
  });

  describe('findAll', () => {
    it('should return all platforms for a project', async () => {
      const projectSlug = 'test-project';
      const mockProject = {
        id: 'project-id',
        slug: projectSlug,
        projectPlatforms: [
          {
            id: 'platform-1',
            platform: 'discord',
            isActive: true,
            testMode: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'platform-2',
            platform: 'telegram',
            isActive: false,
            testMode: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      const result = await service.findAll(projectSlug);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('platform', 'discord');
      expect(result[1]).toHaveProperty('platform', 'telegram');
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
      const projectSlug = 'test-project';
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

      const result = await service.findOne(projectSlug, platformId);

      expect(result).toHaveProperty('credentials');
      expect(result.credentials).toEqual(mockCredentials);
      expect(CryptoUtil.decrypt).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update platform configuration', async () => {
      const projectSlug = 'test-project';
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

      const result = await service.update(projectSlug, platformId, updateDto);

      expect(result).toHaveProperty('isActive', false);
      expect(mockPrismaService.projectPlatform.update).toHaveBeenCalledWith({
        where: { id: platformId },
        data: expect.objectContaining({
          credentialsEncrypted: expect.stringContaining('encrypted_'),
          isActive: false,
        }),
      });
    });
  });

  describe('remove', () => {
    it('should remove platform configuration', async () => {
      const projectSlug = 'test-project';
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

      const result = await service.remove(projectSlug, platformId);

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
      const projectSlug = 'test-project';
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

      await service.create(projectSlug, createDto, mockAuthContext);

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
      const projectSlug = 'test-project';
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

      await service.create(projectSlug, createDto, mockAuthContext);

      expect(mockProvider.onPlatformEvent).not.toHaveBeenCalled();
    });

    it('should fire activated event when platform is activated', async () => {
      const projectSlug = 'test-project';
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

      await service.update(projectSlug, platformId, updateDto);

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
      const projectSlug = 'test-project';
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

      await service.update(projectSlug, platformId, updateDto);

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
      const projectSlug = 'test-project';
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

      await service.remove(projectSlug, platformId);

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

      const projectSlug = 'test-project';
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
        service.create(projectSlug, createDto, mockAuthContext),
      ).resolves.toBeDefined();
    });

    it('should handle provider without onPlatformEvent method', async () => {
      const providerWithoutEvents = { name: 'simple-provider' };
      mockPlatformRegistry.getProvider.mockReturnValue(providerWithoutEvents);

      const projectSlug = 'test-project';
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
        service.create(projectSlug, createDto, mockAuthContext),
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
