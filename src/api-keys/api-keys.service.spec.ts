import { Test, TestingModule } from '@nestjs/testing';
import { ApiKeysService } from './api-keys.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { CryptoUtil } from '../common/utils/crypto.util';

jest.mock('../common/utils/crypto.util', () => ({
  CryptoUtil: {
    generateApiKey: jest.fn(),
    hashApiKey: jest.fn(),
    getKeyPrefix: jest.fn(),
    getKeySuffix: jest.fn(),
    maskApiKey: jest.fn((prefix, suffix) => `${prefix}...${suffix}`),
  },
}));

describe('ApiKeysService', () => {
  let service: ApiKeysService;

  const mockAuthContext = {
    authType: 'api-key' as const,
    project: { id: 'project-id' },
  };

  const mockPrismaService = {
    project: {
      findUnique: jest.fn(),
    },
    apiKey: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeysService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ApiKeysService>(ApiKeysService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create API key with specified scopes', async () => {
      const projectId = 'test-project';
      const createDto = {
        name: 'Test Key',
        scopes: ['messages:write', 'messages:read'],
      };

      const mockProject = {
        id: 'project-id',

        environment: 'development',
      };
      const mockApiKey = 'gk_test_abc123';
      const mockKeyHash = 'hashed_key';
      const mockKeyPrefix = 'gk_test_abc1';

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      (CryptoUtil.generateApiKey as jest.Mock).mockReturnValue(mockApiKey);
      (CryptoUtil.hashApiKey as jest.Mock).mockReturnValue(mockKeyHash);
      (CryptoUtil.getKeyPrefix as jest.Mock).mockReturnValue(mockKeyPrefix);
      (CryptoUtil.getKeySuffix as jest.Mock).mockReturnValue('wxyz');

      mockPrismaService.apiKey.create.mockResolvedValue({
        id: 'key-id',
        name: 'Test Key',
        keyPrefix: mockKeyPrefix,
        keySuffix: 'wxyz',
        environment: 'test',
        expiresAt: null,
        createdAt: new Date(),
        scopes: [{ scope: 'messages:write' }, { scope: 'messages:read' }],
      });

      const result = await service.create(
        projectId,
        createDto,
        mockAuthContext,
      );

      expect(result).toHaveProperty('key', mockApiKey);
      expect(result).toHaveProperty('id', 'key-id');
      expect(result.scopes).toEqual(['messages:write', 'messages:read']);
      expect(mockPrismaService.apiKey.create).toHaveBeenCalledWith({
        data: {
          projectId: 'project-id',
          keyHash: mockKeyHash,
          keyPrefix: mockKeyPrefix,
          keySuffix: 'wxyz',
          name: 'Test Key',
          expiresAt: null,
          createdBy: undefined,
          scopes: {
            create: [{ scope: 'messages:write' }, { scope: 'messages:read' }],
          },
        },
        include: { scopes: true },
      });
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          'non-existent',
          {
            name: 'Test',
            scopes: ['messages:write'],
          },
          mockAuthContext,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should set expiration date when expiresInDays provided', async () => {
      const createDto = {
        name: 'Test Key',
        scopes: ['messages:write'],
        expiresInDays: 30,
      };

      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-id',
        environment: 'test',
      });
      (CryptoUtil.generateApiKey as jest.Mock).mockReturnValue('gk_test_key');
      (CryptoUtil.hashApiKey as jest.Mock).mockReturnValue('hash');
      (CryptoUtil.getKeyPrefix as jest.Mock).mockReturnValue('gk_test_');
      (CryptoUtil.getKeySuffix as jest.Mock).mockReturnValue('wxyz');

      mockPrismaService.apiKey.create.mockResolvedValue({
        id: 'key-id',
        expiresAt: new Date(),
        scopes: [],
      });

      await service.create('test-project', createDto, mockAuthContext);

      expect(mockPrismaService.apiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt: expect.any(Date),
        }) as Record<string, unknown>,
        include: { scopes: true },
      });
    });
  });

  describe('findAll', () => {
    it('should return masked API keys for a project', async () => {
      const projectId = 'test-project';
      const mockProject = {
        id: 'project-id',

        environment: 'development',
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.apiKey.findMany.mockResolvedValue([
        {
          id: 'key-1',
          name: 'Key 1',
          keyPrefix: 'gk_test_abcd',
          keySuffix: 'abcd',
          environment: 'test',
          lastUsedAt: null,
          expiresAt: null,
          createdAt: new Date(),
          scopes: [{ scope: 'messages:write' }],
        },
      ]);

      const result = await service.findAll(projectId, mockAuthContext);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('maskedKey');
      expect(result[0].maskedKey).toBe('gk_test_abcd...abcd');
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(
        service.findAll('non-existent', mockAuthContext),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('revoke', () => {
    it('should revoke an active API key', async () => {
      const projectId = 'test-project';
      const keyId = 'key-id';

      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-id',
        environment: 'test',
      });
      mockPrismaService.apiKey.findFirst.mockResolvedValue({
        id: keyId,
        revokedAt: null,
      });
      mockPrismaService.apiKey.update.mockResolvedValue({});

      const result = await service.revoke(projectId, keyId, mockAuthContext);

      expect(mockPrismaService.apiKey.update).toHaveBeenCalledWith({
        where: { id: keyId },
        data: { revokedAt: expect.any(Date) as Date },
      });
      expect(result.message).toBe('API key revoked successfully');
    });

    it('should return message when key already revoked', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-id',
        environment: 'test',
      });
      mockPrismaService.apiKey.findFirst.mockResolvedValue({
        id: 'key-id',
        revokedAt: new Date(),
      });

      const result = await service.revoke(
        'test-project',
        'key-id',
        mockAuthContext,
      );

      expect(result.message).toBe('API key already revoked');
      expect(mockPrismaService.apiKey.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when key does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-id',
        environment: 'test',
      });
      mockPrismaService.apiKey.findFirst.mockResolvedValue(null);

      await expect(
        service.revoke('test-project', 'non-existent', mockAuthContext),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateApiKey', () => {
    it('should validate and return key data for valid API key', async () => {
      const apiKey = 'gk_test_valid';
      const keyHash = 'hashed_valid';

      (CryptoUtil.hashApiKey as jest.Mock).mockReturnValue(keyHash);

      const mockKey = {
        id: 'key-id',
        projectId: 'project-id',
        project: { id: 'project-id', name: 'Test Project' },
        revokedAt: null,
        expiresAt: null,
        scopes: [{ scope: 'messages:write' }],
        environment: 'test',
      };

      mockPrismaService.apiKey.findUnique.mockResolvedValue(mockKey);
      mockPrismaService.apiKey.update.mockResolvedValue({});

      const result = await service.validateApiKey(apiKey);

      expect(result).toEqual({
        id: 'key-id',
        projectId: 'project-id',
        project: mockKey.project,
        scopes: ['messages:write'],
      });

      expect(mockPrismaService.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-id' },
        data: { lastUsedAt: expect.any(Date) as Date },
      });
    });

    it('should return null for non-existent key', async () => {
      (CryptoUtil.hashApiKey as jest.Mock).mockReturnValue('hash');
      mockPrismaService.apiKey.findUnique.mockResolvedValue(null);

      const result = await service.validateApiKey('invalid-key');

      expect(result).toBeNull();
    });

    it('should return null for revoked key', async () => {
      (CryptoUtil.hashApiKey as jest.Mock).mockReturnValue('hash');
      mockPrismaService.apiKey.findUnique.mockResolvedValue({
        id: 'key-id',
        revokedAt: new Date(Date.now() - 86400000), // Revoked yesterday
      });

      const result = await service.validateApiKey('revoked-key');

      expect(result).toBeNull();
    });

    it('should return null for expired key', async () => {
      (CryptoUtil.hashApiKey as jest.Mock).mockReturnValue('hash');
      mockPrismaService.apiKey.findUnique.mockResolvedValue({
        id: 'key-id',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 86400000), // Expired yesterday
      });

      const result = await service.validateApiKey('expired-key');

      expect(result).toBeNull();
    });
  });
});
