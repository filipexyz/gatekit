import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectRole } from '@prisma/client';

export interface Auth0UserPayload {
  sub: string;
  email?: string;
  name?: string;
}

@Injectable()
export class MembersService {
  constructor(private prisma: PrismaService) {}

  async upsertFromAuth0(auth0Payload: Auth0UserPayload) {
    if (!auth0Payload.email) {
      throw new Error('Email is required for Auth0 users');
    }

    const user = await this.prisma.user.upsert({
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

    return user;
  }

  async findByAuth0Id(auth0Id: string) {
    return this.prisma.user.findUnique({
      where: { auth0Id },
      include: {
        ownedProjects: true,
        projectMembers: {
          include: {
            project: true,
          },
        },
      },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        ownedProjects: true,
        projectMembers: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID '${id}' not found`);
    }

    return user;
  }

  async checkProjectAccess(
    userId: string,
    projectId: string,
    requiredRole?: ProjectRole,
  ): Promise<boolean> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: true,
        members: {
          where: { userId },
        },
      },
    });

    if (!project) {
      return false;
    }

    // Check if user is the owner
    if (project.ownerId === userId) {
      return true;
    }

    // Check if user is a member
    const membership = project.members[0];
    if (!membership) {
      return false;
    }

    // If no specific role required, any membership is sufficient
    if (!requiredRole) {
      return true;
    }

    // Role hierarchy: owner > admin > member > viewer
    const roleHierarchy = {
      owner: 4,
      admin: 3,
      member: 2,
      viewer: 1,
    };

    const userRoleLevel = roleHierarchy[membership.role];
    const requiredRoleLevel = roleHierarchy[requiredRole];

    return userRoleLevel >= requiredRoleLevel;
  }

  async getAccessibleProjects(userId: string, isAdmin: boolean = false) {
    if (isAdmin) {
      // Global admins can see all projects
      return this.prisma.project.findMany({
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
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
    }

    // Regular users see only their owned projects and projects they're members of
    return this.prisma.project.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
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
  }

  async addProjectMember(
    projectId: string,
    userEmail: string,
    role: ProjectRole,
    requesterId: string,
  ) {
    // Verify requester has admin access
    const hasAccess = await this.checkProjectAccess(
      requesterId,
      projectId,
      ProjectRole.admin,
    );
    if (!hasAccess) {
      throw new NotFoundException(
        'Project not found or insufficient permissions',
      );
    }

    // Find the user to add
    const userToAdd = await this.prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!userToAdd) {
      throw new NotFoundException(`User with email '${userEmail}' not found`);
    }

    // Get the project
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project '${projectId}' not found`);
    }

    // Add or update membership
    return this.prisma.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId: project.id,
          userId: userToAdd.id,
        },
      },
      update: { role },
      create: {
        projectId: project.id,
        userId: userToAdd.id,
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  async removeProjectMember(
    projectId: string,
    userId: string,
    requesterId: string,
  ) {
    // Verify requester has admin access
    const hasAccess = await this.checkProjectAccess(
      requesterId,
      projectId,
      ProjectRole.admin,
    );
    if (!hasAccess) {
      throw new NotFoundException(
        'Project not found or insufficient permissions',
      );
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project '${projectId}' not found`);
    }

    // Cannot remove the project owner
    if (project.ownerId === userId) {
      throw new BadRequestException('Cannot remove project owner from members');
    }

    return this.prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId: project.id,
          userId,
        },
      },
    });
  }

  async updateProjectMemberRole(
    projectId: string,
    userId: string,
    role: ProjectRole,
    requesterId: string,
  ) {
    // Verify requester has admin access
    const hasAccess = await this.checkProjectAccess(
      requesterId,
      projectId,
      ProjectRole.admin,
    );
    if (!hasAccess) {
      throw new NotFoundException(
        'Project not found or insufficient permissions',
      );
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project '${projectId}' not found`);
    }

    // Cannot change role of project owner
    if (project.ownerId === userId) {
      throw new BadRequestException('Cannot change role of project owner');
    }

    return this.prisma.projectMember.update({
      where: {
        projectId_userId: {
          projectId: project.id,
          userId,
        },
      },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  async getProjectMembers(projectId: string, requesterId: string) {
    // Verify requester has read access
    const hasAccess = await this.checkProjectAccess(
      requesterId,
      projectId,
      ProjectRole.viewer,
    );
    if (!hasAccess) {
      throw new NotFoundException(
        'Project not found or insufficient permissions',
      );
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project '${projectId}' not found`);
    }

    return project.members;
  }

  async createInvite(
    projectId: string,
    email: string,
    requesterId: string,
    baseUrl: string,
  ) {
    // Check if requester is project owner or member
    const hasAccess = await this.checkProjectAccess(
      requesterId,
      projectId,
      ProjectRole.member,
    );

    if (!hasAccess) {
      throw new NotFoundException(
        'Project not found or insufficient permissions',
      );
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // Check if already a member
      const existingMember = await this.prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId: existingUser.id,
          },
        },
      });

      if (existingMember) {
        throw new BadRequestException(
          'User is already a member of this project',
        );
      }

      // Add existing user directly as member
      await this.prisma.projectMember.create({
        data: {
          projectId,
          userId: existingUser.id,
          role: ProjectRole.member,
        },
      });

      return {
        inviteLink: null,
        email,
        expiresAt: null,
        message: 'User added to project successfully',
      };
    }

    // User doesn't exist - create invite
    const token = this.generateInviteToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.prisma.invite.create({
      data: {
        email,
        projectId,
        token,
        expiresAt,
      },
    });

    return {
      inviteLink: `${baseUrl}/invite/${token}`,
      email,
      expiresAt,
    };
  }

  private generateInviteToken(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }
}
