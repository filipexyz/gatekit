import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { LocalAuthService } from '../local-auth.service';

@Injectable()
export class LocalJwtStrategy extends PassportStrategy(Strategy, 'local-jwt') {
  constructor(
    private configService: ConfigService,
    private localAuthService: LocalAuthService,
  ) {
    const jwtSecret = configService.get<string>('app.jwtSecret');

    if (!jwtSecret) {
      throw new Error(
        'JWT_SECRET is not configured. Please set it in your environment variables.',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: { sub: string; email: string; isAdmin: boolean }) {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Invalid token');
    }

    // Validate user still exists
    const user = await this.localAuthService.validateUserByJwt(payload);

    return user;
  }
}
