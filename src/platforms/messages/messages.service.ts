import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SendMessageDto } from '../dto/send-message.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { MessageQueue } from '../../queues/message.queue';
import { PlatformsService } from '../platforms.service';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly platformsService: PlatformsService,
    private readonly prisma: PrismaService,
    private readonly messageQueue: MessageQueue,
  ) {}

  async sendMessage(projectSlug: string, sendMessageDto: SendMessageDto) {
    const targetCount = sendMessageDto.targets.length;
    const platformIds = sendMessageDto.targets.map((t) => t.platformId);

    this.logger.log(`Sending message to ${targetCount} targets`);

    // Get project and validate platforms
    const project = await this.getProject(projectSlug);
    for (const target of sendMessageDto.targets) {
      await this.platformsService.validatePlatformConfigById(target.platformId);
    }

    // Queue message for processing
    const queueResult = await this.messageQueue.addMessage({
      projectSlug,
      projectId: project.id,
      message: sendMessageDto,
    });

    this.logger.log(`Message queued - Job ID: ${queueResult.jobId}`);

    const response = {
      success: true,
      jobId: queueResult.jobId,
      status: queueResult.status,
      targets: sendMessageDto.targets,
      platformIds,
      timestamp: new Date().toISOString(),
      message: 'Message queued for delivery',
    };
    return response;
  }

  async getMessageStatus(jobId: string) {
    // Get job status from queue
    const jobStatus = await this.messageQueue.getJobStatus(jobId);
    if (!jobStatus) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    // Get actual delivery results from database
    const deliveryResults = await this.prisma.sentMessage.findMany({
      where: { jobId },
      select: {
        id: true,
        platformId: true,
        platform: true,
        targetChatId: true,
        targetUserId: true,
        targetType: true,
        status: true,
        errorMessage: true,
        providerMessageId: true,
        sentAt: true,
        createdAt: true,
      },
    });

    // Calculate delivery summary
    const totalTargets = deliveryResults.length;
    const successfulDeliveries = deliveryResults.filter(
      (r) => r.status === 'sent',
    ).length;
    const failedDeliveries = deliveryResults.filter(
      (r) => r.status === 'failed',
    ).length;
    const pendingDeliveries = deliveryResults.filter(
      (r) => r.status === 'pending',
    ).length;

    // Determine overall status
    let overallStatus: 'completed' | 'failed' | 'partial' | 'pending';
    if (pendingDeliveries > 0) {
      overallStatus = 'pending';
    } else if (successfulDeliveries === totalTargets) {
      overallStatus = 'completed';
    } else if (failedDeliveries === totalTargets) {
      overallStatus = 'failed';
    } else {
      overallStatus = 'partial';
    }

    return {
      ...jobStatus,
      delivery: {
        overallStatus,
        summary: {
          totalTargets,
          successful: successfulDeliveries,
          failed: failedDeliveries,
          pending: pendingDeliveries,
        },
        results: deliveryResults,
        errors: deliveryResults
          .filter((r) => r.status === 'failed' && r.errorMessage)
          .map((r) => ({
            platform: r.platform,
            target: `${r.targetType}:${r.targetChatId}`,
            error: r.errorMessage,
          })),
      },
    };
  }

  async getQueueMetrics() {
    return this.messageQueue.getQueueMetrics();
  }

  async retryMessage(jobId: string) {
    return this.messageQueue.retryFailedJob(jobId);
  }

  private async getProject(projectSlug: string) {
    const project = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
    });

    if (!project) {
      throw new NotFoundException(
        `Project with slug '${projectSlug}' not found`,
      );
    }

    return project;
  }
}
