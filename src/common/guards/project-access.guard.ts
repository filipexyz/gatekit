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
    const project = request.params.project;

    if (!project) {
      throw new ForbiddenException('Project is required');
    }

    // Get project
    const projectRecord = await this.prisma.project.findUnique({
      where: { id: project },
    });

    if (!projectRecord) {
      throw new NotFoundException(`Project '${project}' not found`);
    }

    // Check access based on authentication type
    if (request.authType === 'api-key') {
      // API Key: Must belong to the target project
      if (request.project?.id !== projectRecord.id) {
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
          projectId: projectRecord.id,
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
    request.project = projectRecord;
    return true;
  }
}
