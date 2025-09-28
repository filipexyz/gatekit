import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const projectSlug = request.params.projectSlug;

    if (!projectSlug) {
      throw new ForbiddenException('Project slug is required');
    }

    // Get project
    const project = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
    });

    if (!project) {
      throw new NotFoundException(
        `Project with slug '${projectSlug}' not found`,
      );
    }

    // Check access based on authentication type
    if (request.authType === 'api-key') {
      // API Key: Must belong to the target project
      if (request.project?.id !== project.id) {
        throw new ForbiddenException(
          'API key does not have access to this project',
        );
      }
    } else if (request.authType === 'jwt') {
      // JWT: Check user membership/ownership of project
      const userId = request.user?.userId;
      if (!userId) {
        throw new ForbiddenException('User ID not found in JWT token');
      }

      const membership = await this.prisma.projectMember.findFirst({
        where: {
          projectId: project.id,
          userId: userId,
        },
      });

      if (!membership) {
        throw new ForbiddenException('You do not have access to this project');
      }
    } else {
      throw new ForbiddenException('Invalid authentication type');
    }

    // Attach project to request for downstream use
    request.project = project;
    return true;
  }
}
