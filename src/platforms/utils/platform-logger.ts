import { Injectable, Inject, LoggerService } from '@nestjs/common';
import { PlatformLogsService } from '../services/platform-logs.service';

export interface PlatformLogContext {
  projectId: string;
  platformId?: string;
  platform: string;
}

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';
export type LogCategory =
  | 'connection'
  | 'webhook'
  | 'message'
  | 'error'
  | 'auth'
  | 'general';

/**
 * Enhanced logger that captures platform activity to database
 * while maintaining compatibility with NestJS Logger
 */
@Injectable()
export class PlatformLogger implements LoggerService {
  constructor(
    @Inject('PLATFORM_LOGS_SERVICE')
    private readonly platformLogsService: PlatformLogsService,
    private readonly context: PlatformLogContext,
  ) {}

  /**
   * Factory method to create a platform-aware logger
   */
  static create(
    platformLogsService: PlatformLogsService,
    context: PlatformLogContext,
  ): PlatformLogger {
    return new PlatformLogger(platformLogsService, context);
  }

  log(
    message: string,
    category: LogCategory = 'general',
    metadata?: Record<string, any>,
  ) {
    console.log(`[${this.context.platform.toUpperCase()}] ${message}`);
    this.captureLog('info', category, message, metadata);
  }

  error(
    message: string,
    error?: Error | string,
    category: LogCategory = 'error',
    metadata?: Record<string, any>,
  ) {
    console.error(`[${this.context.platform.toUpperCase()}] ERROR: ${message}`);
    this.captureLog('error', category, message, metadata, error);
  }

  warn(
    message: string,
    category: LogCategory = 'general',
    metadata?: Record<string, any>,
  ) {
    console.warn(`[${this.context.platform.toUpperCase()}] WARN: ${message}`);
    this.captureLog('warn', category, message, metadata);
  }

  debug(
    message: string,
    category: LogCategory = 'general',
    metadata?: Record<string, any>,
  ) {
    console.debug(`[${this.context.platform.toUpperCase()}] DEBUG: ${message}`);
    this.captureLog('debug', category, message, metadata);
  }

  verbose(
    message: string,
    category: LogCategory = 'general',
    metadata?: Record<string, any>,
  ) {
    console.log(`[${this.context.platform.toUpperCase()}] VERBOSE: ${message}`);
    this.captureLog('debug', category, message, metadata);
  }

  /**
   * Specialized methods for common platform activities
   */
  logConnection(message: string, metadata?: Record<string, any>) {
    this.log(message, 'connection', metadata);
  }

  logWebhook(message: string, metadata?: Record<string, any>) {
    this.log(message, 'webhook', metadata);
  }

  logMessage(message: string, metadata?: Record<string, any>) {
    this.log(message, 'message', metadata);
  }

  logAuth(message: string, metadata?: Record<string, any>) {
    this.log(message, 'auth', metadata);
  }

  errorConnection(
    message: string,
    error?: Error | string,
    metadata?: Record<string, any>,
  ) {
    this.error(message, error, 'connection', metadata);
  }

  errorWebhook(
    message: string,
    error?: Error | string,
    metadata?: Record<string, any>,
  ) {
    this.error(message, error, 'webhook', metadata);
  }

  errorMessage(
    message: string,
    error?: Error | string,
    metadata?: Record<string, any>,
  ) {
    this.error(message, error, 'message', metadata);
  }

  errorAuth(
    message: string,
    error?: Error | string,
    metadata?: Record<string, any>,
  ) {
    this.error(message, error, 'auth', metadata);
  }

  /**
   * Captures log to database asynchronously (non-blocking)
   */
  private captureLog(
    level: LogLevel,
    category: LogCategory,
    message: string,
    metadata?: Record<string, any>,
    error?: Error | string,
  ) {
    // Don't await - fire and forget to avoid blocking platform operations
    setImmediate(() => {
      this.platformLogsService
        .logActivity({
          projectId: this.context.projectId,
          platformId: this.context.platformId,
          platform: this.context.platform,
          level,
          category,
          message,
          metadata,
          error,
        })
        .catch((err) => {
          // Only log to console if database logging fails
          console.error('Failed to capture platform log:', err);
        });
    });
  }
}
