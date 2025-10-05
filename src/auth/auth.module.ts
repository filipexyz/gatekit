import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalJwtStrategy } from './strategies/local-jwt.strategy';
import { AuthController } from './auth.controller';
import { MembersModule } from '../members/members.module';
import { LocalAuthService } from './local-auth.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}), // Configuration done per-request via secret
    MembersModule,
  ],
  controllers: [AuthController],
  providers: [JwtStrategy, LocalJwtStrategy, LocalAuthService],
  exports: [PassportModule, LocalAuthService],
})
export class AuthModule {}
