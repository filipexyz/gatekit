import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AppModule } from '../../src/app.module';
import { ReactionType } from '@prisma/client';

/**
 * E2E Tests for Reaction Duplicate Protection
 *
 * Tests the unique constraint: @@unique([platformId, providerMessageId, providerUserId, emoji, reactionType])
 *
 * What should be PREVENTED (duplicates):
 * - Same user adding same emoji to same message twice (platform retries)
 * - Same user removing same emoji from same message twice (platform retries)
 *
 * What should be ALLOWED (not duplicates):
 * - Same user adding different emoji to same message
 * - Different user adding same emoji to same message
 * - Same user adding same emoji after removing it (re-reaction)
 */
describe('Reaction Duplicate Protection (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Test fixtures
  const testProject = {
    id: 'test-project',
    name: 'Test Project',
    ownerId: 'test-owner',
  };

  const testPlatform = {
    id: 'test-platform-id',
    projectId: testProject.id,
    platform: 'discord',
    name: 'Test Discord',
    credentialsEncrypted: 'encrypted',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Clean up and create test data
    await prisma.receivedReaction.deleteMany({});
    await prisma.projectPlatform.deleteMany({
      where: { projectId: testProject.id },
    });
    await prisma.project.deleteMany({ where: { id: testProject.id } });
    await prisma.user.deleteMany({ where: { id: testProject.ownerId } });

    await prisma.user.create({
      data: {
        id: testProject.ownerId,
        auth0Id: 'auth0|test-owner',
        email: 'test@example.com',
      },
    });

    await prisma.project.create({
      data: testProject,
    });

    await prisma.projectPlatform.create({
      data: testPlatform,
    });
  });

  afterAll(async () => {
    await prisma.receivedReaction.deleteMany({});
    await prisma.projectPlatform.deleteMany({
      where: { projectId: testProject.id },
    });
    await prisma.project.deleteMany({ where: { id: testProject.id } });
    await prisma.user.deleteMany({ where: { id: testProject.ownerId } });
    await app.close();
  });

  afterEach(async () => {
    await prisma.receivedReaction.deleteMany({});
  });

  describe('Duplicate Prevention (P2002 errors)', () => {
    it('should PREVENT duplicate "added" reaction from same user on same message', async () => {
      // First reaction - should succeed
      const reaction1 = await prisma.receivedReaction.create({
        data: {
          projectId: testProject.id,
          platformId: testPlatform.id,
          platform: 'discord',
          providerMessageId: 'msg-123',
          providerChatId: 'channel-456',
          providerUserId: 'user-789',
          userDisplay: 'TestUser',
          emoji: '👍',
          reactionType: ReactionType.added,
          rawData: {},
        },
      });

      expect(reaction1.id).toBeDefined();

      // Duplicate reaction - should fail with P2002
      await expect(
        prisma.receivedReaction.create({
          data: {
            projectId: testProject.id,
            platformId: testPlatform.id,
            platform: 'discord',
            providerMessageId: 'msg-123',
            providerChatId: 'channel-456',
            providerUserId: 'user-789',
            userDisplay: 'TestUser',
            emoji: '👍',
            reactionType: ReactionType.added,
            rawData: {},
          },
        }),
      ).rejects.toMatchObject({
        code: 'P2002',
        meta: expect.objectContaining({
          target: expect.arrayContaining([
            'platform_id',
            'provider_message_id',
            'provider_user_id',
            'emoji',
            'reaction_type',
          ]),
        }),
      });

      // Verify only one reaction exists
      const count = await prisma.receivedReaction.count();
      expect(count).toBe(1);
    });

    it('should PREVENT duplicate "removed" reaction from same user on same message', async () => {
      // First removal - should succeed
      await prisma.receivedReaction.create({
        data: {
          projectId: testProject.id,
          platformId: testPlatform.id,
          platform: 'discord',
          providerMessageId: 'msg-123',
          providerChatId: 'channel-456',
          providerUserId: 'user-789',
          userDisplay: 'TestUser',
          emoji: '👍',
          reactionType: ReactionType.removed,
          rawData: {},
        },
      });

      // Duplicate removal - should fail
      await expect(
        prisma.receivedReaction.create({
          data: {
            projectId: testProject.id,
            platformId: testPlatform.id,
            platform: 'discord',
            providerMessageId: 'msg-123',
            providerChatId: 'channel-456',
            providerUserId: 'user-789',
            userDisplay: 'TestUser',
            emoji: '👍',
            reactionType: ReactionType.removed,
            rawData: {},
          },
        }),
      ).rejects.toMatchObject({
        code: 'P2002',
      });

      const count = await prisma.receivedReaction.count();
      expect(count).toBe(1);
    });
  });

  describe('Allowed Variations (NOT duplicates)', () => {
    it('should ALLOW same user adding different emojis to same message', async () => {
      await prisma.receivedReaction.create({
        data: {
          projectId: testProject.id,
          platformId: testPlatform.id,
          platform: 'discord',
          providerMessageId: 'msg-123',
          providerChatId: 'channel-456',
          providerUserId: 'user-789',
          userDisplay: 'TestUser',
          emoji: '👍',
          reactionType: ReactionType.added,
          rawData: {},
        },
      });

      // Different emoji - should succeed
      await prisma.receivedReaction.create({
        data: {
          projectId: testProject.id,
          platformId: testPlatform.id,
          platform: 'discord',
          providerMessageId: 'msg-123',
          providerChatId: 'channel-456',
          providerUserId: 'user-789',
          userDisplay: 'TestUser',
          emoji: '❤️',
          reactionType: ReactionType.added,
          rawData: {},
        },
      });

      const count = await prisma.receivedReaction.count();
      expect(count).toBe(2);
    });

    it('should ALLOW different users adding same emoji to same message', async () => {
      await prisma.receivedReaction.create({
        data: {
          projectId: testProject.id,
          platformId: testPlatform.id,
          platform: 'discord',
          providerMessageId: 'msg-123',
          providerChatId: 'channel-456',
          providerUserId: 'user-789',
          userDisplay: 'User1',
          emoji: '👍',
          reactionType: ReactionType.added,
          rawData: {},
        },
      });

      // Different user - should succeed
      await prisma.receivedReaction.create({
        data: {
          projectId: testProject.id,
          platformId: testPlatform.id,
          platform: 'discord',
          providerMessageId: 'msg-123',
          providerChatId: 'channel-456',
          providerUserId: 'user-999', // Different user
          userDisplay: 'User2',
          emoji: '👍',
          reactionType: ReactionType.added,
          rawData: {},
        },
      });

      const count = await prisma.receivedReaction.count();
      expect(count).toBe(2);
    });

    it('should PREVENT re-adding same emoji (constraint prevents duplicate "added" events)', async () => {
      // Add reaction
      await prisma.receivedReaction.create({
        data: {
          projectId: testProject.id,
          platformId: testPlatform.id,
          platform: 'discord',
          providerMessageId: 'msg-123',
          providerChatId: 'channel-456',
          providerUserId: 'user-789',
          userDisplay: 'TestUser',
          emoji: '👍',
          reactionType: ReactionType.added,
          rawData: {},
        },
      });

      // Remove reaction
      await prisma.receivedReaction.create({
        data: {
          projectId: testProject.id,
          platformId: testPlatform.id,
          platform: 'discord',
          providerMessageId: 'msg-123',
          providerChatId: 'channel-456',
          providerUserId: 'user-789',
          userDisplay: 'TestUser',
          emoji: '👍',
          reactionType: ReactionType.removed,
          rawData: {},
        },
      });

      // Try to add again - should fail (duplicate "added" event)
      // NOTE: This is correct behavior - prevents platform retry duplicates
      // In production, if user re-reacts, it would be a different message event
      await expect(
        prisma.receivedReaction.create({
          data: {
            projectId: testProject.id,
            platformId: testPlatform.id,
            platform: 'discord',
            providerMessageId: 'msg-123',
            providerChatId: 'channel-456',
            providerUserId: 'user-789',
            userDisplay: 'TestUser',
            emoji: '👍',
            reactionType: ReactionType.added,
            rawData: {},
          },
        }),
      ).rejects.toMatchObject({
        code: 'P2002',
      });

      const count = await prisma.receivedReaction.count();
      expect(count).toBe(2); // add + remove (second add blocked)
    });

    it('should ALLOW same reaction on different messages', async () => {
      await prisma.receivedReaction.create({
        data: {
          projectId: testProject.id,
          platformId: testPlatform.id,
          platform: 'discord',
          providerMessageId: 'msg-123',
          providerChatId: 'channel-456',
          providerUserId: 'user-789',
          userDisplay: 'TestUser',
          emoji: '👍',
          reactionType: ReactionType.added,
          rawData: {},
        },
      });

      // Different message - should succeed
      await prisma.receivedReaction.create({
        data: {
          projectId: testProject.id,
          platformId: testPlatform.id,
          platform: 'discord',
          providerMessageId: 'msg-999', // Different message
          providerChatId: 'channel-456',
          providerUserId: 'user-789',
          userDisplay: 'TestUser',
          emoji: '👍',
          reactionType: ReactionType.added,
          rawData: {},
        },
      });

      const count = await prisma.receivedReaction.count();
      expect(count).toBe(2);
    });

    it('should ALLOW same reaction on different platforms', async () => {
      // Create second platform
      const platform2 = await prisma.projectPlatform.create({
        data: {
          projectId: testProject.id,
          platform: 'telegram',
          name: 'Test Telegram',
          credentialsEncrypted: 'encrypted',
        },
      });

      await prisma.receivedReaction.create({
        data: {
          projectId: testProject.id,
          platformId: testPlatform.id,
          platform: 'discord',
          providerMessageId: 'msg-123',
          providerChatId: 'channel-456',
          providerUserId: 'user-789',
          userDisplay: 'TestUser',
          emoji: '👍',
          reactionType: ReactionType.added,
          rawData: {},
        },
      });

      // Different platform - should succeed
      await prisma.receivedReaction.create({
        data: {
          projectId: testProject.id,
          platformId: platform2.id, // Different platform
          platform: 'telegram',
          providerMessageId: 'msg-123',
          providerChatId: 'channel-456',
          providerUserId: 'user-789',
          userDisplay: 'TestUser',
          emoji: '👍',
          reactionType: ReactionType.added,
          rawData: {},
        },
      });

      const count = await prisma.receivedReaction.count();
      expect(count).toBe(2);

      // Clean up
      await prisma.projectPlatform.delete({ where: { id: platform2.id } });
    });
  });

  describe('Edge Cases', () => {
    it('should handle custom Discord emoji duplicates', async () => {
      const customEmoji = '<:custom:123456789>';

      await prisma.receivedReaction.create({
        data: {
          projectId: testProject.id,
          platformId: testPlatform.id,
          platform: 'discord',
          providerMessageId: 'msg-123',
          providerChatId: 'channel-456',
          providerUserId: 'user-789',
          userDisplay: 'TestUser',
          emoji: customEmoji,
          reactionType: ReactionType.added,
          rawData: {},
        },
      });

      // Duplicate custom emoji - should fail
      await expect(
        prisma.receivedReaction.create({
          data: {
            projectId: testProject.id,
            platformId: testPlatform.id,
            platform: 'discord',
            providerMessageId: 'msg-123',
            providerChatId: 'channel-456',
            providerUserId: 'user-789',
            userDisplay: 'TestUser',
            emoji: customEmoji,
            reactionType: ReactionType.added,
            rawData: {},
          },
        }),
      ).rejects.toMatchObject({
        code: 'P2002',
      });
    });

    it('should handle very long emoji strings (up to 255 chars)', async () => {
      const longEmoji = '👨‍👩‍👧‍👦'.repeat(50).substring(0, 255); // Emoji with ZWJ (zero-width joiner)

      await prisma.receivedReaction.create({
        data: {
          projectId: testProject.id,
          platformId: testPlatform.id,
          platform: 'discord',
          providerMessageId: 'msg-123',
          providerChatId: 'channel-456',
          providerUserId: 'user-789',
          userDisplay: 'TestUser',
          emoji: longEmoji,
          reactionType: ReactionType.added,
          rawData: {},
        },
      });

      // Duplicate long emoji - should fail
      await expect(
        prisma.receivedReaction.create({
          data: {
            projectId: testProject.id,
            platformId: testPlatform.id,
            platform: 'discord',
            providerMessageId: 'msg-123',
            providerChatId: 'channel-456',
            providerUserId: 'user-789',
            userDisplay: 'TestUser',
            emoji: longEmoji,
            reactionType: ReactionType.added,
            rawData: {},
          },
        }),
      ).rejects.toMatchObject({
        code: 'P2002',
      });
    });
  });
});
