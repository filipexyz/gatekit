import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectEnvironment } from '@prisma/client';

export interface AuthContext {
  authType: 'api-key' | 'jwt';
  project?: { id: string };
  user?: { userId: string; email?: string };
}

export interface ProjectWithAccess {
  id: string;
  name: string;
  environment: ProjectEnvironment;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class SecurityUtil {
  /**
   * Gets project and validates access in one step - eliminates duplication
   * Returns the project if access is valid, throws exception if not
   */
  static async getProjectWithAccess(
    prisma: any,
    projectId: string,
    authContext: AuthContext,
    operation: string,
  ): Promise<ProjectWithAccess> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project '${projectId}' not found`);
    }

    SecurityUtil.validateProjectAccess(authContext, project.id, operation);
    return project;
  }

  /**
   * Validates that the authenticated context has access to the target project
   * This provides defense-in-depth validation at the service level
   */
  static validateProjectAccess(
    authContext: AuthContext,
    targetProjectId: string,
    operation: string,
  ): void {
    if (!authContext) {
      throw new ForbiddenException(
        `SECURITY ERROR: Authentication context missing for ${operation}. This indicates a guard bypass.`,
      );
    }

    if (authContext.authType === 'api-key') {
      // API Key: Must belong to the target project
      if (!authContext.project || authContext.project.id !== targetProjectId) {
        throw new ForbiddenException(
          `API key does not have access to perform ${operation}`,
        );
      }
    } else if (authContext.authType === 'jwt') {
      // JWT: Project access should have been validated by ProjectAccessGuard
      // This is additional validation for direct service calls
      if (!authContext.user?.userId) {
        throw new ForbiddenException(`User context required for ${operation}`);
      }
      // Note: Full JWT validation requires database lookup which is done in ProjectAccessGuard
      // This is a lightweight validation for defense-in-depth
    } else {
      throw new ForbiddenException(
        `Invalid authentication type for ${operation}`,
      );
    }
  }

  /**
   * Extracts auth context from NestJS request object
   * Used by services to get authentication context from controllers
   */
  static extractAuthContext(request: any): AuthContext | null {
    if (!request) return null;

    return {
      authType: request.authType,
      project: request.project,
      user: request.user,
    };
  }
}
