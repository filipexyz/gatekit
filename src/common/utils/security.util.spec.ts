import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SecurityUtil, AuthContext } from './security.util';

describe('SecurityUtil', () => {
  const mockPrisma = {
    project: {
      findUnique: jest.fn(),
    },
  };

  const mockProject = {
    id: 'project-123',
    slug: 'test-project',
    name: 'Test Project',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getProjectWithAccess', () => {
    it('should return project when access is valid for API key', async () => {
      const authContext: AuthContext = {
        authType: 'api-key',
        project: { id: 'project-123', slug: 'test-project' },
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);

      const result = await SecurityUtil.getProjectWithAccess(
        mockPrisma,
        'test-project',
        authContext,
        'test operation',
      );

      expect(result).toEqual(mockProject);
      expect(mockPrisma.project.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-project' },
      });
    });

    it('should throw NotFoundException when project does not exist', async () => {
      const authContext: AuthContext = {
        authType: 'api-key',
        project: { id: 'project-123', slug: 'test-project' },
      };

      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(
        SecurityUtil.getProjectWithAccess(
          mockPrisma,
          'nonexistent-project',
          authContext,
          'test operation',
        ),
      ).rejects.toThrow(
        new NotFoundException("Project 'nonexistent-project' not found"),
      );
    });

    it('should throw ForbiddenException when API key belongs to different project', async () => {
      const authContext: AuthContext = {
        authType: 'api-key',
        project: { id: 'different-project-id', slug: 'different-project' },
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);

      await expect(
        SecurityUtil.getProjectWithAccess(
          mockPrisma,
          'test-project',
          authContext,
          'test operation',
        ),
      ).rejects.toThrow(
        new ForbiddenException(
          'API key does not have access to perform test operation',
        ),
      );
    });
  });

  describe('validateProjectAccess', () => {
    it('should pass validation for valid API key access', () => {
      const authContext: AuthContext = {
        authType: 'api-key',
        project: { id: 'project-123', slug: 'test-project' },
      };

      expect(() =>
        SecurityUtil.validateProjectAccess(
          authContext,
          'project-123',
          'test operation',
        ),
      ).not.toThrow();
    });

    it('should pass validation for valid JWT access', () => {
      const authContext: AuthContext = {
        authType: 'jwt',
        user: { userId: 'user-123', email: 'test@example.com' },
      };

      expect(() =>
        SecurityUtil.validateProjectAccess(
          authContext,
          'project-123',
          'test operation',
        ),
      ).not.toThrow();
    });

    it('should throw ForbiddenException when authContext is missing', () => {
      expect(() =>
        SecurityUtil.validateProjectAccess(
          null as any,
          'project-123',
          'test operation',
        ),
      ).toThrow(
        new ForbiddenException(
          'SECURITY ERROR: Authentication context missing for test operation. This indicates a guard bypass.',
        ),
      );
    });

    it('should throw ForbiddenException for invalid auth type', () => {
      const authContext = {
        authType: 'invalid',
      } as any;

      expect(() =>
        SecurityUtil.validateProjectAccess(
          authContext,
          'project-123',
          'test operation',
        ),
      ).toThrow(
        new ForbiddenException(
          'Invalid authentication type for test operation',
        ),
      );
    });

    it('should throw ForbiddenException when API key has no project', () => {
      const authContext: AuthContext = {
        authType: 'api-key',
        project: null as any,
      };

      expect(() =>
        SecurityUtil.validateProjectAccess(
          authContext,
          'project-123',
          'test operation',
        ),
      ).toThrow(
        new ForbiddenException(
          'API key does not have access to perform test operation',
        ),
      );
    });

    it('should throw ForbiddenException when JWT has no userId', () => {
      const authContext: AuthContext = {
        authType: 'jwt',
        user: { email: 'test@example.com' } as any,
      };

      expect(() =>
        SecurityUtil.validateProjectAccess(
          authContext,
          'project-123',
          'test operation',
        ),
      ).toThrow(
        new ForbiddenException('User context required for test operation'),
      );
    });
  });

  describe('extractAuthContext', () => {
    it('should extract auth context from request object', () => {
      const mockRequest = {
        authType: 'api-key',
        project: { id: 'project-123', slug: 'test-project' },
        user: null,
      };

      const result = SecurityUtil.extractAuthContext(mockRequest);

      expect(result).toEqual({
        authType: 'api-key',
        project: { id: 'project-123', slug: 'test-project' },
        user: null,
      });
    });

    it('should return null when request is null', () => {
      const result = SecurityUtil.extractAuthContext(null);
      expect(result).toBeNull();
    });

    it('should return null when request is undefined', () => {
      const result = SecurityUtil.extractAuthContext(undefined);
      expect(result).toBeNull();
    });
  });
});
