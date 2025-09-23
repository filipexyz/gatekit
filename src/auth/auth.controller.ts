import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AppAuthGuard } from '../common/guards/app-auth.guard';

export interface PermissionResponse {
  authType: 'api-key' | 'jwt';
  permissions: string[];
  project?: {
    id: string;
    slug: string;
    name: string;
  };
  user?: {
    userId: string;
    email?: string;
  };
  apiKey?: {
    id: string;
    name: string;
  };
}

@Controller('api/v1/auth')
@UseGuards(AppAuthGuard)
export class AuthController {
  @Get('whoami')
  async getPermissions(@Request() req: any): Promise<PermissionResponse> {
    const response: PermissionResponse = {
      authType: req.authType,
      permissions: [],
    };

    if (req.authType === 'api-key' && req.apiKey) {
      response.permissions = req.apiKey.scopes || [];
      response.project = {
        id: req.project.id,
        slug: req.project.slug,
        name: req.project.name,
      };
      response.apiKey = {
        id: req.apiKey.id,
        name: req.apiKey.name,
      };
    } else if (req.authType === 'jwt' && req.user) {
      const userPermissions = req.user.permissions || [];
      const userScopes = req.user.scope ? req.user.scope.split(' ') : [];
      response.permissions = [...userPermissions, ...userScopes];
      response.user = {
        userId: req.user.userId,
        email: req.user.email,
      };
    }

    return response;
  }
}