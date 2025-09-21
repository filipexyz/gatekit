import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { ProjectsModule } from './projects/projects.module';
import { PrismaModule } from './prisma/prisma.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { ApiKeyGuard } from './common/guards/api-key.guard';
import { appConfig, configValidationSchema } from './config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validationSchema: configValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('app.rateLimit.ttl', 60) * 1000, // Convert to milliseconds
            limit: config.get<number>('app.rateLimit.limit', 100),
          },
        ],
      }),
    }),
    HealthModule,
    ProjectsModule,
    PrismaModule,
    ApiKeysModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global API Key Guard - applies to all routes unless marked as @Public()
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
    // Global Rate Limiting Guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}