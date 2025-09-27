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

interface ApiKeyRequest {
  authType: 'api-key';
  apiKey: {
    id: string;
    name: string;
    scopes: string[];
  };
  project: {
    id: string;
    slug: string;
    name: string;
  };
}

interface JwtRequest {
  authType: 'jwt';
  user: {
    userId: string;
    email?: string;
    permissions?: string[];
    scope?: string;
  };
}

type AuthenticatedRequest = ApiKeyRequest | JwtRequest;

@Controller('api/v1/auth')
@UseGuards(AppAuthGuard)
export class AuthController {
  @Get('whoami')
  getPermissions(
    @Request() req: { user: AuthenticatedRequest },
  ): PermissionResponse {
    const authReq = req.user;
    const response: PermissionResponse = {
      authType: authReq.authType,
      permissions: [],
    };

    if (authReq.authType === 'api-key') {
      response.permissions = authReq.apiKey.scopes || [];
      response.project = {
        id: authReq.project.id,
        slug: authReq.project.slug,
        name: authReq.project.name,
      };
      response.apiKey = {
        id: authReq.apiKey.id,
        name: authReq.apiKey.name,
      };
    } else if (authReq.authType === 'jwt') {
      const userPermissions = authReq.user.permissions || [];
      const userScopes = authReq.user.scope
        ? authReq.user.scope.split(' ')
        : [];
      response.permissions = [...userPermissions, ...userScopes];
      response.user = {
        userId: authReq.user.userId,
        email: authReq.user.email,
      };
    }

    return response;
  }
}
