import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthService', () => {
  let service: HealthService;
  let prisma: PrismaService;

  const mockPrisma = {
    user: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('check', () => {
    it('should return healthy status with setupRequired true when no users exist', async () => {
      mockPrisma.user.count.mockResolvedValue(0);

      const result = await service.check();

      expect(result.status).toBe('healthy');
      expect(result.setupRequired).toBe(true);
      expect(result.version).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(mockPrisma.user.count).toHaveBeenCalledWith({
        where: {
          passwordHash: {
            not: null,
          },
        },
      });
    });

    it('should return healthy status with setupRequired false when users exist', async () => {
      mockPrisma.user.count.mockResolvedValue(1);

      const result = await service.check();

      expect(result.status).toBe('healthy');
      expect(result.setupRequired).toBe(false);
      expect(result.version).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should return setupRequired false when multiple users exist', async () => {
      mockPrisma.user.count.mockResolvedValue(5);

      const result = await service.check();

      expect(result.setupRequired).toBe(false);
    });

    it('should only count users with passwordHash set', async () => {
      mockPrisma.user.count.mockResolvedValue(0);

      await service.check();

      expect(mockPrisma.user.count).toHaveBeenCalledWith({
        where: {
          passwordHash: {
            not: null,
          },
        },
      });
    });
  });
});
