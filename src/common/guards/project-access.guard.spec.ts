import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ProjectAccessGuard } from './project-access.guard';
import { PrismaService } from '../../prisma/prisma.service';

describe('ProjectAccessGuard', () => {
  let guard: ProjectAccessGuard;
  let prismaService: jest.Mocked<PrismaService>;

  const mockProject = {
    id: 'project-123',
    slug: 'test-project',
    name: 'Test Project',
    environment: 'production',
  };

  const mockApiKeyProject = {
    id: 'project-123',
    slug: 'test-project',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectAccessGuard,
        {
          provide: PrismaService,
          useValue: {
            project: {
              findUnique: jest.fn(),
            },
            projectMember: {
              findFirst: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    guard = module.get<ProjectAccessGuard>(ProjectAccessGuard);
    prismaService = module.get(PrismaService);
  });

  const createMockContext = (request: any): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as ExecutionContext;

  describe('API Key Authentication', () => {
    it('should allow access when API key belongs to target project', async () => {
      const request = {
        params: { project: 'test-project' },
        authType: 'api-key',
        project: mockApiKeyProject,
      };

      prismaService.project.findUnique.mockResolvedValue(mockProject);

      const result = await guard.canActivate(createMockContext(request));

      expect(result).toBe(true);
      expect(request.project).toEqual(mockProject);
      expect(prismaService.project.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-project' },
      });
    });

    it('should deny access when API key belongs to different project', async () => {
      const request = {
        params: { project: 'test-project' },
        authType: 'api-key',
        project: { id: 'different-project-id', slug: 'different-project' },
      };

      prismaService.project.findUnique.mockResolvedValue(mockProject);

      await expect(
        guard.canActivate(createMockContext(request)),
      ).rejects.toThrow(
        new ForbiddenException('API key does not have access to this project'),
      );
    });

    it('should deny access when API key has no project attached', async () => {
      const request = {
        params: { project: 'test-project' },
        authType: 'api-key',
        project: null,
      };

      prismaService.project.findUnique.mockResolvedValue(mockProject);

      await expect(
        guard.canActivate(createMockContext(request)),
      ).rejects.toThrow(
        new ForbiddenException('API key does not have access to this project'),
      );
    });
  });

  describe('JWT Authentication', () => {
    it('should allow access when user is member of target project', async () => {
      const request = {
        params: { project: 'test-project' },
        authType: 'jwt',
        user: { userId: 'user-123', email: 'test@example.com' },
      };

      prismaService.project.findUnique.mockResolvedValue(mockProject);
      prismaService.projectMember.findFirst.mockResolvedValue({
        id: 'member-123',
        projectId: 'project-123',
        userId: 'user-123',
        role: 'owner',
      });

      const result = await guard.canActivate(createMockContext(request));

      expect(result).toBe(true);
      expect(request.project).toEqual(mockProject);
      expect(prismaService.projectMember.findFirst).toHaveBeenCalledWith({
        where: {
          projectId: 'project-123',
          userId: 'user-123',
        },
      });
    });

    it('should deny access when user is not member of target project', async () => {
      const request = {
        params: { project: 'test-project' },
        authType: 'jwt',
        user: { userId: 'user-123', email: 'test@example.com' },
      };

      prismaService.project.findUnique.mockResolvedValue(mockProject);
      prismaService.projectMember.findFirst.mockResolvedValue(null);

      await expect(
        guard.canActivate(createMockContext(request)),
      ).rejects.toThrow(
        new ForbiddenException('You do not have access to this project'),
      );
    });

    it('should deny access when JWT has no userId', async () => {
      const request = {
        params: { project: 'test-project' },
        authType: 'jwt',
        user: { email: 'test@example.com' }, // Missing userId
      };

      prismaService.project.findUnique.mockResolvedValue(mockProject);

      await expect(
        guard.canActivate(createMockContext(request)),
      ).rejects.toThrow(
        new ForbiddenException('User ID not found in JWT token'),
      );
    });

    it('should deny access when user object is missing', async () => {
      const request = {
        params: { project: 'test-project' },
        authType: 'jwt',
        user: null,
      };

      prismaService.project.findUnique.mockResolvedValue(mockProject);

      await expect(
        guard.canActivate(createMockContext(request)),
      ).rejects.toThrow(
        new ForbiddenException('User ID not found in JWT token'),
      );
    });
  });

  describe('Project Validation', () => {
    it('should throw NotFoundException when project does not exist', async () => {
      const request = {
        params: { project: 'non-existent-project' },
        authType: 'api-key',
        project: mockApiKeyProject,
      };

      prismaService.project.findUnique.mockResolvedValue(null);

      await expect(
        guard.canActivate(createMockContext(request)),
      ).rejects.toThrow(
        new NotFoundException("Project 'non-existent-project' not found"),
      );
    });

    it('should throw ForbiddenException when project is missing', async () => {
      const request = {
        params: {}, // Missing project
        authType: 'api-key',
        project: mockApiKeyProject,
      };

      await expect(
        guard.canActivate(createMockContext(request)),
      ).rejects.toThrow(new ForbiddenException('Project is required'));
    });
  });

  describe('Authentication Type Validation', () => {
    it('should deny access for invalid authentication type', async () => {
      const request = {
        params: { project: 'test-project' },
        authType: 'invalid-auth-type',
      };

      prismaService.project.findUnique.mockResolvedValue(mockProject);

      await expect(
        guard.canActivate(createMockContext(request)),
      ).rejects.toThrow(new ForbiddenException('Invalid authentication type'));
    });

    it('should deny access when authType is missing', async () => {
      const request = {
        params: { project: 'test-project' },
        // Missing authType
      };

      prismaService.project.findUnique.mockResolvedValue(mockProject);

      await expect(
        guard.canActivate(createMockContext(request)),
      ).rejects.toThrow(new ForbiddenException('Invalid authentication type'));
    });
  });

  describe('Database Error Handling', () => {
    it('should propagate database errors when finding project', async () => {
      const request = {
        params: { project: 'test-project' },
        authType: 'api-key',
        project: mockApiKeyProject,
      };

      const dbError = new Error('Database connection failed');
      prismaService.project.findUnique.mockRejectedValue(dbError);

      await expect(
        guard.canActivate(createMockContext(request)),
      ).rejects.toThrow(dbError);
    });

    it('should propagate database errors when checking project membership', async () => {
      const request = {
        params: { project: 'test-project' },
        authType: 'jwt',
        user: { userId: 'user-123', email: 'test@example.com' },
      };

      const dbError = new Error('Database connection failed');
      prismaService.project.findUnique.mockResolvedValue(mockProject);
      prismaService.projectMember.findFirst.mockRejectedValue(dbError);

      await expect(
        guard.canActivate(createMockContext(request)),
      ).rejects.toThrow(dbError);
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined project parameter', async () => {
      const request = {
        params: { project: undefined },
        authType: 'api-key',
        project: mockApiKeyProject,
      };

      await expect(
        guard.canActivate(createMockContext(request)),
      ).rejects.toThrow(new ForbiddenException('Project is required'));
    });

    it('should handle empty string project parameter', async () => {
      const request = {
        params: { project: '' },
        authType: 'api-key',
        project: mockApiKeyProject,
      };

      await expect(
        guard.canActivate(createMockContext(request)),
      ).rejects.toThrow(new ForbiddenException('Project is required'));
    });

    it('should handle case-sensitive project slug matching', async () => {
      const request = {
        params: { project: 'Test-Project' }, // Different casing
        authType: 'api-key',
        project: mockApiKeyProject,
      };

      prismaService.project.findUnique.mockResolvedValue(null); // Not found due to case sensitivity

      await expect(
        guard.canActivate(createMockContext(request)),
      ).rejects.toThrow(
        new NotFoundException("Project 'Test-Project' not found"),
      );
    });
  });
});
