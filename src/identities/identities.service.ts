import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIdentityDto } from './dto/create-identity.dto';
import { UpdateIdentityDto } from './dto/update-identity.dto';
import { AddAliasDto } from './dto/add-alias.dto';
import { SecurityUtil, AuthContext } from '../common/utils/security.util';
import { IdentityLinkMethod, Prisma } from '@prisma/client';

@Injectable()
export class IdentitiesService {
  private readonly logger = new Logger(IdentitiesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new identity with aliases
   */
  async create(
    projectId: string,
    createDto: CreateIdentityDto,
    authContext: AuthContext,
  ) {
    // SECURITY: Get project and validate access
    const project = await SecurityUtil.getProjectWithAccess(
      this.prisma,
      projectId,
      authContext,
      'create identities',
    );

    // Validate all platforms belong to this project
    const platformIds = createDto.aliases.map((a) => a.platformId);
    const platforms = await this.prisma.projectPlatform.findMany({
      where: {
        id: { in: platformIds },
        projectId: project.id,
      },
    });

    if (platforms.length !== platformIds.length) {
      throw new BadRequestException(
        'One or more platform IDs do not belong to this project',
      );
    }

    // Check for duplicate aliases (same platform + providerUserId)
    const existingAliases = await this.prisma.identityAlias.findMany({
      where: {
        OR: createDto.aliases.map((alias) => ({
          platformId: alias.platformId,
          providerUserId: alias.providerUserId,
        })),
      },
      include: {
        identity: true,
      },
    });

    if (existingAliases.length > 0) {
      const duplicates = existingAliases.map(
        (a) =>
          `${a.platform} user ${a.providerUserId} (already linked to identity ${a.identity.id})`,
      );
      throw new ConflictException(
        `The following platform users are already linked to identities: ${duplicates.join(', ')}`,
      );
    }

    // Create identity with aliases
    const identity = await this.prisma.identity.create({
      data: {
        projectId: project.id,
        displayName: createDto.displayName,
        email: createDto.email,
        metadata: createDto.metadata || Prisma.JsonNull,
        aliases: {
          create: createDto.aliases.map((alias) => {
            const platform = platforms.find((p) => p.id === alias.platformId);
            if (!platform) {
              throw new BadRequestException(
                `Platform ${alias.platformId} not found`,
              );
            }
            return {
              projectId: project.id,
              platformId: alias.platformId,
              platform: platform.platform,
              providerUserId: alias.providerUserId,
              providerUserDisplay: alias.providerUserDisplay,
              linkMethod: IdentityLinkMethod.manual,
            };
          }),
        },
      },
      include: {
        aliases: {
          include: {
            platformConfig: {
              select: {
                id: true,
                name: true,
                platform: true,
              },
            },
          },
        },
      },
    });

    this.logger.log(
      `Created identity ${identity.id} with ${identity.aliases.length} aliases for project ${project.id}`,
    );

    return identity;
  }

  /**
   * Get all identities for a project
   */
  async findAll(projectId: string, authContext: AuthContext) {
    // SECURITY: Get project and validate access
    const project = await SecurityUtil.getProjectWithAccess(
      this.prisma,
      projectId,
      authContext,
      'list identities',
    );

    const identities = await this.prisma.identity.findMany({
      where: { projectId: project.id },
      include: {
        aliases: {
          include: {
            platformConfig: {
              select: {
                id: true,
                name: true,
                platform: true,
              },
            },
          },
        },
        _count: {
          select: {
            aliases: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return identities;
  }

  /**
   * Get a single identity by ID
   */
  async findOne(
    projectId: string,
    identityId: string,
    authContext: AuthContext,
  ) {
    // SECURITY: Get project and validate access
    const project = await SecurityUtil.getProjectWithAccess(
      this.prisma,
      projectId,
      authContext,
      'view identity',
    );

    const identity = await this.prisma.identity.findFirst({
      where: {
        id: identityId,
        projectId: project.id,
      },
      include: {
        aliases: {
          include: {
            platformConfig: {
              select: {
                id: true,
                name: true,
                platform: true,
              },
            },
          },
        },
        _count: {
          select: {
            aliases: true,
          },
        },
      },
    });

    if (!identity) {
      throw new NotFoundException(
        `Identity ${identityId} not found in project ${projectId}`,
      );
    }

    return identity;
  }

  /**
   * Look up identity by platform user ID
   */
  async lookupByPlatformUser(
    projectId: string,
    platformId: string,
    providerUserId: string,
    authContext: AuthContext,
  ) {
    // SECURITY: Get project and validate access
    const project = await SecurityUtil.getProjectWithAccess(
      this.prisma,
      projectId,
      authContext,
      'lookup identity',
    );

    const alias = await this.prisma.identityAlias.findUnique({
      where: {
        platformId_providerUserId: {
          platformId,
          providerUserId,
        },
      },
      include: {
        identity: {
          include: {
            aliases: {
              include: {
                platformConfig: {
                  select: {
                    id: true,
                    name: true,
                    platform: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!alias || alias.projectId !== project.id) {
      throw new NotFoundException(
        `No identity found for platform user ${providerUserId} on platform ${platformId}`,
      );
    }

    return alias.identity;
  }

  /**
   * Update identity metadata
   */
  async update(
    projectId: string,
    identityId: string,
    updateDto: UpdateIdentityDto,
    authContext: AuthContext,
  ) {
    // SECURITY: Get project and validate access
    const project = await SecurityUtil.getProjectWithAccess(
      this.prisma,
      projectId,
      authContext,
      'update identity',
    );

    // Verify identity exists and belongs to project
    const existing = await this.prisma.identity.findFirst({
      where: {
        id: identityId,
        projectId: project.id,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Identity ${identityId} not found in project ${projectId}`,
      );
    }

    const updated = await this.prisma.identity.update({
      where: { id: identityId },
      data: {
        displayName: updateDto.displayName,
        email: updateDto.email,
        metadata: updateDto.metadata ?? Prisma.JsonNull,
      },
      include: {
        aliases: {
          include: {
            platformConfig: {
              select: {
                id: true,
                name: true,
                platform: true,
              },
            },
          },
        },
      },
    });

    this.logger.log(`Updated identity ${identityId} in project ${project.id}`);

    return updated;
  }

  /**
   * Add a new alias to an existing identity
   */
  async addAlias(
    projectId: string,
    identityId: string,
    addAliasDto: AddAliasDto,
    authContext: AuthContext,
  ) {
    // SECURITY: Get project and validate access
    const project = await SecurityUtil.getProjectWithAccess(
      this.prisma,
      projectId,
      authContext,
      'add identity alias',
    );

    // Verify identity exists and belongs to project
    const identity = await this.prisma.identity.findFirst({
      where: {
        id: identityId,
        projectId: project.id,
      },
    });

    if (!identity) {
      throw new NotFoundException(
        `Identity ${identityId} not found in project ${projectId}`,
      );
    }

    // Verify platform belongs to project
    const platform = await this.prisma.projectPlatform.findFirst({
      where: {
        id: addAliasDto.platformId,
        projectId: project.id,
      },
    });

    if (!platform) {
      throw new BadRequestException(
        `Platform ${addAliasDto.platformId} does not belong to project ${projectId}`,
      );
    }

    // Check if alias already exists
    const existing = await this.prisma.identityAlias.findUnique({
      where: {
        platformId_providerUserId: {
          platformId: addAliasDto.platformId,
          providerUserId: addAliasDto.providerUserId,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Platform user ${addAliasDto.providerUserId} on platform ${platform.platform} is already linked to identity ${existing.identityId}`,
      );
    }

    // Create alias
    const alias = await this.prisma.identityAlias.create({
      data: {
        identityId,
        projectId: project.id,
        platformId: addAliasDto.platformId,
        platform: platform.platform,
        providerUserId: addAliasDto.providerUserId,
        providerUserDisplay: addAliasDto.providerUserDisplay,
        linkMethod: IdentityLinkMethod.manual,
      },
      include: {
        platformConfig: {
          select: {
            id: true,
            name: true,
            platform: true,
          },
        },
      },
    });

    this.logger.log(
      `Added alias ${alias.id} to identity ${identityId} in project ${project.id}`,
    );

    return alias;
  }

  /**
   * Remove an alias from an identity
   */
  async removeAlias(
    projectId: string,
    identityId: string,
    aliasId: string,
    authContext: AuthContext,
  ) {
    // SECURITY: Get project and validate access
    const project = await SecurityUtil.getProjectWithAccess(
      this.prisma,
      projectId,
      authContext,
      'remove identity alias',
    );

    // Verify alias exists and belongs to the identity and project
    const alias = await this.prisma.identityAlias.findFirst({
      where: {
        id: aliasId,
        identityId,
        projectId: project.id,
      },
    });

    if (!alias) {
      throw new NotFoundException(
        `Alias ${aliasId} not found for identity ${identityId} in project ${projectId}`,
      );
    }

    // Prevent removing last alias
    const aliasCount = await this.prisma.identityAlias.count({
      where: { identityId },
    });

    if (aliasCount <= 1) {
      throw new BadRequestException(
        'Cannot remove the last alias from an identity. Delete the identity instead.',
      );
    }

    await this.prisma.identityAlias.delete({
      where: { id: aliasId },
    });

    this.logger.log(
      `Removed alias ${aliasId} from identity ${identityId} in project ${project.id}`,
    );

    return { success: true, message: 'Alias removed successfully' };
  }

  /**
   * Delete an identity (cascades to aliases)
   */
  async remove(
    projectId: string,
    identityId: string,
    authContext: AuthContext,
  ) {
    // SECURITY: Get project and validate access
    const project = await SecurityUtil.getProjectWithAccess(
      this.prisma,
      projectId,
      authContext,
      'delete identity',
    );

    // Verify identity exists and belongs to project
    const identity = await this.prisma.identity.findFirst({
      where: {
        id: identityId,
        projectId: project.id,
      },
    });

    if (!identity) {
      throw new NotFoundException(
        `Identity ${identityId} not found in project ${projectId}`,
      );
    }

    await this.prisma.identity.delete({
      where: { id: identityId },
    });

    this.logger.log(
      `Deleted identity ${identityId} from project ${project.id}`,
    );

    return { success: true, message: 'Identity deleted successfully' };
  }

  /**
   * Get messages for a specific identity (dynamic resolution via JOIN)
   */
  async getMessagesForIdentity(
    projectId: string,
    identityId: string,
    authContext: AuthContext,
  ) {
    // SECURITY: Get project and validate access
    const project = await SecurityUtil.getProjectWithAccess(
      this.prisma,
      projectId,
      authContext,
      'view identity messages',
    );

    // Verify identity exists and belongs to project
    const identity = await this.prisma.identity.findFirst({
      where: {
        id: identityId,
        projectId: project.id,
      },
      include: {
        aliases: true,
      },
    });

    if (!identity) {
      throw new NotFoundException(
        `Identity ${identityId} not found in project ${projectId}`,
      );
    }

    // Get messages from all aliases (dynamic resolution)
    const messages = await this.prisma.receivedMessage.findMany({
      where: {
        projectId: project.id,
        OR: identity.aliases.map((alias) => ({
          platformId: alias.platformId,
          providerUserId: alias.providerUserId,
        })),
      },
      orderBy: { receivedAt: 'desc' },
    });

    return messages;
  }

  /**
   * Get reactions for a specific identity (dynamic resolution via JOIN)
   */
  async getReactionsForIdentity(
    projectId: string,
    identityId: string,
    authContext: AuthContext,
  ) {
    // SECURITY: Get project and validate access
    const project = await SecurityUtil.getProjectWithAccess(
      this.prisma,
      projectId,
      authContext,
      'view identity reactions',
    );

    // Verify identity exists and belongs to project
    const identity = await this.prisma.identity.findFirst({
      where: {
        id: identityId,
        projectId: project.id,
      },
      include: {
        aliases: true,
      },
    });

    if (!identity) {
      throw new NotFoundException(
        `Identity ${identityId} not found in project ${projectId}`,
      );
    }

    // Get reactions from all aliases (dynamic resolution)
    const reactions = await this.prisma.receivedReaction.findMany({
      where: {
        projectId: project.id,
        OR: identity.aliases.map((alias) => ({
          platformId: alias.platformId,
          providerUserId: alias.providerUserId,
        })),
      },
      orderBy: { receivedAt: 'desc' },
    });

    return reactions;
  }
}
