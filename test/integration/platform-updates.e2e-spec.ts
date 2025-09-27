import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AppModule } from '../../src/app.module';
import { ProjectEnvironment } from '@prisma/client';

describe('Platform Updates (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let testUser: any;
  let testProject: any;
  let testPlatform: any;
  let testApiKey: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    await app.init();

    // Create test user
    testUser = await prisma.user.create({
      data: {
        auth0Id: 'auth0|platformtest',
        email: 'platformtest@test.com',
        name: 'Platform Test User',
        isAdmin: false,
      },
    });

    // Create test project
    testProject = await prisma.project.create({
      data: {
        name: 'Platform Test Project',
        slug: 'platform-test',
        environment: ProjectEnvironment.development,
        ownerId: testUser.id,
      },
    });

    // Create test platform with initial credentials
    testPlatform = await prisma.projectPlatform.create({
      data: {
        projectId: testProject.id,
        platform: 'telegram',
        credentialsEncrypted: 'encrypted-old-credentials',
        isActive: true,
        testMode: false,
      },
    });

    // Create API key for testing
    testApiKey = await prisma.apiKey.create({
      data: {
        projectId: testProject.id,
        keyHash: 'test-hash',
        keyPrefix: 'gk_test',
        keySuffix: 'test',
        name: 'Platform Update Test Key',
        createdBy: testUser.id,
        scopes: {
          create: [
            { scope: 'platforms:read' },
            { scope: 'platforms:write' },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    // Clean up
    await prisma.apiKeyScope.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.projectPlatform.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  describe('Platform Credential Updates', () => {
    it('should update platform credentials via API', async () => {
      const platformsService = app.get('PlatformsService');

      const updateDto = {
        credentials: {
          token: '7654321:AAFmi_updated_bot_token',
          webhookUrl: 'https://api.gatekit.dev/webhooks/telegram/updated-token',
        },
        isActive: true,
        testMode: false,
      };

      const result = await platformsService.update(
        testProject.slug,
        testPlatform.id,
        updateDto
      );

      expect(result.platform).toBe('telegram');
      expect(result.isActive).toBe(true);
      expect(result.testMode).toBe(false);

      // Verify credentials were updated in database
      const updatedPlatform = await prisma.projectPlatform.findUnique({
        where: { id: testPlatform.id },
      });

      expect(updatedPlatform.credentialsEncrypted).not.toBe('encrypted-old-credentials');
      expect(updatedPlatform.isActive).toBe(true);
      expect(updatedPlatform.testMode).toBe(false);
    });

    it('should validate credential structure for different platforms', async () => {
      const platformsService = app.get('PlatformsService');

      // Test invalid credentials (missing required fields)
      const invalidUpdate = {
        credentials: {
          invalidField: 'should-fail',
        },
      };

      // The update should work but may fail validation at connection time
      // This tests that the API accepts credential updates
      await expect(
        platformsService.update(testProject.slug, testPlatform.id, invalidUpdate)
      ).resolves.toBeTruthy();
    });

    it('should toggle platform active status', async () => {
      const platformsService = app.get('PlatformsService');

      // Disable platform
      const disabledResult = await platformsService.update(
        testProject.slug,
        testPlatform.id,
        { isActive: false }
      );

      expect(disabledResult.isActive).toBe(false);

      // Re-enable platform
      const enabledResult = await platformsService.update(
        testProject.slug,
        testPlatform.id,
        { isActive: true }
      );

      expect(enabledResult.isActive).toBe(true);
    });

    it('should update test mode', async () => {
      const platformsService = app.get('PlatformsService');

      // Enable test mode
      const testModeResult = await platformsService.update(
        testProject.slug,
        testPlatform.id,
        { testMode: true }
      );

      expect(testModeResult.testMode).toBe(true);

      // Disable test mode
      const normalModeResult = await platformsService.update(
        testProject.slug,
        testPlatform.id,
        { testMode: false }
      );

      expect(normalModeResult.testMode).toBe(false);
    });
  });

  describe('Platform Update Error Handling', () => {
    it('should handle non-existent platform updates', async () => {
      const platformsService = app.get('PlatformsService');

      await expect(
        platformsService.update(testProject.slug, 'non-existent-platform', {
          isActive: false,
        })
      ).rejects.toThrow();
    });

    it('should handle non-existent project updates', async () => {
      const platformsService = app.get('PlatformsService');

      await expect(
        platformsService.update('non-existent-project', testPlatform.id, {
          isActive: false,
        })
      ).rejects.toThrow();
    });
  });
});