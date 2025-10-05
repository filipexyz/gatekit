import { Test, TestingModule } from '@nestjs/testing';
import { LocalAuthService } from './local-auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('LocalAuthService - Update Password', () => {
  let service: LocalAuthService;
  let prisma: PrismaService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
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
  });

  describe('updatePassword', () => {
    const userId = 'user-id-123';
    const currentPassword = 'OldPass123';
    const newPassword = 'NewPass456';
    const passwordHash = 'hashed-old-password';

    const mockUser = {
      id: userId,
      email: 'user@example.com',
      passwordHash,
      name: 'Test User',
      isAdmin: false,
    };

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePassword(userId, {
          currentPassword,
          newPassword,
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
    });

    it('should throw UnauthorizedException if user has no password set', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        passwordHash: null,
      });

      await expect(
        service.updatePassword(userId, {
          currentPassword,
          newPassword,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if current password is incorrect', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.updatePassword(userId, {
          currentPassword,
          newPassword,
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(bcrypt.compare).toHaveBeenCalledWith(
        currentPassword,
        passwordHash,
      );
    });

    it('should throw BadRequestException if new password is same as current', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true) // Current password correct
        .mockResolvedValueOnce(true); // New password same as current

      await expect(
        service.updatePassword(userId, {
          currentPassword,
          newPassword: currentPassword, // Same password
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully update password', async () => {
      const newPasswordHash = 'hashed-new-password';

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true) // Current password correct
        .mockResolvedValueOnce(false); // New password different
      (bcrypt.hash as jest.Mock).mockResolvedValue(newPasswordHash);
      mockPrisma.user.update.mockResolvedValue({
        ...mockUser,
        passwordHash: newPasswordHash,
      });

      const result = await service.updatePassword(userId, {
        currentPassword,
        newPassword,
      });

      expect(result).toEqual({ message: 'Password updated successfully' });
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 10);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      });
    });

    it('should use correct salt rounds for password hashing', async () => {
      const newPasswordHash = 'hashed-new-password';

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      (bcrypt.hash as jest.Mock).mockResolvedValue(newPasswordHash);
      mockPrisma.user.update.mockResolvedValue(mockUser);

      await service.updatePassword(userId, {
        currentPassword,
        newPassword,
      });

      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 10);
    });
  });
});
