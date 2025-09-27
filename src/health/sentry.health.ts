import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { Injectable } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SentryHealthIndicator extends HealthIndicator {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const sentryEnabled = this.configService.get<boolean>('sentry.enabled');
      const sentryDsn = this.configService.get<string>('sentry.dsn');
      const environment = this.configService.get<string>('sentry.environment');

      const sentryInfo = {
        enabled: sentryEnabled,
        configured: !!sentryDsn,
        environment,
        client: !!Sentry.getCurrentScope(),
      };

      if (!sentryEnabled) {
        return this.getStatus(key, true, {
          ...sentryInfo,
          status: 'disabled',
        });
      }

      if (!sentryDsn) {
        return this.getStatus(key, true, {
          ...sentryInfo,
          status: 'not_configured',
        });
      }

      // Check if Sentry client is initialized
      const scope = Sentry.getCurrentScope();
      if (!scope) {
        throw new HealthCheckError('Sentry client not initialized', {
          ...sentryInfo,
          status: 'error',
        });
      }

      return this.getStatus(key, true, {
        ...sentryInfo,
        status: 'operational',
      });
    } catch (error) {
      throw new HealthCheckError('Sentry health check failed', error);
    }
  }
}
