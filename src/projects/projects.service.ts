import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CryptoUtil } from '../common/utils/crypto.util';
import { ProjectRole } from '@prisma/client';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async create(createProjectDto: CreateProjectDto, ownerId: string) {
    const id =
      createProjectDto.id || CryptoUtil.generateSlug(createProjectDto.name);

    const existingProject = await this.prisma.project.findUnique({
      where: { id: id },
    });

    if (existingProject) {
      throw new ConflictException(`Project '${id}' already exists`);
    }

    // Get the user to ensure they exist
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
    });

    if (!owner) {
      throw new NotFoundException(`User with ID '${ownerId}' not found`);
    }

    if (createProjectDto.isDefault) {
      await this.prisma.project.updateMany({
        where: {
          isDefault: true,
          ownerId: ownerId, // Only update user's own default projects
        },
        data: { isDefault: false },
      });
    }

    return this.prisma.project.create({
      data: {
        name: createProjectDto.name,
        id,
        environment: createProjectDto.environment,
        isDefault: createProjectDto.isDefault || false,
        settings: createProjectDto.settings,
        ownerId,
        members: {
          create: {
            userId: ownerId,
            role: ProjectRole.owner,
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
  }

  async findAllForUser(userId: string, isAdmin: boolean = false) {
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

  async findAll() {
    return this.findAllForUser('', true); // Legacy method for backward compatibility
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: id },
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
          select: {
            id: true,
            name: true,
            keyPrefix: true,
            keySuffix: true,
            createdAt: true,
            lastUsedAt: true,
            expiresAt: true,
          },
        },
        _count: {
          select: {
            apiKeys: true,
            projectPlatforms: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project '${id}' not found`);
    }

    return project;
  }

  async update(id: string, updateProjectDto: UpdateProjectDto) {
    const existingProject = await this.prisma.project.findUnique({
      where: { id: id },
    });

    if (!existingProject) {
      throw new NotFoundException(`Project '${id}' not found`);
    }

    if (updateProjectDto.id && updateProjectDto.id !== id) {
      const conflictingProject = await this.prisma.project.findUnique({
        where: { id: updateProjectDto.id },
      });

      if (conflictingProject) {
        throw new ConflictException(
          `Project '${updateProjectDto.id}' already exists`,
        );
      }
    }

    if (updateProjectDto.isDefault) {
      await this.prisma.project.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.project.update({
      where: { id: id },
      data: updateProjectDto,
    });
  }

  async remove(id: string, userId: string, isAdmin: boolean = false) {
    const project = await this.prisma.project.findUnique({
      where: { id: id },
      include: {
        _count: {
          select: { apiKeys: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project '${id}' not found`);
    }

    // Check if user has permission to delete (owner or admin)
    if (!isAdmin && project.ownerId !== userId) {
      throw new ForbiddenException(
        'Only project owners or global admins can delete projects',
      );
    }

    if (project._count.apiKeys > 0) {
      const activeKeys = await this.prisma.apiKey.count({
        where: {
          projectId: project.id,
          revokedAt: null,
        },
      });

      if (activeKeys > 0) {
        throw new ConflictException(
          `Cannot delete project with ${activeKeys} active API keys`,
        );
      }
    }

    return this.prisma.project.delete({
      where: { id: id },
    });
  }

  async checkProjectAccess(
    userId: string,
    projectId: string,
    requiredRole?: ProjectRole,
    isAdmin: boolean = false,
  ): Promise<boolean> {
    if (isAdmin) {
      return true; // Global admins have access to everything
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
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
}
