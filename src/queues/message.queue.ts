import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { SendMessageDto } from '../platforms/dto/send-message.dto';

export interface MessageJobData {
  projectSlug: string;
  projectId: string;
  message: SendMessageDto;
  attemptNumber?: number;
}

@Injectable()
export class MessageQueue implements OnModuleDestroy {
  private readonly logger = new Logger(MessageQueue.name);

  constructor(@InjectQueue('messages') private messageQueue: Queue) {}

  async addMessage(data: MessageJobData) {
    const job = await this.messageQueue.add('send-message', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 100, // Keep last 100 completed jobs for monitoring
      removeOnFail: false, // Keep failed jobs for debugging
    });

    const platformIds = data.message.targets.map(t => t.platformId);
    this.logger.log(
      `Message queued for ${data.message.targets.length} targets with platformIds: ${platformIds.join(', ')} (Job ID: ${job.id})`,
    );

    return {
      jobId: job.id,
      status: 'queued',
    };
  }

  async getJobStatus(jobId: string) {
    const job = await this.messageQueue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress();

    return {
      id: job.id,
      state,
      progress,
      data: job.data,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
    };
  }

  async getQueueMetrics() {
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      this.messageQueue.getWaitingCount(),
      this.messageQueue.getActiveCount(),
      this.messageQueue.getCompletedCount(),
      this.messageQueue.getFailedCount(),
      this.messageQueue.getDelayedCount(),
      this.messageQueue.getPausedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
      total: waiting + active + delayed + paused,
    };
  }

  async retryFailedJob(jobId: string) {
    const job = await this.messageQueue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    const state = await job.getState();
    if (state !== 'failed') {
      throw new Error(`Job ${jobId} is not in failed state (current: ${state})`);
    }

    await job.retry();
    this.logger.log(`Retrying failed job ${jobId}`);

    return { success: true, jobId };
  }

  async clearFailedJobs() {
    await this.messageQueue.clean(0, 'failed');
    this.logger.log('Cleared all failed jobs');
  }

  async clearCompletedJobs() {
    await this.messageQueue.clean(0, 'completed');
    this.logger.log('Cleared all completed jobs');
  }

  async onModuleDestroy() {
    try {
      await this.messageQueue.close();
      this.logger.debug('Message queue closed successfully');
    } catch (error) {
      this.logger.warn(`Failed to close message queue: ${error.message}`);
    }
  }
}