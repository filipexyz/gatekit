import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { MembersService } from '../../members/members.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let membersService: MembersService;

  const mockUser = {
    id: 'user-1',
    auth0Id: 'auth0|123456',
    email: 'test@example.com',
    name: 'Test User',
    isAdmin: false,
  };

  describe('with Auth0 configuration', () => {
    beforeEach(async () => {
      const mockMembersService = {
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
            provide: MembersService,
            useValue: mockMembersService,
          },
        ],
      }).compile();

      strategy = module.get<JwtStrategy>(JwtStrategy);
      membersService = module.get<MembersService>(MembersService);
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

      const result = (await strategy.validate(payload)) as any;

      expect(membersService.upsertFromAuth0).toHaveBeenCalledWith({
        sub: 'auth0|123456',
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(result).toEqual({
        userId: 'auth0|123456',
        email: 'test@example.com',
        name: 'Test User',
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

      const result = (await strategy.validate(payload)) as any;

      expect(result).toEqual({
        userId: 'auth0|123456',
        email: 'test@example.com',
        name: undefined,
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

      const mockMembersService = {
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
            provide: MembersService,
            useValue: mockMembersService,
          },
        ],
      }).compile();

      strategy = module.get<JwtStrategy>(JwtStrategy);

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
