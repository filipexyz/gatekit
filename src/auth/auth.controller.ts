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
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { AuthResponse } from './dto/auth-response';
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
    requiredScopes: [],
    inputType: 'SignupDto',
    outputType: 'AuthResponse',
    options: {
      email: {
        required: true,
        description: 'Email address',
        type: 'string',
      },
      password: {
        required: true,
        description: 'Password (min 8 chars, 1 uppercase, 1 number)',
        type: 'string',
      },
      name: {
        required: false,
        description: 'Full name',
        type: 'string',
      },
    },
    examples: [
      {
        description: 'Create first admin user',
        command:
          'gatekit auth signup --email admin@example.com --password Admin123 --name "Admin User"',
      },
    ],
  })
  async signup(@Body() signupDto: SignupDto): Promise<AuthResponse> {
    return this.localAuthService.signup(signupDto);
  }

  @Post('login')
  @Public()
  @SdkContract({
    command: 'auth login',
    description: 'Login with email and password',
    category: 'Auth',
    requiredScopes: [],
    inputType: 'LoginDto',
    outputType: 'AuthResponse',
    options: {
      email: {
        required: true,
        description: 'Email address',
        type: 'string',
      },
      password: {
        required: true,
        description: 'Password',
        type: 'string',
      },
    },
    examples: [
      {
        description: 'Login with email and password',
        command:
          'gatekit auth login --email admin@example.com --password Admin123',
      },
    ],
  })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponse> {
    return this.localAuthService.login(loginDto);
  }

  @Post('accept-invite')
  @Public()
  @SdkContract({
    command: 'auth accept-invite',
    description: 'Accept a project invitation and create account',
    category: 'Auth',
    requiredScopes: [],
    inputType: 'AcceptInviteDto',
    outputType: 'AuthResponse',
    options: {
      token: {
        required: true,
        description: 'Invite token from invitation link',
        type: 'string',
      },
      name: {
        required: true,
        description: 'Full name',
        type: 'string',
      },
      password: {
        required: true,
        description: 'Password (min 8 chars, 1 uppercase, 1 number)',
        type: 'string',
      },
    },
    examples: [
      {
        description: 'Accept invitation',
        command:
          'gatekit auth accept-invite --token abc123... --name "John Doe" --password SecurePass123',
      },
    ],
  })
  async acceptInvite(@Body() dto: AcceptInviteDto): Promise<AuthResponse> {
    return this.localAuthService.acceptInvite(
      dto.token,
      dto.name,
      dto.password,
    );
  }

  @Get('whoami')
  @SdkContract({
    command: 'auth whoami',
    description: 'Get current authentication context and permissions',
    category: 'Auth',
    requiredScopes: [],
    outputType: 'PermissionResponse',
    examples: [
      {
        description: 'Check your authentication context',
        command: 'gatekit auth whoami',
      },
    ],
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
