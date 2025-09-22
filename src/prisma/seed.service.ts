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

        const defaultProject = await this.prisma.project.create({
          data: {
            name: 'Default Project',
            slug: 'default',
            environment: 'development',
            isDefault: true,
            settings: {
              rateLimits: {
                test: 100,
                production: 1000,
              },
            },
          },
        });

        const testApiKey = CryptoUtil.generateApiKey(defaultProject.environment);
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
            scopes: {
              create: [
                { scope: 'messages:send' },
                { scope: 'messages:read' },
                { scope: 'projects:read' },
                { scope: 'projects:write' },
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