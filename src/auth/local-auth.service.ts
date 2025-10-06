import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AuthResponse } from './dto/auth-response';
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

  async signup(signupDto: SignupDto): Promise<AuthResponse> {
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

  async login(loginDto: LoginDto): Promise<AuthResponse> {
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
      name: user.name,
      isAdmin: user.isAdmin,
      user: user,
    };
  }

  async acceptInvite(
    token: string,
    name: string,
    password: string,
  ): Promise<AuthResponse> {
    // Find invite
    const invite = await this.prisma.invite.findUnique({
      where: { token },
      include: { project: true },
    });

    if (!invite) {
      throw new UnauthorizedException('Invalid or expired invite');
    }

    // Check if expired
    if (invite.expiresAt < new Date()) {
      await this.prisma.invite.delete({ where: { token } });
      throw new UnauthorizedException('Invite has expired');
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: invite.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);

    // Create user and add to project in transaction
    const result = await this.prisma.$transaction(async (prisma) => {
      // Create user
      const user = await prisma.user.create({
        data: {
          email: invite.email,
          passwordHash,
          name,
          isAdmin: false,
        },
      });

      // Add user to project as member
      await prisma.projectMember.create({
        data: {
          projectId: invite.projectId,
          userId: user.id,
          role: 'member',
        },
      });

      // Delete invite
      await prisma.invite.delete({ where: { token } });

      return user;
    });

    // Generate JWT token
    const accessToken = this.generateToken(
      result.id,
      result.email,
      result.isAdmin,
    );

    return {
      accessToken,
      user: {
        id: result.id,
        email: result.email,
        name: result.name || undefined,
        isAdmin: result.isAdmin,
      },
    };
  }

  async updatePassword(
    userId: string,
    updatePasswordDto: UpdatePasswordDto,
  ): Promise<{ message: string }> {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('User not found or no password set');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      updatePasswordDto.currentPassword,
      user.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Check new password is different from current
    const isSamePassword = await bcrypt.compare(
      updatePasswordDto.newPassword,
      user.passwordHash,
    );

    if (isSamePassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(
      updatePasswordDto.newPassword,
      this.SALT_ROUNDS,
    );

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    return { message: 'Password updated successfully' };
  }

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<{
    message: string;
    user: { id: string; email: string; name: string | null };
  }> {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Update user profile
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: updateProfileDto.name,
      },
    });

    return {
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
      },
    };
  }
}
