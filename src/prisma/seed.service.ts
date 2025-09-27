import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CryptoUtil } from '../common/utils/crypto.util';

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    if (process.env.NODE_ENV === 'development') {
      await this.seedDatabase();
    }
  }

  private async seedDatabase() {
    try {
      const existingProject = await this.prisma.project.findUnique({
        where: { slug: 'default' },
      });

      if (!existingProject) {
        console.log('Seeding database with default project...');

        // Create or find a default system user
        let systemUser = await this.prisma.user.findUnique({
          where: { auth0Id: 'system|default' },
        });

        if (!systemUser) {
          systemUser = await this.prisma.user.create({
            data: {
              auth0Id: 'system|default',
              email: 'system@gatekit.dev',
              name: 'System User',
              isAdmin: true,
            },
          });
        }

        const defaultProject = await this.prisma.project.create({
          data: {
            name: 'Default Project',
            description:
              'Default development project for testing and initial setup',
            slug: 'default',
            environment: 'development',
            isDefault: true,
            ownerId: systemUser.id,
            settings: {
              rateLimits: {
                test: 100,
                production: 1000,
              },
            },
          },
        });

        const testApiKey = CryptoUtil.generateApiKey(
          defaultProject.environment,
        );
        const keyHash = CryptoUtil.hashApiKey(testApiKey);
        const keyPrefix = CryptoUtil.getKeyPrefix(testApiKey);
        const keySuffix = CryptoUtil.getKeySuffix(testApiKey);

        await this.prisma.apiKey.create({
          data: {
            projectId: defaultProject.id,
            keyHash,
            keyPrefix,
            keySuffix,
            name: 'Development Test Key',
            createdBy: systemUser.id,
            scopes: {
              create: [
                { scope: 'messages:send' },
                { scope: 'messages:read' },
                { scope: 'messages:write' },
                { scope: 'projects:read' },
                { scope: 'projects:write' },
                { scope: 'members:read' },
                { scope: 'members:write' },
                { scope: 'keys:manage' },
                { scope: 'keys:read' },
                { scope: 'platforms:read' },
                { scope: 'platforms:write' },
              ],
            },
          },
        });

        console.log('='.repeat(60));
        console.log('Default project created successfully!');
        console.log('Project Slug: default');
        console.log('Test API Key:', testApiKey);
        console.log('='.repeat(60));
        console.log('Use this key in the X-API-Key header for authentication');
        console.log('='.repeat(60));
      }
    } catch (error) {
      console.error('Error seeding database:', error);
    }
  }
}
