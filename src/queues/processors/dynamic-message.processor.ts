import { Process, Processor } from '@nestjs/bull';
import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Job } from 'bull';
import { PlatformsService } from '../../platforms/platforms.service';
import { PlatformRegistry } from '../../platforms/services/platform-registry.service';
import { makeEnvelope } from '../../platforms/utils/envelope.factory';
import { PlatformAdapter } from '../../platforms/interfaces/platform-adapter.interface';

interface MessageJob {
  projectSlug: string;
  projectId: string;
  message: {
    targets: Array<{
      platformId: string;
      type: string;
      id: string;
    }>;
    content: {
      text?: string;
      attachments?: any[];
      buttons?: any[];
      embeds?: any[];
    };
    options?: {
      replyTo?: string;
      silent?: boolean;
      scheduled?: string;
    };
    metadata?: {
      trackingId?: string;
      tags?: string[];
      priority?: string;
    };
  };
}

@Processor('messages')
export class DynamicMessageProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DynamicMessageProcessor.name);

  constructor(
    private readonly platformsService: PlatformsService,
    private readonly platformRegistry: PlatformRegistry,
  ) {
    this.logger.log('🚀 DynamicMessageProcessor constructor called - processor created');
  }

  async onModuleInit() {
    this.logger.log('🔌 DynamicMessageProcessor onModuleInit - attempting to connect to Redis queue');
    this.logger.log('🔍 Queue processor should now be listening for "send-message" jobs on "messages" queue');
  }

  @Process('send-message')
  async handleSendMessage(job: Job<MessageJob>) {
    this.logger.log(`🎯 QUEUE PROCESSOR ACTIVATED! Processing job ${job.id}`);
    this.logger.log(`📨 Job data received - checking job structure...`);

    const { projectSlug, projectId, message } = job.data;

    this.logger.log(
      `📊 Processing message job ${job.id} - Project: ${projectSlug}, Targets: ${message.targets.length}, PlatformIds: ${message.targets.map(t => t.platformId).join(', ')}`,
    );

    const results: any[] = [];
    const errors: any[] = [];

    // Process each target separately
    for (const target of message.targets) {
      try {
        // Get platform configuration by ID - fail immediately if not found
        const platformConfig = await this.platformsService.getProjectPlatform(target.platformId);

        this.logger.log(
          `Sending to ${platformConfig.platform}:${target.type}:${target.id} (platformId: ${target.platformId})`,
        );

        // Get the platform provider
        const provider = this.platformRegistry.getProvider(platformConfig.platform);

        if (!provider) {
          throw new Error(`Platform provider '${platformConfig.platform}' not found`);
        }

        // Create composite key for this specific platform instance
        const connectionKey = `${projectId}:${target.platformId}`;

        // Get or create adapter for this project and platform instance
        let adapter = provider.getAdapter(connectionKey);

        if (!adapter) {
          // Create adapter through the provider with platform-specific credentials
          // Include webhookToken for platforms that need webhook registration
          const credentials = {
            ...platformConfig.decryptedCredentials,
            webhookToken: platformConfig.webhookToken,
          };
          adapter = await provider.createAdapter(connectionKey, credentials);
        }

        // Create message envelope
        const envelope = makeEnvelope({
          channel: platformConfig.platform as any,
          projectId,
          threadId: target.id,
          user: {
            providerUserId: 'system',
            display: 'System',
          },
          message: {
            text: message.content.text,
          },
          provider: {
            eventId: `job-${job.id}-${platformConfig.platform}-${target.id}`,
            raw: {
              platformId: target.platformId,
              ...message.metadata,
            },
          },
        });

        // Send the message through the adapter
        const result = await adapter.sendMessage(envelope, {
          text: message.content.text,
          attachments: message.content.attachments,
          buttons: message.content.buttons,
          embeds: message.content.embeds,
          threadId: target.id,
          replyTo: message.options?.replyTo,
          silent: message.options?.silent,
        });

        this.logger.log(
          `Message sent successfully to ${platformConfig.platform}:${target.type}:${target.id} (platformId: ${target.platformId}) - Provider Message ID: ${result.providerMessageId}`,
        );

        results.push({
          success: true,
          target: {
            ...target,
            platform: platformConfig.platform,
          },
          providerMessageId: result.providerMessageId,
          timestamp: new Date().toISOString(),
        });

      } catch (error) {
        // Check if this is a permanent failure that shouldn't be retried
        const isPermanentFailure =
          error.message.includes('Platform configuration') ||
          error.message.includes('not found') ||
          error.message.includes('timed out') ||
          error.message.includes('disabled') ||
          error.message.includes('invalid');

        if (isPermanentFailure) {
          this.logger.error(
            `[PERMANENT FAILURE] Platform ${target.platformId} - ${error.message} - MARKING JOB AS FAILED`,
          );

          // Throw to mark the entire job as permanently failed
          throw new Error(`PERMANENT_FAILURE: Platform ${target.platformId} - ${error.message}`);
        }

        this.logger.error(
          `Failed to send message to platformId ${target.platformId}:${target.type}:${target.id}: ${error.message} - will retry`,
        );

        errors.push({
          target,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Return results for all targets
    const totalTargets = message.targets.length;
    const successCount = results.length;
    const failureCount = errors.length;

    this.logger.log(
      `Job ${job.id} completed: ${successCount}/${totalTargets} successful, ${failureCount} failed`,
    );

    return {
      success: failureCount === 0,
      totalTargets,
      successCount,
      failureCount,
      results,
      errors,
      timestamp: new Date().toISOString(),
    };
  }

  async onModuleDestroy() {
    this.logger.log('🔌 DynamicMessageProcessor onModuleDestroy - shutting down processor');
    this.logger.log('🛑 Message processor shutting down, cleaning up platform providers...');

    // Let the platform registry handle cleanup
    await this.platformRegistry.getAllProviders().forEach(async (provider) => {
      try {
        await provider.shutdown();
      } catch (error) {
        this.logger.warn(`Failed to shutdown provider ${provider.name}: ${error.message}`);
      }
    });

    this.logger.log('Message processor cleanup complete');
  }
}