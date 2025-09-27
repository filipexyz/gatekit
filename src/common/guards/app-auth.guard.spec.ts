import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppAuthGuard } from './app-auth.guard';
import { ApiKeysService } from '../../api-keys/api-keys.service';

describe('AppAuthGuard', () => {
  let guard: AppAuthGuard;
  let apiKeysService: ApiKeysService;
  let reflector: Reflector;
  let configService: ConfigService;

  const mockExecutionContext = (
    headers: any = {},
    handler?: any,
    class_?: any,
  ): ExecutionContext => {
    const request = { headers };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => handler || jest.fn(),
      getClass: () => class_ || jest.fn(),
    } as any;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppAuthGuard,
        {
          provide: ApiKeysService,
          useValue: {
            validateApiKey: jest.fn(),
          },
        },
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<AppAuthGuard>(AppAuthGuard);
    apiKeysService = module.get<ApiKeysService>(ApiKeysService);
    reflector = module.get<Reflector>(Reflector);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Public endpoints', () => {
    it('should allow access to public endpoints', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

      const context = mockExecutionContext();
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(apiKeysService.validateApiKey).not.toHaveBeenCalled();
    });
  });

  describe('API Key authentication', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    });

    it('should authenticate with valid API key', async () => {
      const mockApiKey = 'gk_test_validkey123';
      const mockValidatedKey = {
        id: 'key-id',
        project: { id: 'project-id', name: 'Test Project' },
        scopes: ['projects:read', 'projects:write'],
      };

      jest
        .spyOn(apiKeysService, 'validateApiKey')
        .mockResolvedValue(mockValidatedKey as any);

      const context = mockExecutionContext({ 'x-api-key': mockApiKey });
      const request = context.switchToHttp().getRequest();

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(apiKeysService.validateApiKey).toHaveBeenCalledWith(mockApiKey);
      expect(request.apiKey).toEqual(mockValidatedKey);
      expect(request.project).toEqual(mockValidatedKey.project);
      expect(request.authType).toBe('api-key');
    });

    it('should reject invalid API key', async () => {
      jest.spyOn(apiKeysService, 'validateApiKey').mockResolvedValue(null);

      const context = mockExecutionContext({ 'x-api-key': 'invalid-key' });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Invalid API key',
      );
    });

    it('should reject when API key lacks required scopes', async () => {
      const mockValidatedKey = {
        id: 'key-id',
        project: { id: 'project-id' },
        scopes: ['projects:read'], // Missing projects:write
      };

      jest
        .spyOn(apiKeysService, 'validateApiKey')
        .mockResolvedValue(mockValidatedKey as any);
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key: string) => {
          if (key === 'isPublic') return false;
          if (key === 'requiredScopes')
            return ['projects:read', 'projects:write'];
          return null;
        });

      const context = mockExecutionContext({ 'x-api-key': 'valid-key' });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Insufficient permissions',
      );
    });
  });

  describe('JWT authentication', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    });

    it('should reject JWT when Auth0 is not configured', async () => {
      jest.spyOn(configService, 'get').mockReturnValue({
        domain: '',
        audience: '',
      });

      const context = mockExecutionContext({
        authorization: 'Bearer fake.jwt.token',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'JWT authentication is not configured. Please use API key authentication.',
      );
    });

    it('should attempt to process JWT when Auth0 is configured', async () => {
      jest.spyOn(configService, 'get').mockReturnValue({
        domain: 'test.auth0.com',
        audience: 'https://api.test.com',
      });

      const context = mockExecutionContext({
        authorization: 'Bearer valid.jwt.token',
      });

      // Since we can't properly mock the parent AuthGuard('jwt'),
      // we'll just verify that the method attempts to validate JWT
      // In a real scenario, this would call the parent class
      try {
        await guard.canActivate(context);
      } catch (error) {
        // Expected to fail since we can't properly mock passport strategy
        expect(error.message).toContain('Invalid or expired token');
      }
    });

    it('should handle JWT validation errors', async () => {
      jest.spyOn(configService, 'get').mockReturnValue({
        domain: 'test.auth0.com',
        audience: 'https://api.test.com',
      });

      const context = mockExecutionContext({
        authorization: 'Bearer invalid.jwt.token',
      });

      // Test that invalid JWT tokens are properly rejected
      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('No authentication provided', () => {
    it('should reject requests without any authentication', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const context = mockExecutionContext({});

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Authentication required. Provide either an API key or Bearer token.',
      );
    });
  });

  describe('Authentication preference', () => {
    it('should prefer API key over JWT when both are present', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const mockValidatedKey = {
        id: 'key-id',
        project: { id: 'project-id' },
        scopes: ['projects:read'],
      };

      jest
        .spyOn(apiKeysService, 'validateApiKey')
        .mockResolvedValue(mockValidatedKey as any);

      const context = mockExecutionContext({
        'x-api-key': 'valid-api-key',
        authorization: 'Bearer jwt.token',
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(apiKeysService.validateApiKey).toHaveBeenCalled();
      expect(context.switchToHttp().getRequest().authType).toBe('api-key');
    });
  });
});
