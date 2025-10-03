import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AppAuthGuard } from '../common/guards/app-auth.guard';
import { SdkContract } from '../common/decorators/sdk-contract.decorator';
import { Public } from '../common/decorators/public.decorator';
import { PermissionResponse } from './dto/permission-response.dto';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LocalAuthService } from './local-auth.service';

interface ApiKeyRequest {
  authType: 'api-key';
  apiKey: {
    id: string;
    name: string;
    scopes: string[];
  };
  project: {
    id: string;
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
  constructor(private readonly localAuthService: LocalAuthService) {}
  @Post('signup')
  @Public()
  @SdkContract({
    command: 'auth signup',
    description: 'Create a new user account (first user becomes admin)',
    category: 'Auth',
    outputType: 'AuthResponseDto',
  })
  async signup(@Body() signupDto: SignupDto): Promise<AuthResponseDto> {
    return this.localAuthService.signup(signupDto);
  }

  @Post('login')
  @Public()
  @SdkContract({
    command: 'auth login',
    description: 'Login with email and password',
    category: 'Auth',
    outputType: 'AuthResponseDto',
  })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.localAuthService.login(loginDto);
  }

  @Get('whoami')
  @SdkContract({
    command: 'auth whoami',
    description: 'Get current authentication context and permissions',
    category: 'Auth',
    outputType: 'PermissionResponse',
  })
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
