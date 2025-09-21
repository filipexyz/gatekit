import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeysService } from '../../api-keys/api-keys.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private apiKeysService: ApiKeysService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    const validatedKey = await this.apiKeysService.validateApiKey(apiKey);

    if (!validatedKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    const requiredScopes = this.reflector.getAllAndOverride<string[]>('scopes', [
      context.getHandler(),
      context.getClass(),
    ]) || [];

    if (requiredScopes.length > 0) {
      const hasRequiredScopes = requiredScopes.every(scope =>
        validatedKey.scopes.includes(scope)
      );

      if (!hasRequiredScopes) {
        throw new UnauthorizedException('Insufficient permissions');
      }
    }

    request.apiKey = validatedKey;
    request.project = validatedKey.project;

    return true;
  }

  private extractApiKey(request: any): string | null {
    const apiKey = request.headers['x-api-key'];
    return apiKey || null;
  }
}