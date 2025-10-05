import { Test, TestingModule } from '@nestjs/testing';
import { MembersService } from './members.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProjectRole } from '@prisma/client';

describe('MembersService', () => {
  let service: MembersService;
  let prisma: jest.Mocked<PrismaService>;

  const mockUser = {
    id: 'user-1',
    auth0Id: 'auth0|123456789',
    email: 'test@example.com',
    name: 'Test User',
    isAdmin: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProject = {
    id: 'project-1',
    name: 'Test Project',
    slug: 'test-project',
    ownerId: 'user-1',
    environment: 'development' as const,
    isDefault: false,
    settings: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProjectMember = {
    id: 'member-1',
    projectId: 'project-1',
    userId: 'user-2',
    role: ProjectRole.member,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
      },
      project: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      projectMember: {
        upsert: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<MembersService>(MembersService);
    prisma = module.get(PrismaService);
  });

  describe('upsertFromAuth0', () => {
    it('should create a new user from Auth0 payload', async () => {
      const auth0Payload = {
        sub: 'auth0|123456789',
        email: 'test@example.com',
        name: 'Test User',
      };

      prisma.user.upsert.mockResolvedValue(mockUser);

      const result = await service.upsertFromAuth0(auth0Payload);

      expect(prisma.user.upsert).toHaveBeenCalledWith({
        where: { auth0Id: auth0Payload.sub },
        update: {
          email: auth0Payload.email,
          name: auth0Payload.name,
        },
        create: {
          auth0Id: auth0Payload.sub,
          email: auth0Payload.email,
          name: auth0Payload.name,
        },
      });
      expect(result).toEqual(mockUser);
    });

    it('should update existing user from Auth0 payload', async () => {
      const auth0Payload = {
        sub: 'auth0|123456789',
        email: 'updated@example.com',
        name: 'Updated User',
      };

      const updatedUser = {
        ...mockUser,
        email: auth0Payload.email,
        name: auth0Payload.name,
      };
      prisma.user.upsert.mockResolvedValue(updatedUser);

      const result = await service.upsertFromAuth0(auth0Payload);

      expect(result.email).toBe(auth0Payload.email);
      expect(result.name).toBe(auth0Payload.name);
    });
  });

  describe('findByAuth0Id', () => {
    it('should find user by Auth0 ID with related data', async () => {
      const userWithRelations = {
        ...mockUser,
        ownedProjects: [mockProject],
        projectMembers: [
          {
            ...mockProjectMember,
            project: mockProject,
          },
        ],
      };

      prisma.user.findUnique.mockResolvedValue(userWithRelations);

      const result = await service.findByAuth0Id('auth0|123456789');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { auth0Id: 'auth0|123456789' },
        include: {
          ownedProjects: true,
          projectMembers: {
            include: {
              project: true,
            },
          },
        },
      });
      expect(result).toEqual(userWithRelations);
    });

    it('should return null if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.findByAuth0Id('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should find user by ID', async () => {
      const userWithRelations = {
        ...mockUser,
        ownedProjects: [mockProject],
        projectMembers: [],
      };

      prisma.user.findUnique.mockResolvedValue(userWithRelations);

      const result = await service.findById('user-1');

      expect(result).toEqual(userWithRelations);
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('checkProjectAccess', () => {
    it('should return true for project owner', async () => {
      const projectWithOwner = {
        ...mockProject,
        owner: mockUser,
        members: [],
      };

      prisma.project.findUnique.mockResolvedValue(projectWithOwner);

      const result = await service.checkProjectAccess('user-1', 'test-project');

      expect(result).toBe(true);
    });

    it('should return true for project member with sufficient role', async () => {
      const projectWithMember = {
        ...mockProject,
        ownerId: 'other-user',
        owner: { ...mockUser, id: 'other-user' },
        members: [
          {
            ...mockProjectMember,
            userId: 'user-1',
            role: ProjectRole.admin,
          },
        ],
      };

      prisma.project.findUnique.mockResolvedValue(projectWithMember);

      const result = await service.checkProjectAccess(
        'user-1',
        'test-project',
        ProjectRole.member,
      );

      expect(result).toBe(true);
    });

    it('should return false for project member with insufficient role', async () => {
      const projectWithMember = {
        ...mockProject,
        ownerId: 'other-user',
        owner: { ...mockUser, id: 'other-user' },
        members: [
          {
            ...mockProjectMember,
            userId: 'user-1',
            role: ProjectRole.viewer,
          },
        ],
      };

      prisma.project.findUnique.mockResolvedValue(projectWithMember);

      const result = await service.checkProjectAccess(
        'user-1',
        'test-project',
        ProjectRole.admin,
      );

      expect(result).toBe(false);
    });

    it('should return false for non-member user', async () => {
      const projectWithoutMember = {
        ...mockProject,
        ownerId: 'other-user',
        owner: { ...mockUser, id: 'other-user' },
        members: [],
      };

      prisma.project.findUnique.mockResolvedValue(projectWithoutMember);

      const result = await service.checkProjectAccess('user-1', 'test-project');

      expect(result).toBe(false);
    });

    it('should return false for nonexistent project', async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      const result = await service.checkProjectAccess('user-1', 'nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getAccessibleProjects', () => {
    it('should return all projects for admin users', async () => {
      const allProjects = [mockProject];
      prisma.project.findMany.mockResolvedValue(allProjects);

      const result = await service.getAccessibleProjects('user-1', true);

      expect(prisma.project.findMany).toHaveBeenCalledWith({
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
      prisma.project.findMany.mockResolvedValue(accessibleProjects);

      const result = await service.getAccessibleProjects('user-1', false);

      expect(prisma.project.findMany).toHaveBeenCalledWith({
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

  describe('addProjectMember', () => {
    it('should add a new member to project', async () => {
      // Mock admin access check
      const projectWithAdminAccess = {
        ...mockProject,
        ownerId: 'user-1',
        owner: mockUser,
        members: [],
      };

      const userToAdd = {
        ...mockUser,
        id: 'user-2',
        email: 'member@example.com',
      };

      const createdMember = {
        ...mockProjectMember,
        role: ProjectRole.member,
        user: {
          id: userToAdd.id,
          email: userToAdd.email,
          name: userToAdd.name,
        },
      };

      prisma.project.findUnique.mockResolvedValue(projectWithAdminAccess);
      prisma.user.findUnique.mockResolvedValue(userToAdd);
      prisma.projectMember.upsert.mockResolvedValue(createdMember);

      const result = await service.addProjectMember(
        'test-project',
        'member@example.com',
        ProjectRole.member,
        'user-1',
      );

      expect(result).toEqual(createdMember);
    });

    it('should throw NotFoundException if requester lacks admin access', async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.addProjectMember(
          'test-project',
          'member@example.com',
          ProjectRole.member,
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if user to add does not exist', async () => {
      const projectWithAdminAccess = {
        ...mockProject,
        ownerId: 'user-1',
        owner: mockUser,
        members: [],
      };

      prisma.project.findUnique.mockResolvedValue(projectWithAdminAccess);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.addProjectMember(
          'test-project',
          'nonexistent@example.com',
          ProjectRole.member,
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeProjectMember', () => {
    it('should remove a member from project', async () => {
      const projectWithAdminAccess = {
        ...mockProject,
        ownerId: 'user-1',
        owner: mockUser,
        members: [],
      };

      prisma.project.findUnique.mockResolvedValue(projectWithAdminAccess);
      prisma.projectMember.delete.mockResolvedValue(mockProjectMember);

      const result = await service.removeProjectMember(
        'test-project',
        'user-2',
        'user-1',
      );

      expect(prisma.projectMember.delete).toHaveBeenCalledWith({
        where: {
          projectId_userId: {
            projectId: 'project-1',
            userId: 'user-2',
          },
        },
      });
      expect(result).toEqual(mockProjectMember);
    });

    it('should throw BadRequestException if trying to remove project owner', async () => {
      const projectWithAdminAccess = {
        ...mockProject,
        ownerId: 'user-2', // user-2 is the owner
        owner: { ...mockUser, id: 'user-2' },
        members: [
          {
            userId: 'user-1',
            role: ProjectRole.admin, // user-1 is admin
          },
        ],
      };

      prisma.project.findUnique.mockResolvedValue(projectWithAdminAccess);

      await expect(
        service.removeProjectMember('test-project', 'user-2', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateProjectMemberRole', () => {
    it('should update member role', async () => {
      const projectWithAdminAccess = {
        ...mockProject,
        ownerId: 'user-1',
        owner: mockUser,
        members: [],
      };

      const updatedMember = {
        ...mockProjectMember,
        role: ProjectRole.admin,
        user: {
          id: 'user-2',
          email: 'member@example.com',
          name: 'Member User',
        },
      };

      prisma.project.findUnique.mockResolvedValue(projectWithAdminAccess);
      prisma.projectMember.update.mockResolvedValue(updatedMember);

      const result = await service.updateProjectMemberRole(
        'test-project',
        'user-2',
        ProjectRole.admin,
        'user-1',
      );

      expect(result).toEqual(updatedMember);
    });

    it('should throw BadRequestException if trying to change owner role', async () => {
      const projectWithAdminAccess = {
        ...mockProject,
        ownerId: 'user-2', // user-2 is the owner
        owner: { ...mockUser, id: 'user-2' },
        members: [
          {
            userId: 'user-1',
            role: ProjectRole.admin, // user-1 is admin
          },
        ],
      };

      prisma.project.findUnique.mockResolvedValue(projectWithAdminAccess);

      await expect(
        service.updateProjectMemberRole(
          'test-project',
          'user-2',
          ProjectRole.member,
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
