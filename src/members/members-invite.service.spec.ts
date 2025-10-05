import { Test, TestingModule } from '@nestjs/testing';
import { MembersService } from './members.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProjectRole } from '@prisma/client';

describe('MembersService - Invite System', () => {
  let service: MembersService;
  let prisma: PrismaService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
    },
    project: {
      findUnique: jest.fn(),
    },
    projectMember: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    invite: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembersService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<MembersService>(MembersService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('createInvite', () => {
    const projectId = 'test-project';
    const requesterId = 'requester-id';
    const baseUrl = 'https://app.example.com';

    it('should throw NotFoundException if requester has no access', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.createInvite(
          projectId,
          'user@example.com',
          requesterId,
          baseUrl,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if requester is not a member of the project', async () => {
      const mockProject = {
        id: projectId,
        ownerId: 'different-owner-id',
        members: [], // Requester is NOT a member
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);

      await expect(
        service.createInvite(
          projectId,
          'user@example.com',
          requesterId,
          baseUrl,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user is already a member', async () => {
      const mockProject = {
        id: projectId,
        ownerId: requesterId,
        members: [],
      };

      const mockExistingUser = {
        id: 'existing-user-id',
        email: 'user@example.com',
      };

      const mockExistingMember = {
        projectId,
        userId: 'existing-user-id',
        role: ProjectRole.member,
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.user.findUnique.mockResolvedValue(mockExistingUser);
      mockPrisma.projectMember.findUnique.mockResolvedValue(mockExistingMember);

      await expect(
        service.createInvite(
          projectId,
          'user@example.com',
          requesterId,
          baseUrl,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.projectMember.findUnique).toHaveBeenCalledWith({
        where: {
          projectId_userId: {
            projectId,
            userId: 'existing-user-id',
          },
        },
      });
    });

    it('should add existing user directly to project', async () => {
      const mockProject = {
        id: projectId,
        ownerId: requesterId,
        members: [],
      };

      const mockExistingUser = {
        id: 'existing-user-id',
        email: 'user@example.com',
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.user.findUnique.mockResolvedValue(mockExistingUser);
      mockPrisma.projectMember.findUnique.mockResolvedValue(null);
      mockPrisma.projectMember.create.mockResolvedValue({
        projectId,
        userId: 'existing-user-id',
        role: ProjectRole.member,
      });

      const result = await service.createInvite(
        projectId,
        'user@example.com',
        requesterId,
        baseUrl,
      );

      expect(result.inviteLink).toBeNull();
      expect(result.email).toBe('user@example.com');
      expect(result.message).toBe('User added to project successfully');
      expect(mockPrisma.projectMember.create).toHaveBeenCalledWith({
        data: {
          projectId,
          userId: 'existing-user-id',
          role: ProjectRole.member,
        },
      });
    });

    it('should create invite for new user', async () => {
      const mockProject = {
        id: projectId,
        ownerId: requesterId,
        members: [],
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.invite.create.mockResolvedValue({
        id: 'invite-id',
        email: 'newuser@example.com',
        projectId,
        token: 'generated-token',
        expiresAt: new Date(),
      });

      const result = await service.createInvite(
        projectId,
        'newuser@example.com',
        requesterId,
        baseUrl,
      );

      expect(result.inviteLink).toContain(baseUrl);
      expect(result.inviteLink).toContain('/invite/');
      expect(result.email).toBe('newuser@example.com');
      expect(result.expiresAt).toBeDefined();
      expect(mockPrisma.invite.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'newuser@example.com',
          projectId,
          token: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('should allow project members to create invites', async () => {
      const mockProject = {
        id: projectId,
        ownerId: 'different-owner',
        members: [
          {
            userId: requesterId,
            role: ProjectRole.member,
          },
        ],
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.invite.create.mockResolvedValue({
        id: 'invite-id',
        email: 'newuser@example.com',
        projectId,
        token: 'generated-token',
        expiresAt: new Date(),
      });

      const result = await service.createInvite(
        projectId,
        'newuser@example.com',
        requesterId,
        baseUrl,
      );

      expect(result.inviteLink).toBeDefined();
      expect(result.email).toBe('newuser@example.com');
    });
  });
});
