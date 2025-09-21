import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { ProjectsModule } from './projects/projects.module';
import { PrismaModule } from './prisma/prisma.module';
import { ApiKeysModule } from './api-keys/api-keys.module';

@Module({
  imports: [HealthModule, ProjectsModule, PrismaModule, ApiKeysModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
