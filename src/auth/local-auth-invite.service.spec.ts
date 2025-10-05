import { Test, TestingModule } from '@nestjs/testing';
import { LocalAuthService } from './local-auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('LocalAuthService - Accept Invite', () => {
  let service: LocalAuthService;
  let prisma: PrismaService;

  const mockPrisma = {
    invite: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    projectMember: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-jwt-secret'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalAuthService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<LocalAuthService>(LocalAuthService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
  });

  describe('acceptInvite', () => {
    const validToken = 'valid-token-123';
    const validInvite = {
      id: 'invite-id',
      email: 'newuser@example.com',
      projectId: 'test-project',
      token: validToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      project: {
        id: 'test-project',
        name: 'Test Project',
      },
    };

    it('should throw UnauthorizedException if invite not found', async () => {
      mockPrisma.invite.findUnique.mockResolvedValue(null);

      await expect(
        service.acceptInvite('invalid-token', 'John Doe', 'Password123'),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockPrisma.invite.findUnique).toHaveBeenCalledWith({
        where: { token: 'invalid-token' },
        include: { project: true },
      });
    });

    it('should throw UnauthorizedException if invite is expired', async () => {
      const expiredInvite = {
        ...validInvite,
        expiresAt: new Date(Date.now() - 1000), // 1 second ago
      };

      mockPrisma.invite.findUnique.mockResolvedValue(expiredInvite);
      mockPrisma.invite.delete.mockResolvedValue(expiredInvite);

      await expect(
        service.acceptInvite(validToken, 'John Doe', 'Password123'),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockPrisma.invite.delete).toHaveBeenCalledWith({
        where: { token: validToken },
      });
    });

    it('should throw ConflictException if user already exists', async () => {
      const existingUser = {
        id: 'existing-user-id',
        email: 'newuser@example.com',
      };

      mockPrisma.invite.findUnique.mockResolvedValue(validInvite);
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);

      await expect(
        service.acceptInvite(validToken, 'John Doe', 'Password123'),
      ).rejects.toThrow(ConflictException);
    });

    it('should create user and add to project successfully', async () => {
      const newUser = {
        id: 'new-user-id',
        email: 'newuser@example.com',
        name: 'John Doe',
        passwordHash: 'hashed-password',
        isAdmin: false,
      };

      mockPrisma.invite.findUnique.mockResolvedValue(validInvite);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          user: {
            create: jest.fn().mockResolvedValue(newUser),
          },
          projectMember: {
            create: jest.fn().mockResolvedValue({
              projectId: 'test-project',
              userId: 'new-user-id',
              role: 'member',
            }),
          },
          invite: {
            delete: jest.fn().mockResolvedValue(validInvite),
          },
        });
      });

      const result = await service.acceptInvite(
        validToken,
        'John Doe',
        'Password123',
      );

      expect(result).toEqual({
        accessToken: 'mock-jwt-token',
        user: {
          id: 'new-user-id',
          email: 'newuser@example.com',
          name: 'John Doe',
          isAdmin: false,
        },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith('Password123', 10);
    });

    it('should hash password with correct salt rounds', async () => {
      const newUser = {
        id: 'new-user-id',
        email: 'newuser@example.com',
        name: 'John Doe',
        passwordHash: 'hashed-password',
        isAdmin: false,
      };

      mockPrisma.invite.findUnique.mockResolvedValue(validInvite);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          user: {
            create: jest.fn().mockResolvedValue(newUser),
          },
          projectMember: {
            create: jest.fn().mockResolvedValue({
              projectId: 'test-project',
              userId: 'new-user-id',
              role: 'member',
            }),
          },
          invite: {
            delete: jest.fn().mockResolvedValue(validInvite),
          },
        });
      });

      await service.acceptInvite(validToken, 'John Doe', 'SecurePass123');

      expect(bcrypt.hash).toHaveBeenCalledWith('SecurePass123', 10);
    });

    it('should create user as non-admin', async () => {
      const newUser = {
        id: 'new-user-id',
        email: 'newuser@example.com',
        name: 'John Doe',
        passwordHash: 'hashed-password',
        isAdmin: false,
      };

      let capturedUserData: any;

      mockPrisma.invite.findUnique.mockResolvedValue(validInvite);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          user: {
            create: jest.fn().mockImplementation((data) => {
              capturedUserData = data.data;
              return Promise.resolve(newUser);
            }),
          },
          projectMember: {
            create: jest.fn().mockResolvedValue({
              projectId: 'test-project',
              userId: 'new-user-id',
              role: 'member',
            }),
          },
          invite: {
            delete: jest.fn().mockResolvedValue(validInvite),
          },
        });
      });

      await service.acceptInvite(validToken, 'John Doe', 'Password123');

      expect(capturedUserData.isAdmin).toBe(false);
    });
  });
});
