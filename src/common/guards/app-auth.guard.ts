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
    console.log('AppAuthGuard - validateJwt() called');

    // Try local JWT first (our own JWT_SECRET)
    try {
      const localJwtResult = await this.validateLocalJwt(context);
      if (localJwtResult) {
        console.log('AppAuthGuard - Local JWT validation successful');
        return localJwtResult;
      }
    } catch (error) {
      console.log('AppAuthGuard - Local JWT validation failed:', error.message);
    }

    // Try Auth0 JWT only if configured
    const auth0Config = this.configService.get<AppConfig['auth0']>('app.auth0');
    if (!auth0Config?.domain || !auth0Config?.audience) {
      console.log('AppAuthGuard - Auth0 not configured, JWT validation failed');
      throw new UnauthorizedException('Invalid or expired token');
    }

    try {
      console.log('AppAuthGuard - Calling Auth0 super.canActivate()');
      const result = await super.canActivate(context);
      console.log('AppAuthGuard - super.canActivate() result:', result);

      if (result) {
        const request = context.switchToHttp().getRequest();
        request.authType = 'jwt';

        console.log('AppAuthGuard - JWT validation successful, user:', {
          hasUser: !!request.user,
          userId: request.user?.userId,
          email: request.user?.email,
          permissionsCount: request.user?.permissions?.length || 0,
        });

        // Note: Scope checks are only for API keys, not JWT users
        // JWT users who pass ProjectAccessGuard have full project access
        // This is because:
        // 1. JWT users are authenticated humans (members/owners)
        // 2. API keys are scoped for programmatic access
        // 3. Membership implies trust and full access to project resources
        console.log(
          'AppAuthGuard - JWT user authenticated, skipping scope checks (membership grants full access)',
        );
      }

      console.log('AppAuthGuard - JWT validation complete, returning:', result);
      return result as boolean;
    } catch (error) {
      console.error('AppAuthGuard - JWT validation error:', {
        error: error.message,
        type: error.constructor.name,
        stack: error.stack,
      });

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
        console.log('AppAuthGuard - Local JWT validation successful');
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
