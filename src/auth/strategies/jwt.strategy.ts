import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/app.config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private isConfigured: boolean;
  private configService: ConfigService;

  constructor(configService: ConfigService) {
    const auth0Config = configService.get<AppConfig['auth0']>('app.auth0');

    if (!auth0Config?.domain || !auth0Config?.audience) {
      console.warn('Auth0 configuration not found. JWT authentication will be disabled.');
      super({
        secretOrKeyProvider: () => '',
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        passReqToCallback: false,
      });
      this.isConfigured = false;
    } else {
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
      this.isConfigured = true;
    }
    this.configService = configService;
  }

  async validate(payload: any): Promise<any> {
    if (!this.isConfigured) {
      throw new UnauthorizedException('Auth0 not configured');
    }

    if (!payload) {
      throw new UnauthorizedException('Invalid token');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      permissions: payload.permissions || [],
      scope: payload.scope,
    };
  }
}