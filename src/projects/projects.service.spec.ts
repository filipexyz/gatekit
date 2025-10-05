import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ProjectRole, ProjectEnvironment } from '@prisma/client';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prisma: PrismaService;

  const mockUser = {
    id: 'user-1',
    auth0Id: 'auth0|123456789',
    email: 'test@example.com',
    name: 'Test User',
    isAdmin: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAdminUser = {
    id: 'admin-1',
    auth0Id: 'auth0|admin123',
    email: 'admin@example.com',
    name: 'Admin User',
    isAdmin: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProject = {
    id: 'project-1',
    name: 'Test Project',
    slug: 'test-project',
    ownerId: 'user-1',
    environment: ProjectEnvironment.development,
    isDefault: false,
    settings: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    owner: {
      id: mockUser.id,
      email: mockUser.email,
      name: mockUser.name,
    },
    _count: {
      apiKeys: 0,
      projectPlatforms: 0,
      members: 0,
    },
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
    project: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    apiKey: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    prisma = module.get<PrismaService>(PrismaService);

    // Reset all mocks
    Object.values(mockPrismaService.user).forEach((mockFn) => {
      mockFn.mockReset();
    });
    Object.values(mockPrismaService.project).forEach((mockFn) => {
      mockFn.mockReset();
    });
    mockPrismaService.apiKey.count.mockReset();
  });

  describe('create', () => {
    const createDto = {
      name: 'New Project',
      environment: ProjectEnvironment.development,
      isDefault: false,
    };

    it('should create a new project successfully', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null); // No existing project
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.project.create.mockResolvedValue(mockProject);

      const result = await service.create(createDto, 'user-1');

      expect(mockPrismaService.project.create).toHaveBeenCalledWith({
        data: {
          name: createDto.name,
          id: expect.any(String),
          environment: createDto.environment,
          isDefault: createDto.isDefault,
          settings: undefined,
          ownerId: 'user-1',
          members: {
            create: {
              userId: 'user-1',
              role: 'owner',
            },
          },
        },
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          _count: {
            select: {
              apiKeys: true,
              projectPlatforms: true,
              members: true,
            },
          },
        },
      });
      expect(result).toEqual(mockProject);
    });

    it('should throw ConflictException if project slug already exists', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      await expect(service.create(createDto, 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException if owner does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update default projects when creating a default project', async () => {
      const defaultDto = { ...createDto, isDefault: true };

      mockPrismaService.project.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.project.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.project.create.mockResolvedValue({
        ...mockProject,
        isDefault: true,
      });

      await service.create(defaultDto, 'user-1');

      expect(mockPrismaService.project.updateMany).toHaveBeenCalledWith({
        where: {
          isDefault: true,
          ownerId: 'user-1',
        },
        data: { isDefault: false },
      });
    });
  });

  describe('findAllForUser', () => {
    it('should return all projects for admin users', async () => {
      const allProjects = [mockProject];
      mockPrismaService.project.findMany.mockResolvedValue(allProjects);

      const result = await service.findAllForUser('admin-1', true);

      expect(mockPrismaService.project.findMany).toHaveBeenCalledWith({
        include: expect.objectContaining({
          owner: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        }),
      });
      expect(result).toEqual(allProjects);
    });

    it('should return only accessible projects for regular users', async () => {
      const accessibleProjects = [mockProject];
      mockPrismaService.project.findMany.mockResolvedValue(accessibleProjects);

      const result = await service.findAllForUser('user-1', false);

      expect(mockPrismaService.project.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { ownerId: 'user-1' },
            { members: { some: { userId: 'user-1' } } },
          ],
        },
        include: expect.objectContaining({
          owner: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        }),
      });
      expect(result).toEqual(accessibleProjects);
    });
  });

  describe('findOne', () => {
    it('should return project with active API keys', async () => {
      const project = {
        id: 'project-id',
        name: 'Test Project',
        slug: 'test-project',
        apiKeys: [],
        _count: { apiKeys: 2, projectPlatforms: 1 },
      };

      mockPrismaService.project.findUnique.mockResolvedValue(project);

      const result = await service.findOne('test-project');

      expect(mockPrismaService.project.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-project' },
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          apiKeys: {
            where: { revokedAt: null },
            select: expect.any(Object),
          },
          _count: {
            select: {
              apiKeys: true,
              projectPlatforms: true,
            },
          },
        },
      });
      expect(result).toEqual(project);
    });

    it('should throw NotFoundException when project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update project successfully', async () => {
      const updateDto = { name: 'Updated Name' };
      const existingProject = { id: 'project-id', slug: 'test-project' };
      const updatedProject = { ...existingProject, name: 'Updated Name' };

      mockPrismaService.project.findUnique.mockResolvedValue(existingProject);
      mockPrismaService.project.update.mockResolvedValue(updatedProject);

      const result = await service.update('test-project', updateDto);

      expect(result).toEqual(updatedProject);
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when updating to existing id', async () => {
      const updateDto = { id: 'existing-id' };

      mockPrismaService.project.findUnique
        .mockResolvedValueOnce({ id: 'test-project' })
        .mockResolvedValueOnce({ id: 'existing-id' });

      await expect(service.update('test-project', updateDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('remove', () => {
    it('should remove project successfully for owner', async () => {
      const projectToDelete = {
        ...mockProject,
        _count: { apiKeys: 0 },
      };

      mockPrismaService.project.findUnique.mockResolvedValue(projectToDelete);
      mockPrismaService.project.delete.mockResolvedValue(projectToDelete);

      const result = await service.remove('test-project', 'user-1', false);

      expect(mockPrismaService.project.delete).toHaveBeenCalledWith({
        where: { id: 'test-project' },
      });
      expect(result).toEqual(projectToDelete);
    });

    it('should remove project successfully for admin', async () => {
      const projectToDelete = {
        ...mockProject,
        ownerId: 'other-user',
        _count: { apiKeys: 0 },
      };

      mockPrismaService.project.findUnique.mockResolvedValue(projectToDelete);
      mockPrismaService.project.delete.mockResolvedValue(projectToDelete);

      const result = await service.remove('test-project', 'admin-1', true);

      expect(result).toEqual(projectToDelete);
    });

    it('should throw ForbiddenException if non-owner tries to delete', async () => {
      const projectToDelete = {
        ...mockProject,
        ownerId: 'other-user',
        _count: { apiKeys: 0 },
      };

      mockPrismaService.project.findUnique.mockResolvedValue(projectToDelete);

      await expect(
        service.remove('test-project', 'user-1', false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if project has active API keys', async () => {
      const projectWithKeys = {
        ...mockProject,
        _count: { apiKeys: 2 },
      };

      mockPrismaService.project.findUnique.mockResolvedValue(projectWithKeys);
      mockPrismaService.apiKey.count.mockResolvedValue(2);

      await expect(
        service.remove('test-project', 'user-1', false),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(
        service.remove('nonexistent', 'user-1', false),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('checkProjectAccess', () => {
    it('should return true for global admin', async () => {
      const result = await service.checkProjectAccess(
        'admin-1',
        'test-project',
        undefined,
        true,
      );

      expect(result).toBe(true);
      expect(mockPrismaService.project.findUnique).not.toHaveBeenCalled();
    });

    it('should return true for project owner', async () => {
      const projectWithOwner = {
        ...mockProject,
        members: [],
      };

      mockPrismaService.project.findUnique.mockResolvedValue(projectWithOwner);

      const result = await service.checkProjectAccess(
        'user-1',
        'test-project',
        undefined,
        false,
      );

      expect(result).toBe(true);
    });

    it('should return true for member with sufficient role', async () => {
      const projectWithMember = {
        ...mockProject,
        ownerId: 'other-user',
        members: [
          {
            userId: 'user-1',
            role: ProjectRole.admin,
          },
        ],
      };

      mockPrismaService.project.findUnique.mockResolvedValue(projectWithMember);

      const result = await service.checkProjectAccess(
        'user-1',
        'test-project',
        ProjectRole.member,
        false,
      );

      expect(result).toBe(true);
    });

    it('should return false for member with insufficient role', async () => {
      const projectWithMember = {
        ...mockProject,
        ownerId: 'other-user',
        members: [
          {
            userId: 'user-1',
            role: ProjectRole.viewer,
          },
        ],
      };

      mockPrismaService.project.findUnique.mockResolvedValue(projectWithMember);

      const result = await service.checkProjectAccess(
        'user-1',
        'test-project',
        ProjectRole.admin,
        false,
      );

      expect(result).toBe(false);
    });

    it('should return false for non-member', async () => {
      const projectWithoutMember = {
        ...mockProject,
        ownerId: 'other-user',
        members: [],
      };

      mockPrismaService.project.findUnique.mockResolvedValue(
        projectWithoutMember,
      );

      const result = await service.checkProjectAccess(
        'user-1',
        'test-project',
        undefined,
        false,
      );

      expect(result).toBe(false);
    });

    it('should return false for nonexistent project', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      const result = await service.checkProjectAccess(
        'user-1',
        'nonexistent',
        undefined,
        false,
      );

      expect(result).toBe(false);
    });
  });

  describe('role hierarchy', () => {
    const testCases = [
      {
        userRole: ProjectRole.owner,
        requiredRole: ProjectRole.admin,
        expected: true,
      },
      {
        userRole: ProjectRole.admin,
        requiredRole: ProjectRole.member,
        expected: true,
      },
      {
        userRole: ProjectRole.member,
        requiredRole: ProjectRole.viewer,
        expected: true,
      },
      {
        userRole: ProjectRole.viewer,
        requiredRole: ProjectRole.member,
        expected: false,
      },
      {
        userRole: ProjectRole.member,
        requiredRole: ProjectRole.admin,
        expected: false,
      },
      {
        userRole: ProjectRole.admin,
        requiredRole: ProjectRole.owner,
        expected: false,
      },
    ];

    testCases.forEach(({ userRole, requiredRole, expected }) => {
      it(`should return ${expected} when user has ${userRole} role and ${requiredRole} is required`, async () => {
        const projectWithMember = {
          ...mockProject,
          ownerId: 'other-user',
          members: [
            {
              userId: 'user-1',
              role: userRole,
            },
          ],
        };

        mockPrismaService.project.findUnique.mockResolvedValue(
          projectWithMember,
        );

        const result = await service.checkProjectAccess(
          'user-1',
          'test-project',
          requiredRole,
          false,
        );

        expect(result).toBe(expected);
      });
    });
  });
});
