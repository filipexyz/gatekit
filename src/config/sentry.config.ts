import { registerAs } from '@nestjs/config';

export const sentryConfig = registerAs('sentry', () => ({
  dsn: process.env.SENTRY_DSN || '',
  environment: process.env.NODE_ENV || 'development',
  enabled:
    process.env.SENTRY_ENABLED === 'true' ||
    process.env.NODE_ENV === 'production',
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
  profilesSampleRate: parseFloat(
    process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1',
  ),
  debug: process.env.SENTRY_DEBUG === 'true',
  attachStacktrace: true,
  autoSessionTracking: true,
  integrations: [],
}));
