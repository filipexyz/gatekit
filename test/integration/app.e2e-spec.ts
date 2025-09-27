import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createTestProject } from '../fixtures/projects.fixture';
import { createTestApiKey } from '../fixtures/api-keys.fixture';

describe('GateKit API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let testApiKey: string;
  let testProjectId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Clean database in correct order (respecting foreign keys)
    await prisma.apiKeyScope.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.receivedMessage.deleteMany();
    await prisma.sentMessage.deleteMany();
    await prisma.platformLog.deleteMany();
    await prisma.projectPlatform.deleteMany();
    await prisma.projectMember.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();

    // Create test project and API key with proper scopes
    const project = await createTestProject(prisma, {
      name: 'E2E Test Project',
    });
    testProjectId = project.id;

    const { rawKey } = await createTestApiKey(prisma, project.id, {
      scopes: [
        'messages:send',
        'messages:read',
        'projects:read',
        'projects:write',
        'keys:manage',
        'keys:read',
      ],
    });
    testApiKey = rawKey;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/v1/health (GET)', () => {
    it('should return health status without authentication', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body.data).toHaveProperty('status', 'healthy');
        });
    });
  });

  describe('Authentication', () => {
    it('should reject requests without API key', () => {
      return request(app.getHttpServer())
        .get('/api/v1/projects')
        .expect(401)
        .expect((res) => {
          expect(res.body).toHaveProperty(
            'message',
            'Authentication required. Provide either an API key or Bearer token.',
          );
        });
    });

    it('should reject requests with invalid API key', () => {
      return request(app.getHttpServer())
        .get('/api/v1/projects')
        .set('X-API-Key', 'invalid-key')
        .expect(401)
        .expect((res) => {
          expect(res.body).toHaveProperty('message', 'Invalid API key');
        });
    });

    it('should accept requests with valid API key', () => {
      return request(app.getHttpServer())
        .get('/api/v1/projects')
        .set('X-API-Key', testApiKey)
        .expect(200);
    });
  });

  describe('/api/v1/projects', () => {
    describe('GET /api/v1/projects', () => {
      it('should return all projects with valid API key', () => {
        return request(app.getHttpServer())
          .get('/api/v1/projects')
          .set('X-API-Key', testApiKey)
          .expect(200)
          .expect((res) => {
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body).toHaveLength(1);
            expect(res.body[0]).toHaveProperty('name', 'E2E Test Project');
          });
      });

      it('should return 401 without API key', () => {
        return request(app.getHttpServer()).get('/api/v1/projects').expect(401);
      });
    });

    describe('POST /api/v1/projects', () => {
      it('should create a new project with valid API key', () => {
        const projectData = {
          name: 'New Project',
          environment: 'development',
        };

        return request(app.getHttpServer())
          .post('/api/v1/projects')
          .set('X-API-Key', testApiKey)
          .send(projectData)
          .expect(201)
          .expect((res) => {
            expect(res.body).toHaveProperty('name', 'New Project');
            expect(res.body).toHaveProperty('slug', 'new-project');
            expect(res.body).toHaveProperty('environment', 'development');
          });
      });

      it('should return 401 without API key', () => {
        const projectData = {
          name: 'Unauthorized Project',
          environment: 'development',
        };

        return request(app.getHttpServer())
          .post('/api/v1/projects')
          .send(projectData)
          .expect(401);
      });

      it('should return 400 for invalid environment with valid API key', () => {
        const projectData = {
          name: 'Invalid Project',
          environment: 'invalid-env',
        };

        return request(app.getHttpServer())
          .post('/api/v1/projects')
          .set('X-API-Key', testApiKey)
          .send(projectData)
          .expect(400);
      });

      it('should return 409 when slug already exists', async () => {
        await createTestProject(prisma, { name: 'Existing', slug: 'existing' });

        const projectData = {
          name: 'Existing',
          slug: 'existing',
        };

        return request(app.getHttpServer())
          .post('/api/v1/projects')
          .set('X-API-Key', testApiKey)
          .send(projectData)
          .expect(409);
      });
    });

    describe('GET /api/v1/projects/:slug', () => {
      it('should return project details with valid API key', () => {
        return request(app.getHttpServer())
          .get('/api/v1/projects/e2e-test-project')
          .set('X-API-Key', testApiKey)
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('name', 'E2E Test Project');
            expect(res.body).toHaveProperty('apiKeys');
            expect(res.body.apiKeys.length).toBeGreaterThanOrEqual(1);
          });
      });

      it('should return 401 without API key', () => {
        return request(app.getHttpServer())
          .get('/api/v1/projects/e2e-test-project')
          .expect(401);
      });

      it('should return 404 for non-existent project with valid API key', () => {
        return request(app.getHttpServer())
          .get('/api/v1/projects/non-existent')
          .set('X-API-Key', testApiKey)
          .expect(404);
      });
    });
  });

  describe('/api/v1/projects/:slug/keys', () => {
    describe('POST /api/v1/projects/:slug/keys', () => {
      it('should create a new API key with valid API key', () => {
        const keyData = {
          name: 'New API Key',
          scopes: ['messages:send'],
        };

        return request(app.getHttpServer())
          .post('/api/v1/projects/e2e-test-project/keys')
          .set('X-API-Key', testApiKey)
          .send(keyData)
          .expect(201)
          .expect((res) => {
            expect(res.body).toHaveProperty('key');
            expect(res.body.key).toMatch(/^gk_dev_/);
            expect(res.body).toHaveProperty('name', 'New API Key');
            expect(res.body.scopes).toEqual(['messages:send']);
          });
      });

      it('should return 401 without API key', () => {
        const keyData = {
          name: 'Unauthorized Key',
          scopes: ['messages:send'],
        };

        return request(app.getHttpServer())
          .post('/api/v1/projects/e2e-test-project/keys')
          .send(keyData)
          .expect(401);
      });

      it('should return 400 for missing scopes with valid API key', () => {
        const keyData = {
          name: 'Invalid Key',
        };

        return request(app.getHttpServer())
          .post('/api/v1/projects/e2e-test-project/keys')
          .set('X-API-Key', testApiKey)
          .send(keyData)
          .expect(400);
      });

      it('should return 404 for non-existent project with valid API key', () => {
        const keyData = {
          name: 'Key for Non-existent',
          scopes: ['messages:send'],
        };

        return request(app.getHttpServer())
          .post('/api/v1/projects/non-existent/keys')
          .set('X-API-Key', testApiKey)
          .send(keyData)
          .expect(404);
      });
    });

    describe('GET /api/v1/projects/:slug/keys', () => {
      it('should list project API keys with valid API key', () => {
        return request(app.getHttpServer())
          .get('/api/v1/projects/e2e-test-project/keys')
          .set('X-API-Key', testApiKey)
          .expect(200)
          .expect((res) => {
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBeGreaterThan(0);
            expect(res.body[0]).toHaveProperty('name');
            expect(res.body[0]).toHaveProperty('maskedKey');
            expect(res.body[0].maskedKey).toMatch(/^gk_dev_.*\.\.\..*$/);
          });
      });

      it('should return 401 without API key', () => {
        return request(app.getHttpServer())
          .get('/api/v1/projects/e2e-test-project/keys')
          .expect(401);
      });
    });

    describe('DELETE /api/v1/projects/:slug/keys/:keyId', () => {
      it('should revoke an API key with valid API key', async () => {
        const { apiKey } = await createTestApiKey(prisma, testProjectId, {
          name: 'Key to Revoke',
        });

        return request(app.getHttpServer())
          .delete(`/api/v1/projects/e2e-test-project/keys/${apiKey.id}`)
          .set('X-API-Key', testApiKey)
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty(
              'message',
              'API key revoked successfully',
            );
          });
      });

      it('should return 401 without API key', () => {
        return request(app.getHttpServer())
          .delete('/api/v1/projects/e2e-test-project/keys/some-id')
          .expect(401);
      });

      it('should return 404 for non-existent key with valid API key', () => {
        return request(app.getHttpServer())
          .delete('/api/v1/projects/e2e-test-project/keys/non-existent-id')
          .set('X-API-Key', testApiKey)
          .expect(404);
      });
    });

    describe('POST /api/v1/projects/:slug/keys/:keyId/roll', () => {
      it('should roll an API key with valid API key', async () => {
        const { apiKey } = await createTestApiKey(prisma, testProjectId, {
          name: 'Key to Roll',
        });

        return request(app.getHttpServer())
          .post(`/api/v1/projects/e2e-test-project/keys/${apiKey.id}/roll`)
          .set('X-API-Key', testApiKey)
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('key');
            expect(res.body.key).toMatch(/^gk_dev_/);
            expect(res.body).toHaveProperty('name', 'Key to Roll');
            expect(res.body).toHaveProperty('oldKeyRevokedAt');
          });
      });

      it('should return 401 without API key', () => {
        return request(app.getHttpServer())
          .post('/api/v1/projects/e2e-test-project/keys/some-id/roll')
          .expect(401);
      });
    });
  });

  describe('API Key Validation', () => {
    it('should accept expired API key returns 401', async () => {
      const { rawKey } = await createTestApiKey(prisma, testProjectId, {
        name: 'Expired Key',
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      });

      return request(app.getHttpServer())
        .get('/api/v1/projects')
        .set('X-API-Key', rawKey)
        .expect(401)
        .expect((res) => {
          expect(res.body).toHaveProperty('message', 'Invalid API key');
        });
    });

    it('should reject revoked API key with 401', async () => {
      const { rawKey } = await createTestApiKey(prisma, testProjectId, {
        name: 'Revoked Key',
        revokedAt: new Date(Date.now() - 1000), // Revoked 1 second ago
      });

      return request(app.getHttpServer())
        .get('/api/v1/projects')
        .set('X-API-Key', rawKey)
        .expect(401)
        .expect((res) => {
          expect(res.body).toHaveProperty('message', 'Invalid API key');
        });
    });
  });

  describe('Scope Authorization', () => {
    it('should reject API key without required scope', async () => {
      // Create key with limited scopes - only messages:read, no projects:write
      const { rawKey } = await createTestApiKey(prisma, testProjectId, {
        name: 'Limited Scope Key',
        scopes: ['messages:read', 'projects:read'], // Can read but not write projects
      });

      const projectData = {
        name: 'Should Fail',
        environment: 'development',
      };

      // First verify the key is valid by reading projects
      await request(app.getHttpServer())
        .get('/api/v1/projects')
        .set('X-API-Key', rawKey)
        .expect(200);

      // Now try to create a project - should fail with 403 due to insufficient scope
      return request(app.getHttpServer())
        .post('/api/v1/projects')
        .set('X-API-Key', rawKey)
        .send(projectData)
        .expect(403) // Must return 403 for valid key with insufficient permissions
        .expect((res) => {
          expect(res.body.message).toBe('Insufficient permissions');
        });
    });

    it('should allow API key with proper scope', async () => {
      // Key already has projects:read scope
      return request(app.getHttpServer())
        .get('/api/v1/projects')
        .set('X-API-Key', testApiKey)
        .expect(200);
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting per API key', async () => {
      // Note: Rate limiting is configured but may need adjustment for testing
      // This test ensures the header is present
      const response = await request(app.getHttpServer())
        .get('/api/v1/projects')
        .set('X-API-Key', testApiKey);

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
    });
  });
});
