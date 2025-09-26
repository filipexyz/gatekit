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
    const targetCount = sendMessageDto.targets.length;
    const platformIds = sendMessageDto.targets.map(t => t.platformId);

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


}