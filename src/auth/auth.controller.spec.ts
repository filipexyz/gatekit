import { Test, TestingModule } from '@nestjs/testing';
import { AuthController, PermissionResponse } from './auth.controller';
import { LocalAuthService } from './local-auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  const mockLocalAuthService = {
    signup: jest.fn(),
    login: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: LocalAuthService,
          useValue: mockLocalAuthService,
        },
      ],
    })
      .overrideGuard(require('../common/guards/app-auth.guard').AppAuthGuard)
      .useValue({
        canActivate: jest.fn().mockReturnValue(true),
      })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('getPermissions', () => {
    describe('API Key Authentication', () => {
      it('should return correct permissions for API key auth', () => {
        const mockRequest = {
          authType: 'api-key',
          apiKey: {
            id: 'key-123',
            name: 'Test API Key',
            scopes: ['projects:read', 'projects:write', 'messages:write'],
          },
          project: {
            id: 'project-456',
            name: 'Test Project',
          },
        };

        const result: PermissionResponse =
          controller.getPermissions(mockRequest);

        expect(result).toEqual({
          authType: 'api-key',
          permissions: ['projects:read', 'projects:write', 'messages:write'],
          project: {
            id: 'project-456',
            name: 'Test Project',
          },
          apiKey: {
            id: 'key-123',
            name: 'Test API Key',
          },
        });
      });

      it('should handle API key with empty scopes', () => {
        const mockRequest = {
          authType: 'api-key',
          apiKey: {
            id: 'key-123',
            name: 'Limited API Key',
            scopes: [],
          },
          project: {
            id: 'project-456',
            name: 'Test Project',
          },
        };

        const result: PermissionResponse =
          controller.getPermissions(mockRequest);

        expect(result.permissions).toEqual([]);
        expect(result.authType).toBe('api-key');
      });

      it('should handle API key with undefined scopes', () => {
        const mockRequest = {
          authType: 'api-key',
          apiKey: {
            id: 'key-123',
            name: 'No Scopes API Key',
            scopes: undefined,
          },
          project: {
            id: 'project-456',
            name: 'Test Project',
          },
        };

        const result: PermissionResponse =
          controller.getPermissions(mockRequest);

        expect(result.permissions).toEqual([]);
        expect(result.authType).toBe('api-key');
      });

      it('should throw error when API key is missing', () => {
        const mockRequest = {
          authType: 'api-key',
          project: {
            id: 'project-456',
            name: 'Test Project',
          },
        };

        expect(() => controller.getPermissions(mockRequest)).toThrow(
          'API key or project not found',
        );
      });

      it('should throw error when project is missing', () => {
        const mockRequest = {
          authType: 'api-key',
          apiKey: {
            id: 'key-123',
            name: 'Test API Key',
            scopes: ['projects:read'],
          },
        };

        expect(() => controller.getPermissions(mockRequest)).toThrow(
          'API key or project not found',
        );
      });
    });

    describe('JWT Authentication', () => {
      it('should return correct permissions for JWT auth with permissions array', () => {
        const mockRequest = {
          authType: 'jwt',
          user: {
            userId: 'user-789',
            email: 'test@example.com',
            permissions: ['admin:all', 'projects:manage'],
          },
        };

        const result: PermissionResponse =
          controller.getPermissions(mockRequest);

        expect(result).toEqual({
          authType: 'jwt',
          permissions: ['admin:all', 'projects:manage'],
          user: {
            userId: 'user-789',
            email: 'test@example.com',
          },
        });
      });

      it('should return correct permissions for JWT auth with scope string', () => {
        const mockRequest = {
          authType: 'jwt',
          user: {
            userId: 'user-789',
            email: 'test@example.com',
            scope: 'read:projects write:projects send:messages',
          },
        };

        const result: PermissionResponse =
          controller.getPermissions(mockRequest);

        expect(result).toEqual({
          authType: 'jwt',
          permissions: ['read:projects', 'write:projects', 'send:messages'],
          user: {
            userId: 'user-789',
            email: 'test@example.com',
          },
        });
      });

      it('should combine permissions and scopes for JWT auth', () => {
        const mockRequest = {
          authType: 'jwt',
          user: {
            userId: 'user-789',
            email: 'test@example.com',
            permissions: ['admin:all'],
            scope: 'read:projects write:projects',
          },
        };

        const result: PermissionResponse =
          controller.getPermissions(mockRequest);

        expect(result.permissions).toEqual([
          'admin:all',
          'read:projects',
          'write:projects',
        ]);
        expect(result.authType).toBe('jwt');
      });

      it('should handle JWT auth with no permissions or scopes', () => {
        const mockRequest = {
          authType: 'jwt',
          user: {
            userId: 'user-789',
            email: 'test@example.com',
          },
        };

        const result: PermissionResponse =
          controller.getPermissions(mockRequest);

        expect(result.permissions).toEqual([]);
        expect(result.authType).toBe('jwt');
      });

      it('should handle JWT auth with undefined permissions and empty scope', () => {
        const mockRequest = {
          authType: 'jwt',
          user: {
            userId: 'user-789',
            email: 'test@example.com',
            permissions: undefined,
            scope: '',
          },
        };

        const result: PermissionResponse =
          controller.getPermissions(mockRequest);

        expect(result.permissions).toEqual([]);
        expect(result.authType).toBe('jwt');
      });

      it('should handle JWT auth without email', () => {
        const mockRequest = {
          authType: 'jwt',
          user: {
            userId: 'user-789',
            permissions: ['read:projects'],
          },
        };

        const result: PermissionResponse =
          controller.getPermissions(mockRequest);

        expect(result.user).toEqual({
          userId: 'user-789',
          email: undefined,
        });
      });

      it('should throw error when user is missing', () => {
        const mockRequest = {
          authType: 'jwt',
        };

        expect(() => controller.getPermissions(mockRequest)).toThrow(
          'User not found',
        );
      });
    });

    describe('Error Cases', () => {
      it('should throw error when authType is missing', () => {
        const mockRequest = {
          user: {
            userId: 'user-789',
            email: 'test@example.com',
          },
        };

        expect(() => controller.getPermissions(mockRequest)).toThrow(
          'Authentication type not found',
        );
      });

      it('should throw error for unknown authType', () => {
        const mockRequest = {
          authType: 'unknown-auth',
          user: {
            userId: 'user-789',
            email: 'test@example.com',
          },
        };

        const result: PermissionResponse =
          controller.getPermissions(mockRequest);

        // Should return empty permissions for unknown auth type
        expect(result).toEqual({
          authType: 'unknown-auth',
          permissions: [],
        });
      });
    });

    describe('Edge Cases', () => {
      it('should handle null request object', () => {
        expect(() => controller.getPermissions(null as any)).toThrow(
          'Authentication type not found',
        );
      });

      it('should handle undefined request object', () => {
        expect(() => controller.getPermissions(undefined as any)).toThrow(
          'Authentication type not found',
        );
      });

      it('should handle empty request object', () => {
        const mockRequest = {};

        expect(() => controller.getPermissions(mockRequest as any)).toThrow(
          'Authentication type not found',
        );
      });
    });
  });
});
