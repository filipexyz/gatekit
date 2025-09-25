import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { SentryTestController } from './sentry-test.controller';
import { SentryHealthIndicator } from './sentry.health';

@Module({
  controllers: [HealthController, SentryTestController],
  providers: [HealthService, SentryHealthIndicator],
  exports: [SentryHealthIndicator]
})
export class HealthModule {}
