import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
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

    prisma = app.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    // Clean database
    await prisma.apiKeyUsage.deleteMany();
    await prisma.apiKeyScope.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.projectPlatform.deleteMany();
    await prisma.project.deleteMany();

    // Create test project and API key
    const project = await createTestProject(prisma, { name: 'E2E Test Project' });
    testProjectId = project.id;

    const { rawKey } = await createTestApiKey(prisma, project.id, {
      scopes: ['messages:send', 'messages:read'],
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

  describe('/api/v1/projects', () => {
    describe('GET /api/v1/projects', () => {
      it('should return all projects', () => {
        return request(app.getHttpServer())
          .get('/api/v1/projects')
          .expect(200)
          .expect((res) => {
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body).toHaveLength(1);
            expect(res.body[0]).toHaveProperty('name', 'E2E Test Project');
          });
      });
    });

    describe('POST /api/v1/projects', () => {
      it('should create a new project', () => {
        const projectData = {
          name: 'New Project',
          environment: 'development',
        };

        return request(app.getHttpServer())
          .post('/api/v1/projects')
          .send(projectData)
          .expect(201)
          .expect((res) => {
            expect(res.body).toHaveProperty('name', 'New Project');
            expect(res.body).toHaveProperty('slug', 'new-project');
            expect(res.body).toHaveProperty('environment', 'development');
          });
      });

      it('should return 400 for invalid environment', () => {
        const projectData = {
          name: 'Invalid Project',
          environment: 'invalid-env',
        };

        return request(app.getHttpServer())
          .post('/api/v1/projects')
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
          .send(projectData)
          .expect(409);
      });
    });

    describe('GET /api/v1/projects/:slug', () => {
      it('should return project details', () => {
        return request(app.getHttpServer())
          .get('/api/v1/projects/e2e-test-project')
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('name', 'E2E Test Project');
            expect(res.body).toHaveProperty('apiKeys');
            expect(res.body.apiKeys).toHaveLength(1);
          });
      });

      it('should return 404 for non-existent project', () => {
        return request(app.getHttpServer())
          .get('/api/v1/projects/non-existent')
          .expect(404);
      });
    });
  });

  describe('/api/v1/projects/:slug/keys', () => {
    describe('POST /api/v1/projects/:slug/keys', () => {
      it('should create a new API key', () => {
        const keyData = {
          name: 'New API Key',
          environment: 'production',
          scopes: ['messages:send'],
          expiresInDays: 30,
        };

        return request(app.getHttpServer())
          .post('/api/v1/projects/e2e-test-project/keys')
          .send(keyData)
          .expect(201)
          .expect((res) => {
            expect(res.body).toHaveProperty('key');
            expect(res.body.key).toMatch(/^gk_live_/);
            expect(res.body).toHaveProperty('name', 'New API Key');
            expect(res.body).toHaveProperty('environment', 'production');
            expect(res.body.scopes).toEqual(['messages:send']);
            expect(res.body).toHaveProperty('expiresAt');
          });
      });

      it('should return 400 for invalid environment', () => {
        const keyData = {
          name: 'Invalid Key',
          environment: 'invalid',
        };

        return request(app.getHttpServer())
          .post('/api/v1/projects/e2e-test-project/keys')
          .send(keyData)
          .expect(400);
      });

      it('should return 404 for non-existent project', () => {
        const keyData = {
          name: 'Test Key',
          environment: 'test',
        };

        return request(app.getHttpServer())
          .post('/api/v1/projects/non-existent/keys')
          .send(keyData)
          .expect(404);
      });
    });

    describe('GET /api/v1/projects/:slug/keys', () => {
      it('should list project API keys', () => {
        return request(app.getHttpServer())
          .get('/api/v1/projects/e2e-test-project/keys')
          .expect(200)
          .expect((res) => {
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body).toHaveLength(1);
            expect(res.body[0]).toHaveProperty('maskedKey');
            expect(res.body[0]).not.toHaveProperty('keyHash');
          });
      });
    });

    describe('DELETE /api/v1/projects/:slug/keys/:keyId', () => {
      it('should revoke an API key', async () => {
        const apiKey = await prisma.apiKey.findFirst({
          where: { projectId: testProjectId },
        });

        return request(app.getHttpServer())
          .delete(`/api/v1/projects/e2e-test-project/keys/${apiKey.id}`)
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('message', 'API key revoked successfully');
          });
      });

      it('should return 404 for non-existent key', () => {
        return request(app.getHttpServer())
          .delete('/api/v1/projects/e2e-test-project/keys/non-existent-id')
          .expect(404);
      });
    });
  });

  describe('API Key Authentication', () => {
    it('should validate API key in X-API-Key header', async () => {
      // This would normally be a protected endpoint
      // For now, we test that the key exists and is valid
      const { ApiKeysService } = await import('../../src/api-keys/api-keys.service');
      const apiKeyService = app.get(ApiKeysService);
      const validated = await apiKeyService.validateApiKey(testApiKey);

      expect(validated).toBeTruthy();
      expect(validated.projectId).toBe(testProjectId);
      expect(validated.scopes).toContain('messages:send');
    });

    it('should reject invalid API key', async () => {
      const { ApiKeysService } = await import('../../src/api-keys/api-keys.service');
      const apiKeyService = app.get(ApiKeysService);
      const validated = await apiKeyService.validateApiKey('gk_test_invalid');

      expect(validated).toBeNull();
    });

    it('should reject expired API key', async () => {
      // Create expired key
      const { rawKey } = await createTestApiKey(prisma, testProjectId, {
        expiresAt: new Date(Date.now() - 86400000), // Expired yesterday
      });

      const { ApiKeysService } = await import('../../src/api-keys/api-keys.service');
      const apiKeyService = app.get(ApiKeysService);
      const validated = await apiKeyService.validateApiKey(rawKey);

      expect(validated).toBeNull();
    });

    it('should reject revoked API key', async () => {
      // Create and revoke key
      const { rawKey, apiKey } = await createTestApiKey(prisma, testProjectId);

      await prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { revokedAt: new Date() },
      });

      const { ApiKeysService } = await import('../../src/api-keys/api-keys.service');
      const apiKeyService = app.get(ApiKeysService);
      const validated = await apiKeyService.validateApiKey(rawKey);

      expect(validated).toBeNull();
    });
  });
});