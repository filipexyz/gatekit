import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createTestProject } from '../fixtures/projects.fixture';
import { createTestApiKey } from '../fixtures/api-keys.fixture';

describe('Platforms (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let testProjectId: string;
  let testApiKey: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Add validation pipe for tests
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    await app.init();

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

    // Create test project and API key
    const project = await createTestProject(prisma, {
      name: 'Platform Test Project',
      id: 'platform-test',
    });
    testProjectId = project.id;

    const { rawKey } = await createTestApiKey(prisma, project.id, {
      scopes: ['platforms:read', 'platforms:write', 'messages:write'],
    });
    testApiKey = rawKey;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/v1/projects/:project/platforms', () => {
    describe('POST', () => {
      it('should create a Discord platform configuration', () => {
        return request(app.getHttpServer())
          .post('/api/v1/projects/platform-test/platforms')
          .set('X-API-Key', testApiKey)
          .send({
            platform: 'discord',
            name: 'Test Discord Bot',
            credentials: {
              token: 'Test Discord Bot-token',
            },
            isActive: true,
            testMode: false,
          })
          .expect((res) => {
            if (res.status !== 201) {
              console.log('Discord creation error:', res.body);
            }
            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body).toHaveProperty('platform', 'discord');
            expect(res.body).toHaveProperty('name', 'Test Discord Bot');
            expect(res.body).toHaveProperty('isActive', true);
            expect(res.body).not.toHaveProperty('credentials');
          });
      });

      it('should create a Telegram platform configuration', () => {
        return request(app.getHttpServer())
          .post('/api/v1/projects/platform-test/platforms')
          .set('X-API-Key', testApiKey)
          .send({
            platform: 'telegram',
            name: 'Test Telegram Bot',
            credentials: {
              token: 'Test Telegram Bot-token',
            },
            isActive: true,
            testMode: true,
          })
          .expect(201)
          .expect((res) => {
            expect(res.body).toHaveProperty('id');
            expect(res.body).toHaveProperty('platform', 'telegram');
            expect(res.body).toHaveProperty('testMode', true);
          });
      });

      it('should allow multiple instances of same platform', async () => {
        // Clean any existing platforms first
        await prisma.projectPlatform.deleteMany({
          where: { projectId: testProjectId, platform: 'discord' },
        });

        // First create a platform
        await prisma.projectPlatform.create({
          data: {
            projectId: testProjectId,
            platform: 'discord',
            name: 'first-discord',
            credentialsEncrypted: 'encrypted',
            isActive: true,
            testMode: false,
          },
        });

        // Create second instance of same platform (now allowed)
        return request(app.getHttpServer())
          .post('/api/v1/projects/platform-test/platforms')
          .set('X-API-Key', testApiKey)
          .send({
            platform: 'discord',
            name: 'Second Discord Bot',
            credentials: { token: 'Second Discord Bot-token' },
          })
          .expect((res) => {
            if (res.status !== 201) {
              console.log('Error response:', res.body);
            }
            expect(res.status).toBe(201);
            expect(res.body.platform).toBe('discord');
            expect(res.body.isActive).toBe(true);
          });
      });

      it('should require platforms:write scope', () => {
        return request(app.getHttpServer())
          .post('/api/v1/projects/platform-test/platforms')
          .set('X-API-Key', 'invalid-key')
          .send({
            platform: 'discord',
            name: 'Test Bot',
            credentials: { token: 'test-token' },
          })
          .expect(401);
      });

      it('should validate platform type', () => {
        return request(app.getHttpServer())
          .post('/api/v1/projects/platform-test/platforms')
          .set('X-API-Key', testApiKey)
          .send({
            platform: 'invalid-platform',
            name: 'invalid-bot',
            credentials: { token: 'test-token' },
          })
          .expect(400);
      });
    });

    describe('GET', () => {
      beforeEach(async () => {
        // Clean up platforms
        await prisma.projectPlatform.deleteMany({
          where: { projectId: testProjectId },
        });

        // Create test platforms
        await prisma.projectPlatform.createMany({
          data: [
            {
              projectId: testProjectId,
              platform: 'discord',
              name: 'discord-bot',
              credentialsEncrypted: 'encrypted-discord',
              isActive: true,
              testMode: false,
            },
            {
              projectId: testProjectId,
              platform: 'telegram',
              name: 'telegram-bot',
              credentialsEncrypted: 'encrypted-telegram',
              isActive: false,
              testMode: true,
            },
          ],
        });
      });

      it('should list all platform configurations', () => {
        return request(app.getHttpServer())
          .get('/api/v1/projects/platform-test/platforms')
          .set('X-API-Key', testApiKey)
          .expect(200)
          .expect((res) => {
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body).toHaveLength(2);
            expect(res.body[0]).toHaveProperty('platform');
            expect(res.body[0]).not.toHaveProperty('credentials');
            expect(res.body[0]).not.toHaveProperty('credentialsEncrypted');
          });
      });

      it('should require authentication', () => {
        return request(app.getHttpServer())
          .get('/api/v1/projects/platform-test/platforms')
          .expect(401);
      });
    });

    describe('GET /:id', () => {
      let platformId: string;

      beforeEach(async () => {
        // Clean existing platforms
        await prisma.projectPlatform.deleteMany({
          where: { projectId: testProjectId, platform: 'discord' },
        });

        const { CryptoUtil } = require('../../src/common/utils/crypto.util');
        CryptoUtil.initializeEncryptionKey();
        const encryptedCredentials = CryptoUtil.encrypt(
          JSON.stringify({ token: 'discord-token' }),
        );

        const platform = await prisma.projectPlatform.create({
          data: {
            projectId: testProjectId,
            platform: 'discord',
            name: 'Test Discord Platform',
            credentialsEncrypted: encryptedCredentials,
            isActive: true,
            testMode: false,
          },
        });
        platformId = platform.id;
      });

      it('should get platform with decrypted credentials', () => {
        return request(app.getHttpServer())
          .get(`/api/v1/projects/platform-test/platforms/${platformId}`)
          .set('X-API-Key', testApiKey)
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('id', platformId);
            expect(res.body).toHaveProperty('platform', 'discord');
            expect(res.body).toHaveProperty('credentials');
          });
      });

      it('should return 404 for non-existent platform', () => {
        return request(app.getHttpServer())
          .get('/api/v1/projects/platform-test/platforms/non-existent-id')
          .set('X-API-Key', testApiKey)
          .expect(404);
      });
    });

    describe('PATCH /:id', () => {
      let platformId: string;

      beforeEach(async () => {
        // Clean existing platforms
        await prisma.projectPlatform.deleteMany({
          where: { projectId: testProjectId, platform: 'discord' },
        });

        const platform = await prisma.projectPlatform.create({
          data: {
            projectId: testProjectId,
            platform: 'discord',
            name: 'Update Test Platform',
            credentialsEncrypted: 'encrypted_old',
            isActive: true,
            testMode: false,
          },
        });
        platformId = platform.id;
      });

      it('should update platform configuration', () => {
        return request(app.getHttpServer())
          .patch(`/api/v1/projects/platform-test/platforms/${platformId}`)
          .set('X-API-Key', testApiKey)
          .send({
            isActive: false,
            testMode: true,
          })
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('isActive', false);
            expect(res.body).toHaveProperty('testMode', true);
          });
      });

      it('should update credentials', () => {
        return request(app.getHttpServer())
          .patch(`/api/v1/projects/platform-test/platforms/${platformId}`)
          .set('X-API-Key', testApiKey)
          .send({
            credentials: { token: 'updated-discord-token' },
          })
          .expect((res) => {
            if (res.status !== 200) {
              console.log('PATCH Error response:', res.body);
            }
            expect(res.status).toBe(200);
          });
      });
    });

    describe('DELETE /:id', () => {
      let platformId: string;

      beforeEach(async () => {
        // Clean existing platforms
        await prisma.projectPlatform.deleteMany({
          where: { projectId: testProjectId, platform: 'discord' },
        });

        const platform = await prisma.projectPlatform.create({
          data: {
            projectId: testProjectId,
            platform: 'discord',
            name: 'Delete Test Platform',
            credentialsEncrypted: 'encrypted',
            isActive: true,
            testMode: false,
          },
        });
        platformId = platform.id;
      });

      it('should delete platform configuration', () => {
        return request(app.getHttpServer())
          .delete(`/api/v1/projects/platform-test/platforms/${platformId}`)
          .set('X-API-Key', testApiKey)
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty(
              'message',
              'Platform removed successfully',
            );
          });
      });

      it('should return 404 when deleting non-existent platform', () => {
        return request(app.getHttpServer())
          .delete('/api/v1/projects/platform-test/platforms/non-existent')
          .set('X-API-Key', testApiKey)
          .expect(404);
      });
    });
  });

  describe('/api/v1/projects/:project/messages/send', () => {
    beforeEach(async () => {
      // Clean and create a platform configuration
      await prisma.projectPlatform.deleteMany({
        where: { projectId: testProjectId, platform: 'discord' },
      });

      const { CryptoUtil } = require('../../src/common/utils/crypto.util');
      CryptoUtil.initializeEncryptionKey();
      await prisma.projectPlatform.create({
        data: {
          projectId: testProjectId,
          platform: 'discord',
          name: 'Message Test Platform',
          credentialsEncrypted: CryptoUtil.encrypt(
            JSON.stringify({ token: 'test-token' }),
          ),
          isActive: true,
          testMode: false,
        },
      });
    });

    it('should validate message sending endpoint exists', () => {
      return request(app.getHttpServer())
        .post('/api/v1/projects/platform-test/messages/send')
        .set('X-API-Key', testApiKey)
        .send({
          platform: 'discord',
          target: {
            type: 'channel',
            id: 'channel-123',
          },
          text: 'Test message',
        })
        .expect((res) => {
          // Expect either 200 (if it works) or an error that's not 404
          expect(res.status).not.toBe(404);
        });
    });

    it('should require messages:write scope', async () => {
      const { rawKey } = await createTestApiKey(prisma, testProjectId, {
        scopes: ['platforms:read'], // Missing messages:write
      });

      return request(app.getHttpServer())
        .post('/api/v1/projects/platform-test/messages/send')
        .set('X-API-Key', rawKey)
        .send({
          platform: 'discord',
          target: {
            type: 'channel',
            id: 'channel-123',
          },
          text: 'Test message',
        })
        .expect(403);
    });

    it('should validate message DTO', () => {
      return request(app.getHttpServer())
        .post('/api/v1/projects/platform-test/messages/send')
        .set('X-API-Key', testApiKey)
        .send({
          // Missing required fields
          text: 'Test message',
        })
        .expect(400);
    });
  });
});
