import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { SentryModule } from '@sentry/nestjs/setup';
import { SentryGlobalFilter } from '@sentry/nestjs/setup';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { ProjectsModule } from './projects/projects.module';
import { PrismaModule } from './prisma/prisma.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { AuthModule } from './auth/auth.module';
import { AppAuthGuard } from './common/guards/app-auth.guard';
import { appConfig, configValidationSchema } from './config/app.config';
import { PlatformsModule } from './platforms/platforms.module';
import { QueuesModule } from './queues/queues.module';
import { DocsModule } from './docs/docs.module';
import { MessagesModule } from './messages/messages.module';
import { MembersModule } from './members/members.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { IdentitiesModule } from './identities/identities.module';
import { McpModule } from './mcp/mcp.module';
import { sentryConfig } from './config/sentry.config';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, sentryConfig],
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
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisConfig = {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD'),
          db: config.get<number>('REDIS_DB', 0),
          // Add TLS for Upstash Redis
          tls: config.get<string>('REDIS_HOST', '').includes('upstash.io')
            ? {}
            : undefined,
          maxRetriesPerRequest: null, // Required by BullMQ
          retryDelayOnFailover: 100,
          lazyConnect: true,
        };

        console.log('🔗 Redis Bull Queue Configuration:', {
          host: redisConfig.host,
          port: redisConfig.port,
          password: redisConfig.password ? '***HIDDEN***' : 'NOT_SET',
          db: redisConfig.db,
          tls: redisConfig.tls ? 'ENABLED' : 'DISABLED',
          maxRetriesPerRequest: redisConfig.maxRetriesPerRequest,
        });

        return {
          connection: redisConfig,
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
            removeOnComplete: 100, // Keep last 100 completed jobs
            removeOnFail: false, // Keep failed jobs for debugging
          },
        };
      },
    }),
    HealthModule,
    AuthModule,
    ProjectsModule,
    PrismaModule,
    ApiKeysModule,
    PlatformsModule,
    QueuesModule,
    DocsModule,
    MessagesModule,
    MembersModule,
    WebhooksModule,
    IdentitiesModule,
    McpModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global Authentication Guard - supports both JWT (Auth0) and API Keys
    {
      provide: APP_GUARD,
      useClass: AppAuthGuard,
    },
    // Global Rate Limiting Guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Global Sentry Error Filter
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
  ],
})
export class AppModule {}
