import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
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
    this.logger.log(
      `Queueing message via ${sendMessageDto.platform} to ${sendMessageDto.target.type}:${sendMessageDto.target.id}`,
    );

    // Get project
    const project = await this.getProject(projectSlug);

    // Validate platform configuration exists and is active
    await this.validatePlatformConfig(project.id, sendMessageDto.platform);

    // Add message to queue for async processing
    const queueResult = await this.messageQueue.addMessage({
      projectSlug,
      projectId: project.id,
      message: sendMessageDto,
    });

    this.logger.log(
      `Message queued successfully - Job ID: ${queueResult.jobId}`,
    );

    return {
      success: true,
      jobId: queueResult.jobId,
      status: queueResult.status,
      platform: sendMessageDto.platform,
      target: sendMessageDto.target,
      timestamp: new Date().toISOString(),
      message: 'Message queued for delivery',
    };
  }

  async getMessageStatus(jobId: string) {
    const status = await this.messageQueue.getJobStatus(jobId);
    if (!status) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }
    return status;
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
      throw new NotFoundException(`Project with slug '${projectSlug}' not found`);
    }

    return project;
  }

  private async validatePlatformConfig(projectId: string, platform: string) {
    const platformConfig = await this.prisma.projectPlatform.findUnique({
      where: {
        projectId_platform: {
          projectId,
          platform,
        },
      },
    });

    if (!platformConfig) {
      throw new NotFoundException(
        `Platform '${platform}' is not configured for this project`,
      );
    }

    if (!platformConfig.isActive) {
      throw new BadRequestException(
        `Platform '${platform}' is currently disabled`,
      );
    }

    return platformConfig;
  }

}