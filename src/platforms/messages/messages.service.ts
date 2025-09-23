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

    this.logger.log(
      `[STEP 1] Starting sendMessage - Targets: ${targetCount}, PlatformIds: ${platformIds.join(', ')}`,
    );

    // Get project
    this.logger.log(`[STEP 2] Getting project: ${projectSlug}`);
    const project = await this.getProject(projectSlug);
    this.logger.log(`[STEP 2 COMPLETE] Project found: ${project.id}`);

    // Validate all platform configurations exist and are active by platformId
    this.logger.log(`[STEP 3] Starting platform validation for ${sendMessageDto.targets.length} targets`);
    for (const target of sendMessageDto.targets) {
      this.logger.log(`[STEP 3.${target.platformId}] Validating platformId: ${target.platformId}`);
      await this.platformsService.validatePlatformConfigById(target.platformId);
      this.logger.log(`[STEP 3.${target.platformId} COMPLETE] Platform validation passed`);
    }
    this.logger.log(`[STEP 3 COMPLETE] All platform validations passed`);

    // Add message to queue for async processing
    this.logger.log(`[STEP 4] Adding message to queue`);
    const queueResult = await this.messageQueue.addMessage({
      projectSlug,
      projectId: project.id,
      message: sendMessageDto,
    });
    this.logger.log(`[STEP 4 COMPLETE] Message queued - Job ID: ${queueResult.jobId}`);

    this.logger.log(`[STEP 5] Preparing response`);
    const response = {
      success: true,
      jobId: queueResult.jobId,
      status: queueResult.status,
      targets: sendMessageDto.targets,
      platformIds,
      timestamp: new Date().toISOString(),
      message: 'Message queued for delivery',
    };

    this.logger.log(`[STEP 6] Returning response for job ${queueResult.jobId}`);
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