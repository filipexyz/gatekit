import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../../prisma/prisma.service';
import { UrlValidationUtil } from '../../common/utils/url-validation.util';
import {
  WebhookEventType,
  WebhookPayload,
  MessageReceivedData,
  MessageSentData,
  MessageFailedData,
  ButtonClickedData,
  ReactionAddedData,
  ReactionRemovedData,
} from '../types/webhook-event.types';
import type { Webhook, Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import pLimit from 'p-limit';

interface DeliveryResult {
  response: {
    status: number;
    data: unknown;
  };
  actualAttempts: number;
}

export interface DeliveryStats {
  total: number;
  successful: number;
  failed: number;
  pending: number;
  successRate: string;
}

@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);
  private readonly concurrencyLimit = pLimit(10); // Max 10 concurrent deliveries
  private readonly maxRetries: number = 3;
  private readonly timeout: number = 10000; // 10 seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Deliver an event to all webhooks subscribed to it
   */
  async deliverEvent(
    projectId: string,
    event: WebhookEventType,
    data:
      | MessageReceivedData
      | MessageSentData
      | MessageFailedData
      | ButtonClickedData
      | ReactionAddedData
      | ReactionRemovedData,
  ): Promise<void> {
    try {
      // Get active webhooks subscribed to this event
      const webhooks = await this.prisma.webhook.findMany({
        where: {
          projectId,
          isActive: true,
          events: { has: event },
        },
      });

      if (webhooks.length === 0) {
        this.logger.debug(
          `No webhooks subscribed to ${event} for project ${projectId}`,
        );
        return;
      }

      this.logger.log(
        `Delivering ${event} to ${webhooks.length} webhook(s) for project ${projectId}`,
      );

      const payload: WebhookPayload = {
        event,
        timestamp: new Date().toISOString(),
        project_id: projectId,
        data,
      };

      // Deliver to all webhooks with concurrency limit (fire and forget with retry)
      const deliveryPromises = webhooks.map((webhook) =>
        this.concurrencyLimit(() =>
          this.deliverToWebhook(webhook, payload).catch((err) => {
            this.logger.error(
              `Webhook delivery failed for ${webhook.id}: ${err.message}`,
            );
          }),
        ),
      );

      // Don't await - fire and forget
      void Promise.all(deliveryPromises);
    } catch (error) {
      this.logger.error(`Error delivering event ${event}: ${error.message}`);
    }
  }

  /**
   * Deliver payload to a specific webhook
   */
  private async deliverToWebhook(
    webhook: Webhook,
    payload: WebhookPayload,
  ): Promise<void> {
    // Create delivery record
    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event: payload.event,
        payload: payload as unknown as Prisma.InputJsonValue,
        status: 'pending',
        attempts: 0,
      },
    });

    try {
      // Generate HMAC signature
      const signature = this.generateSignature(
        webhook.secret,
        payload.timestamp,
        JSON.stringify(payload),
      );

      // SECURITY: Defensive URL validation before HTTP request
      await UrlValidationUtil.validateUrl(webhook.url, 'webhook delivery');

      // Send webhook with retry logic
      const result = await this.sendWithRetry(
        webhook.url,
        payload,
        signature,
        payload.timestamp,
        this.maxRetries,
      );

      // Update delivery status with actual attempt count
      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'success',
          responseCode: result.response.status,
          responseBody: this.safeStringify(result.response.data, 5000),
          deliveredAt: new Date(),
          attempts: result.actualAttempts,
        },
      });

      this.logger.log(
        `✅ Webhook ${webhook.id} delivered successfully (${result.response.status}) after ${result.actualAttempts} attempt(s)`,
      );
    } catch (error) {
      // Determine actual attempts from error or default to maxRetries
      const actualAttempts =
        error.message.includes('after') &&
        error.message.match(/after (\d+) attempt/)
          ? parseInt(error.message.match(/after (\d+) attempt/)[1])
          : this.maxRetries;

      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'failed',
          error: this.truncateString(error.message, 5000),
          attempts: actualAttempts,
        },
      });

      this.logger.warn(
        `❌ Webhook ${webhook.id} delivery failed after ${actualAttempts} attempt(s): ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Generate HMAC signature for webhook validation
   */
  private generateSignature(
    secret: string,
    timestamp: string,
    body: string,
  ): string {
    const signedPayload = `${timestamp}.${body}`;
    return crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');
  }

  /**
   * Send HTTP request with exponential backoff retry
   */
  private async sendWithRetry(
    url: string,
    payload: WebhookPayload,
    signature: string,
    timestamp: string,
    maxRetries: number,
  ): Promise<DeliveryResult> {
    let lastError: Error | undefined;
    let actualAttempts = 0;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      actualAttempts = attempt;

      try {
        this.logger.debug(
          `Sending webhook to ${url} (attempt ${attempt}/${maxRetries})`,
        );

        const response = await this.httpService.axiosRef.post(url, payload, {
          headers: {
            'Content-Type': 'application/json',
            'X-GateKit-Signature': `sha256=${signature}`,
            'X-GateKit-Timestamp': timestamp,
            'X-GateKit-Event': payload.event,
            'User-Agent': 'GateKit-Webhooks/1.0',
          },
          timeout: this.timeout,
          validateStatus: (status) => status >= 200 && status < 300,
        });

        return { response, actualAttempts };
      } catch (error) {
        lastError = error;

        this.logger.debug(
          `Webhook attempt ${attempt}/${maxRetries} failed: ${error.message}`,
        );

        // Don't retry on 4xx errors (client errors)
        if (error.response?.status >= 400 && error.response?.status < 500) {
          throw new Error(
            `Webhook rejected with status ${error.response.status} after ${attempt} attempt(s)`,
          );
        }

        // Wait before retry (exponential backoff: 1s, 2s, 4s)
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt - 1) * 1000;
          await this.sleep(waitTime);
        }
      }
    }

    // Throw error with context about retry attempts
    throw new Error(
      `Webhook delivery failed after ${actualAttempts} attempt(s): ${lastError?.message || 'Unknown error'}`,
    );
  }

  /**
   * Helper to sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Truncate string to max length
   */
  private truncateString(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '... (truncated)';
  }

  /**
   * Safely stringify response data with size limits to prevent OOM
   */
  private safeStringify(data: unknown, maxLength: number): string {
    try {
      const str = JSON.stringify(data);

      // If response is excessively large, don't store it
      if (str.length > maxLength * 10) {
        return `[Response too large: ${str.length} bytes]`;
      }

      return this.truncateString(str, maxLength);
    } catch (error) {
      return `[Failed to serialize response: ${error.message}]`;
    }
  }

  /**
   * Get delivery statistics for a webhook (optimized with groupBy)
   */
  async getDeliveryStats(webhookId: string): Promise<DeliveryStats> {
    const stats = await this.prisma.webhookDelivery.groupBy({
      by: ['status'],
      where: { webhookId },
      _count: {
        status: true,
      },
    });

    const total = stats.reduce((sum, stat) => sum + stat._count.status, 0);
    const successful =
      stats.find((s) => s.status === 'success')?._count.status || 0;
    const failed = stats.find((s) => s.status === 'failed')?._count.status || 0;
    const pending =
      stats.find((s) => s.status === 'pending')?._count.status || 0;

    const successRate =
      total > 0 ? ((successful / total) * 100).toFixed(2) : '0.00';

    return {
      total,
      successful,
      failed,
      pending,
      successRate: `${successRate}%`,
    };
  }

  /**
   * Cleanup old webhook deliveries (older than specified days)
   *
   * IMPORTANT: This method must be called periodically to prevent database bloat.
   *
   * Recommended setup:
   * 1. Add @nestjs/schedule package
   * 2. Create a scheduled task in webhooks.module.ts:
   *
   *    @Cron('0 2 * * *') // Run daily at 2 AM
   *    async scheduledCleanup() {
   *      const deleted = await this.webhookDeliveryService.cleanupOldDeliveries(30);
   *      this.logger.log(`Cleaned up ${deleted} webhook deliveries`);
   *    }
   *
   * Alternative: Run manually via admin endpoint or CLI script
   */
  async cleanupOldDeliveries(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.webhookDelivery.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    this.logger.log(
      `Cleaned up ${result.count} webhook deliveries older than ${olderThanDays} days`,
    );

    return result.count;
  }
}
