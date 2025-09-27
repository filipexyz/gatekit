import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

const sentryDsn = process.env.SENTRY_DSN;
const environment = process.env.NODE_ENV || 'development';
const sentryEnabled =
  process.env.SENTRY_ENABLED === 'true' || environment === 'production';

if (sentryEnabled && sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment,
    integrations: [
      // Add profiling integration
      nodeProfilingIntegration(),
    ],
    // Performance Monitoring
    tracesSampleRate: parseFloat(
      process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1',
    ),
    // Set sampling rate for profiling - this is relative to tracesSampleRate
    profilesSampleRate: parseFloat(
      process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1',
    ),
    // Debug mode
    debug: process.env.SENTRY_DEBUG === 'true',
    // Attach stack trace to messages
    attachStacktrace: true,
    // Release tracking
    release: process.env.SENTRY_RELEASE || undefined,
    // Server name
    serverName: process.env.HOSTNAME || 'gatekit-backend',
    // Send default PII (like IP addresses)
    sendDefaultPii: true,
    // Before send hook for filtering
    beforeSend(event, hint) {
      // Filter out specific errors if needed
      if (event.exception) {
        const error = hint.originalException;
        // Don't send validation errors to Sentry
        if (
          error &&
          error.constructor &&
          error.constructor.name === 'ValidationError'
        ) {
          return null;
        }
      }
      return event;
    },
    // Ignore specific errors
    ignoreErrors: [
      // Browser-related errors
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      // Network errors
      'NetworkError',
      'Network request failed',
      // Common client errors
      'Non-Error promise rejection captured',
    ],
  });

  console.log(`Sentry initialized for ${environment} environment`);
} else {
  console.log('Sentry is disabled or DSN not provided');
}
