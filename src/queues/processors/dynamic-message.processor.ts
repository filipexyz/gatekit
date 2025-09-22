import { Process, Processor } from '@nestjs/bull';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import type { Job } from 'bull';
import { PlatformsService } from '../../platforms/platforms.service';
import { PlatformRegistry } from '../../platforms/services/platform-registry.service';
import { makeEnvelope } from '../../platforms/utils/envelope.factory';
import { PlatformAdapter } from '../../platforms/interfaces/platform-adapter.interface';

interface MessageJob {
  projectSlug: string;
  projectId: string;
  message: {
    platform: string;
    target: {
      type: string;
      id: string;
    };
    text?: string;
    attachments?: any[];
    metadata?: any;
  };
}

@Processor('messages')
export class DynamicMessageProcessor implements OnModuleDestroy {
  private readonly logger = new Logger(DynamicMessageProcessor.name);

  constructor(
    private readonly platformsService: PlatformsService,
    private readonly platformRegistry: PlatformRegistry,
  ) {}

  @Process('send-message')
  async handleSendMessage(job: Job<MessageJob>) {
    const { projectSlug, projectId, message } = job.data;

    this.logger.log(
      `Processing message job ${job.id} - Platform: ${message.platform}, Target: ${message.target.type}:${message.target.id}`,
    );

    try {
      // Get the platform provider
      const provider = this.platformRegistry.getProvider(message.platform);

      if (!provider) {
        throw new Error(`Platform provider '${message.platform}' not found`);
      }

      // Get or create adapter for this project
      let adapter = provider.getAdapter(projectId);

      if (!adapter) {
        // Get platform credentials
        const credentials = await this.platformsService.getDecryptedCredentials(
          projectId,
          message.platform,
        );

        // Create adapter through the provider
        adapter = await provider.createAdapter(projectId, credentials);
      }

      // Create message envelope
      const envelope = makeEnvelope({
        channel: message.platform as any,
        projectId,
        threadId: message.target.id,
        user: {
          providerUserId: 'system',
          display: 'System',
        },
        message: {
          text: message.text,
        },
        provider: {
          eventId: `job-${job.id}`,
          raw: message.metadata || {},
        },
      });

      // Send the message through the adapter
      const result = await adapter.sendMessage(envelope, {
        text: message.text,
        attachments: message.attachments,
        threadId: message.target.id,
      });

      this.logger.log(
        `Message sent successfully via ${message.platform} - Provider Message ID: ${result.providerMessageId}`,
      );

      return {
        success: true,
        providerMessageId: result.providerMessageId,
        platform: message.platform,
        target: message.target,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to send message via ${message.platform}: ${error.message}`,
        error.stack,
      );

      throw error;
    }
  }

  async onModuleDestroy() {
    this.logger.log('Message processor shutting down, cleaning up platform providers...');

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