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
  getPermissions(@Request() req: any): PermissionResponse {
    if (!req) {
      throw new Error('Authentication type not found');
    }

    const authType = req.authType;
    if (!authType) {
      throw new Error('Authentication type not found');
    }

    const response: PermissionResponse = {
      authType,
      permissions: [],
    };

    if (authType === 'api-key') {
      const apiKey = req.apiKey;
      const project = req.project;

      if (!apiKey || !project) {
        throw new Error('API key or project not found');
      }

      response.permissions = apiKey.scopes || [];
      response.project = {
        id: project.id,
        slug: project.slug,
        name: project.name,
      };
      response.apiKey = {
        id: apiKey.id,
        name: apiKey.name,
      };
    } else if (authType === 'jwt') {
      const user = req.user;

      if (!user) {
        throw new Error('User not found');
      }

      const userPermissions = user.permissions || [];
      const userScopes = user.scope ? user.scope.split(' ') : [];
      response.permissions = [...userPermissions, ...userScopes];
      response.user = {
        userId: user.userId,
        email: user.email,
      };
    }

    return response;
  }
}
