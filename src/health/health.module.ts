import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { SentryHealthIndicator } from './sentry.health';

@Module({
  controllers: [HealthController],
  providers: [HealthService, SentryHealthIndicator],
  exports: [SentryHealthIndicator],
})
export class HealthModule {}
