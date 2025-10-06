import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { ApiKeysService } from '../../api-keys/api-keys.service';
import { AppConfig } from '../../config/app.config';

@Injectable()
export class AppAuthGuard extends AuthGuard('jwt') implements CanActivate {
  constructor(
    @Optional() private apiKeysService: ApiKeysService,
    private reflector: Reflector,
    private configService: ConfigService,
  ) {
    super();
  }

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

    if (apiKey) {
      return this.validateApiKey(context, apiKey);
    }

    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const auth0Config =
        this.configService.get<AppConfig['auth0']>('app.auth0');
      if (!auth0Config?.domain || !auth0Config?.audience) {
        throw new UnauthorizedException(
          'JWT authentication is not configured. Please use API key authentication.',
        );
      }
      return this.validateJwt(context);
    }

    throw new UnauthorizedException(
      'Authentication required. Provide either an API key or Bearer token.',
    );
  }

  private async validateApiKey(
    context: ExecutionContext,
    apiKey: string,
  ): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    if (!this.apiKeysService) {
      throw new UnauthorizedException('API key authentication not configured');
    }

    const validatedKey = await this.apiKeysService.validateApiKey(apiKey);

    if (!validatedKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    const requiredScopes =
      this.reflector.getAllAndOverride<string[]>('requiredScopes', [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    if (requiredScopes.length > 0) {
      const hasRequiredScopes = requiredScopes.every((scope) =>
        validatedKey.scopes.includes(scope),
      );

      if (!hasRequiredScopes) {
        throw new ForbiddenException('Insufficient permissions');
      }
    }

    request.apiKey = validatedKey;
    request.project = validatedKey.project;
    request.authType = 'api-key';

    return true;
  }

  private async validateJwt(context: ExecutionContext): Promise<boolean> {
    // Try local JWT first (our own JWT_SECRET)
    try {
      const localJwtResult = await this.validateLocalJwt(context);
      if (localJwtResult) {
        return localJwtResult;
      }
    } catch (error) {
      // Fall through to Auth0 JWT validation
    }

    // Try Auth0 JWT only if configured
    const auth0Config = this.configService.get<AppConfig['auth0']>('app.auth0');
    if (!auth0Config?.domain || !auth0Config?.audience) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    try {
      const result = await super.canActivate(context);

      if (result) {
        const request = context.switchToHttp().getRequest();
        request.authType = 'jwt';

        // Note: Scope checks are only for API keys, not JWT users
        // JWT users who pass ProjectAccessGuard have full project access
        // This is because:
        // 1. JWT users are authenticated humans (members/owners)
        // 2. API keys are scoped for programmatic access
        // 3. Membership implies trust and full access to project resources
      }

      return result as boolean;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private async validateLocalJwt(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const jwtSecret = this.configService.get<string>('app.jwtSecret');

    if (!jwtSecret) {
      return false;
    }

    // Use local-jwt strategy via Passport
    const guard = new (AuthGuard('local-jwt'))();
    try {
      const result = await guard.canActivate(context);

      if (result) {
        request.authType = 'jwt';
      }

      return result as boolean;
    } catch (error) {
      return false;
    }
  }

  private extractApiKey(request: any): string | null {
    const apiKey = request.headers['x-api-key'];
    return apiKey || null;
  }
}
