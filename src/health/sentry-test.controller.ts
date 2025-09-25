import { Controller, Get, Query, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import * as Sentry from '@sentry/nestjs';

@Controller('api/v1/sentry-test')
export class SentryTestController {
  @Public()
  @Get('error')
  testError(@Query('type') type?: string) {
    // Only enabled in non-production environments
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('Test endpoint disabled in production');
    }

    switch (type) {
      case 'validation':
        throw new BadRequestException('This is a test validation error');

      case 'internal':
        throw new InternalServerErrorException('This is a test internal server error');

      case 'custom':
        const error = new Error('This is a custom test error for Sentry');
        error.name = 'CustomTestError';
        Sentry.captureException(error, {
          tags: {
            test: true,
            errorType: 'custom',
          },
          extra: {
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV,
          },
        });
        throw error;

      case 'unhandled':
        // Simulate unhandled rejection
        setTimeout(() => {
          throw new Error('Unhandled async error for Sentry test');
        }, 100);
        return { message: 'Unhandled error triggered (check Sentry in a moment)' };

      default:
        throw new Error('This is a generic test error for Sentry');
    }
  }

  @Public()
  @Get('message')
  testMessage(@Query('level') level: string = 'info', @Query('message') message?: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('Test endpoint disabled in production');
    }

    const testMessage = message || `Test ${level} message from GateKit backend`;

    switch (level) {
      case 'debug':
        Sentry.captureMessage(testMessage, 'debug');
        break;
      case 'info':
        Sentry.captureMessage(testMessage, 'info');
        break;
      case 'warning':
        Sentry.captureMessage(testMessage, 'warning');
        break;
      case 'error':
        Sentry.captureMessage(testMessage, 'error');
        break;
      case 'fatal':
        Sentry.captureMessage(testMessage, 'fatal');
        break;
      default:
        Sentry.captureMessage(testMessage, 'info');
    }

    return {
      message: 'Message sent to Sentry',
      level,
      content: testMessage,
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('transaction')
  async testTransaction() {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('Test endpoint disabled in production');
    }

    // For NestJS, transactions are handled automatically by the Sentry integration
    // We'll just simulate some async work
    try {
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 100));
      await new Promise(resolve => setTimeout(resolve, 150));
      await new Promise(resolve => setTimeout(resolve, 50));

      return {
        message: 'Transaction completed and sent to Sentry',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw error;
    }
  }
}