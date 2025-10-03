import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { User } from '@prisma/client';

/**
 * Service for local email/password authentication
 *
 * Features:
 * - Only allows signup for first admin user
 * - Additional users must be invited by admin
 * - Uses bcrypt for password hashing (10 salt rounds)
 * - JWT tokens valid for 7 days
 */
@Injectable()
export class LocalAuthService {
  private readonly SALT_ROUNDS = 10;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async signup(signupDto: SignupDto): Promise<AuthResponseDto> {
    // Check if any local user already exists
    const localUserCount = await this.prisma.user.count({
      where: {
        passwordHash: {
          not: null,
        },
      },
    });

    if (localUserCount > 0) {
      throw new ConflictException(
        'Signup is disabled. Please contact your administrator for an invitation.',
      );
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: signupDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(
      signupDto.password,
      this.SALT_ROUNDS,
    );

    // Create first admin user
    const user = await this.prisma.user.create({
      data: {
        email: signupDto.email,
        passwordHash,
        name: signupDto.name,
        isAdmin: true, // First user is always admin
      },
    });

    // Generate JWT token
    const accessToken = this.generateToken(user.id, user.email, user.isAdmin);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || undefined,
        isAdmin: user.isAdmin,
      },
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT token
    const accessToken = this.generateToken(user.id, user.email, user.isAdmin);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || undefined,
        isAdmin: user.isAdmin,
      },
    };
  }

  private generateToken(
    userId: string,
    email: string,
    isAdmin: boolean,
  ): string {
    const jwtSecret = this.configService.get<string>('app.jwtSecret');

    const payload = {
      sub: userId,
      email,
      isAdmin,
    };

    return this.jwtService.sign(payload, {
      secret: jwtSecret,
      expiresIn: '7d',
    });
  }

  async validateUserByJwt(payload: {
    sub: string;
    email: string;
    isAdmin: boolean;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      userId: user.id,
      email: user.email,
      isAdmin: user.isAdmin,
      user: user,
    };
  }
}
