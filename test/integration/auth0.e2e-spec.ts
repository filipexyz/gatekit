import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { createTestProject } from '../fixtures/projects.fixture';
import { createTestApiKey } from '../fixtures/api-keys.fixture';

describe('Auth0 Authentication (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let configService: ConfigService;
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
    configService = moduleFixture.get<ConfigService>(ConfigService);

    // Clean database in correct order (respecting foreign keys)
    await prisma.apiKeyUsage.deleteMany();
    await prisma.apiKeyScope.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.receivedMessage.deleteMany();
    await prisma.sentMessage.deleteMany();
    await prisma.platformLog.deleteMany();
    await prisma.projectPlatform.deleteMany();
    await prisma.projectMember.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();

    // Create test data
    const project = await createTestProject(prisma, {
      name: 'Auth0 Test Project',
    });
    testProjectId = project.id;

    const { rawKey } = await createTestApiKey(prisma, project.id, {
      scopes: ['projects:read', 'projects:write'],
    });
    testApiKey = rawKey;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Without Auth0 configuration', () => {
    it('should reject invalid JWT tokens', () => {
      return request(app.getHttpServer())
        .get('/api/v1/projects')
        .set('Authorization', 'Bearer any.jwt.token')
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toBe('Invalid or expired token');
        });
    });

    it('should accept API key authentication', () => {
      return request(app.getHttpServer())
        .get('/api/v1/projects')
        .set('X-API-Key', testApiKey)
        .expect(200);
    });

    it('should show proper error message for missing auth', () => {
      return request(app.getHttpServer())
        .get('/api/v1/projects')
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toBe(
            'Authentication required. Provide either an API key or Bearer token.',
          );
        });
    });
  });

  describe('Mixed authentication scenarios', () => {
    it('should prefer API key when both headers are present', () => {
      return request(app.getHttpServer())
        .get('/api/v1/projects')
        .set('X-API-Key', testApiKey)
        .set('Authorization', 'Bearer fake.jwt.token')
        .expect(200);
    });

    it('should reject invalid API key even with Bearer token present', () => {
      return request(app.getHttpServer())
        .get('/api/v1/projects')
        .set('X-API-Key', 'invalid-api-key')
        .set('Authorization', 'Bearer fake.jwt.token')
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toBe('Invalid API key');
        });
    });
  });

  describe('Authorization with scopes', () => {
    let limitedApiKey: string;

    beforeAll(async () => {
      const { rawKey } = await createTestApiKey(prisma, testProjectId, {
        name: 'Limited Key',
        scopes: ['projects:read'], // Only read permission
      });
      limitedApiKey = rawKey;
    });

    it('should allow access with sufficient scopes', () => {
      return request(app.getHttpServer())
        .get('/api/v1/projects')
        .set('X-API-Key', limitedApiKey)
        .expect(200);
    });

    it('should deny access with insufficient scopes', () => {
      return request(app.getHttpServer())
        .post('/api/v1/projects')
        .set('X-API-Key', limitedApiKey)
        .send({
          name: 'New Project',
          environment: 'development',
        })
        .expect(403)
        .expect((res) => {
          expect(res.body.message).toBe('Insufficient permissions');
        });
    });
  });

  describe('Health endpoint', () => {
    it('should remain public with no authentication', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('healthy');
          expect(res.body.version).toBeDefined();
          expect(typeof res.body.setupRequired).toBe('boolean');
          expect(res.body.timestamp).toBeDefined();
        });
    });

    it('should accept but not require Bearer token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .set('Authorization', 'Bearer fake.jwt.token')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('healthy');
          expect(res.body.version).toBeDefined();
        });
    });

    it('should accept but not require API key', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .set('X-API-Key', 'any-key')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('healthy');
          expect(res.body.version).toBeDefined();
        });
    });
  });

  describe('Error message consistency', () => {
    it('should return consistent error format for authentication failures', async () => {
      const responses = await Promise.all([
        request(app.getHttpServer()).get('/api/v1/projects').expect(401),
        request(app.getHttpServer())
          .get('/api/v1/projects')
          .set('X-API-Key', 'invalid')
          .expect(401),
        request(app.getHttpServer())
          .get('/api/v1/projects')
          .set('Authorization', 'Bearer invalid')
          .expect(401),
      ]);

      responses.forEach((res) => {
        expect(res.body).toHaveProperty('statusCode', 401);
        expect(res.body).toHaveProperty('error', 'Unauthorized');
        expect(res.body).toHaveProperty('message');
        expect(typeof res.body.message).toBe('string');
      });
    });

    it('should return consistent error format for authorization failures', () => {
      return request(app.getHttpServer())
        .post('/api/v1/projects')
        .set('X-API-Key', testApiKey)
        .send({}) // Invalid body
        .expect(400)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 400);
          expect(res.body).toHaveProperty('error', 'Bad Request');
          expect(res.body).toHaveProperty('message');
        });
    });
  });
});
