import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/app.config';
import { MembersService } from '../../members/members.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private isConfigured: boolean;
  private configService: ConfigService;
  private membersService: MembersService;

  constructor(configService: ConfigService, membersService: MembersService) {
    const auth0Config = configService.get<AppConfig['auth0']>('app.auth0');

    console.log('JWT Strategy - Auth0 Config:', {
      domain: auth0Config?.domain,
      audience: auth0Config?.audience,
      hasClientId: !!auth0Config?.clientId,
      hasClientSecret: !!auth0Config?.clientSecret,
    });

    if (!auth0Config?.domain || !auth0Config?.audience) {
      console.warn(
        'Auth0 configuration not found. JWT authentication will be disabled.',
      );
      super({
        secretOrKeyProvider: () => '',
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        passReqToCallback: false,
      });
    } else {
      console.log('JWT Strategy - Configuring with Auth0:', {
        jwksUri: `https://${auth0Config.domain}/.well-known/jwks.json`,
        audience: auth0Config.audience,
        issuer: `https://${auth0Config.domain}/`,
      });

      super({
        secretOrKeyProvider: passportJwtSecret({
          cache: true,
          rateLimit: true,
          jwksRequestsPerMinute: 5,
          jwksUri: `https://${auth0Config.domain}/.well-known/jwks.json`,
        }),
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        audience: auth0Config.audience,
        issuer: `https://${auth0Config.domain}/`,
        algorithms: ['RS256'],
      });
    }

    this.isConfigured = !(!auth0Config?.domain || !auth0Config?.audience);
    this.configService = configService;
    this.membersService = membersService;
  }

  async validate(payload: {
    sub: string;
    email?: string;
    name?: string;
    permissions?: string[];
    scope?: string;
  }): Promise<{
    userId: string;
    email?: string;
    name?: string;
    permissions: string[];
    scope?: string;
    user: any;
  }> {
    console.log('JWT Strategy - validate() called with payload:', {
      sub: payload?.sub,
      email: payload?.email,
      hasPermissions: !!payload?.permissions,
      permissionsCount: payload?.permissions?.length || 0,
      scope: payload?.scope,
      isConfigured: this.isConfigured,
    });

    if (!this.isConfigured) {
      console.error('JWT Strategy - Auth0 not configured');
      throw new UnauthorizedException('Auth0 not configured');
    }

    if (!payload) {
      console.error('JWT Strategy - No payload provided');
      throw new UnauthorizedException('Invalid token');
    }

    try {
      // Create or update user record from Auth0 token
      console.log('JWT Strategy - Creating/updating user from Auth0 token');
      const user = await this.membersService.upsertFromAuth0({
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
      });

      const result = {
        userId: payload.sub,
        email: payload.email,
        name: payload.name,
        permissions: payload.permissions || [],
        scope: payload.scope,
        user: user, // Include full user record
      };

      console.log('JWT Strategy - validate() successful, returning:', {
        userId: result.userId,
        email: result.email,
        permissionsCount: result.permissions.length,
        hasUser: !!result.user,
      });

      return result;
    } catch (error) {
      console.error('JWT Strategy - Error in validate():', error);
      throw new UnauthorizedException('Authentication failed');
    }
  }
}
