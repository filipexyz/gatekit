import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CryptoUtil } from '../common/utils/crypto.util';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async create(createProjectDto: CreateProjectDto) {
    const slug = createProjectDto.slug || CryptoUtil.generateSlug(createProjectDto.name);

    const existingProject = await this.prisma.project.findUnique({
      where: { slug },
    });

    if (existingProject) {
      throw new ConflictException(`Project with slug '${slug}' already exists`);
    }

    if (createProjectDto.isDefault) {
      await this.prisma.project.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.project.create({
      data: {
        name: createProjectDto.name,
        slug,
        environment: createProjectDto.environment,
        isDefault: createProjectDto.isDefault || false,
        settings: createProjectDto.settings,
      },
    });
  }

  async findAll() {
    return this.prisma.project.findMany({
      include: {
        _count: {
          select: { apiKeys: true },
        },
      },
    });
  }

  async findOne(slug: string) {
    const project = await this.prisma.project.findUnique({
      where: { slug },
      include: {
        apiKeys: {
          where: { revokedAt: null },
          select: {
            id: true,
            name: true,
            keyPrefix: true,
            environment: true,
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
      throw new NotFoundException(`Project with slug '${slug}' not found`);
    }

    return project;
  }

  async update(slug: string, updateProjectDto: UpdateProjectDto) {
    const existingProject = await this.prisma.project.findUnique({
      where: { slug },
    });

    if (!existingProject) {
      throw new NotFoundException(`Project with slug '${slug}' not found`);
    }

    if (updateProjectDto.slug && updateProjectDto.slug !== slug) {
      const conflictingProject = await this.prisma.project.findUnique({
        where: { slug: updateProjectDto.slug },
      });

      if (conflictingProject) {
        throw new ConflictException(`Project with slug '${updateProjectDto.slug}' already exists`);
      }
    }

    if (updateProjectDto.isDefault) {
      await this.prisma.project.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.project.update({
      where: { slug },
      data: updateProjectDto,
    });
  }

  async remove(slug: string) {
    const project = await this.prisma.project.findUnique({
      where: { slug },
      include: {
        _count: {
          select: { apiKeys: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with slug '${slug}' not found`);
    }

    if (project._count.apiKeys > 0) {
      const activeKeys = await this.prisma.apiKey.count({
        where: {
          projectId: project.id,
          revokedAt: null,
        },
      });

      if (activeKeys > 0) {
        throw new ConflictException(`Cannot delete project with ${activeKeys} active API keys`);
      }
    }

    return this.prisma.project.delete({
      where: { slug },
    });
  }
}