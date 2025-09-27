import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../../users/users.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let configService: ConfigService;
  let usersService: UsersService;

  const mockUser = {
    id: 'user-1',
    auth0Id: 'auth0|123456',
    email: 'test@example.com',
    name: 'Test User',
    isAdmin: false,
  };

  describe('with Auth0 configuration', () => {
    beforeEach(async () => {
      const mockUsersService = {
        upsertFromAuth0: jest.fn().mockResolvedValue(mockUser),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          JwtStrategy,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'app.auth0') {
                  return {
                    domain: 'test.auth0.com',
                    audience: 'https://api.test.com',
                    clientId: 'test-client-id',
                    clientSecret: 'test-client-secret',
                  };
                }
                return null;
              }),
            },
          },
          {
            provide: UsersService,
            useValue: mockUsersService,
          },
        ],
      }).compile();

      strategy = module.get<JwtStrategy>(JwtStrategy);
      configService = module.get<ConfigService>(ConfigService);
      usersService = module.get<UsersService>(UsersService);
    });

    it('should be defined', () => {
      expect(strategy).toBeDefined();
    });

    it('should validate and return user from JWT payload', async () => {
      const payload = {
        sub: 'auth0|123456',
        email: 'test@example.com',
        name: 'Test User',
        permissions: ['projects:read', 'projects:write'],
        scope: 'openid profile email',
      };

      const result = await strategy.validate(payload);

      expect(usersService.upsertFromAuth0).toHaveBeenCalledWith({
        sub: 'auth0|123456',
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(result).toEqual({
        userId: 'auth0|123456',
        email: 'test@example.com',
        permissions: ['projects:read', 'projects:write'],
        scope: 'openid profile email',
        user: mockUser,
      });
    });

    it('should handle payload without permissions', async () => {
      const payload = {
        sub: 'auth0|123456',
        email: 'test@example.com',
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        userId: 'auth0|123456',
        email: 'test@example.com',
        permissions: [],
        scope: undefined,
        user: mockUser,
      });
    });

    it('should throw UnauthorizedException for invalid payload', async () => {
      await expect(strategy.validate(null)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(strategy.validate(null)).rejects.toThrow('Invalid token');
    });
  });

  describe('without Auth0 configuration', () => {
    beforeEach(async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockUsersService = {
        upsertFromAuth0: jest.fn().mockResolvedValue(mockUser),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          JwtStrategy,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'app.auth0') {
                  return {
                    domain: '',
                    audience: '',
                    clientId: '',
                    clientSecret: '',
                  };
                }
                return null;
              }),
            },
          },
          {
            provide: UsersService,
            useValue: mockUsersService,
          },
        ],
      }).compile();

      strategy = module.get<JwtStrategy>(JwtStrategy);
      configService = module.get<ConfigService>(ConfigService);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Auth0 configuration not found. JWT authentication will be disabled.',
      );
      consoleWarnSpy.mockRestore();
    });

    it('should be defined even without config', () => {
      expect(strategy).toBeDefined();
    });

    it('should throw UnauthorizedException when validating', async () => {
      const payload = {
        sub: 'auth0|123456',
        email: 'test@example.com',
      };

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(strategy.validate(payload)).rejects.toThrow(
        'Auth0 not configured',
      );
    });
  });
});
