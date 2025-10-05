import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as packageJson from '../../package.json';

@Injectable()
export class HealthService {
  constructor(private prisma: PrismaService) {}

  async check() {
    // Check if any user with password exists (setup complete check)
    const userCount = await this.prisma.user.count({
      where: {
        passwordHash: {
          not: null,
        },
      },
    });

    const setupRequired = userCount === 0;

    return {
      status: 'healthy',
      version: packageJson.version,
      setupRequired,
      timestamp: new Date().toISOString(),
    };
  }
}
