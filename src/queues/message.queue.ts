import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { SendMessageDto } from '../platforms/dto/send-message.dto';

export interface MessageJobData {
  projectSlug: string;
  projectId: string;
  message: SendMessageDto;
  attemptNumber?: number;
}

@Injectable()
export class MessageQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessageQueue.name);

  constructor(@InjectQueue('messages') private messageQueue: Queue) {
    this.logger.log('🏗️ MessageQueue constructor - injected "messages" queue');
  }

  async onModuleInit() {
    try {
      this.logger.log('🔌 MessageQueue onModuleInit - checking Redis connection...');

      // BullMQ has different client API
      this.logger.log(`📊 BullMQ Queue Status: Connected and ready`);

      // Test queue operations
      const metrics = await this.getQueueMetrics();
      this.logger.log(`📈 Queue Metrics on Startup:`, metrics);

      this.logger.log('✅ MessageQueue Redis connection verified');
    } catch (error) {
      this.logger.error(`❌ MessageQueue Redis connection failed: ${error.message}`);
    }
  }

  async addMessage(data: MessageJobData) {
    this.logger.log(`🎯 Adding job to queue - Job type: "send-message", Queue: "messages"`);
    this.logger.log(`📊 Queue metrics before adding:`, await this.getQueueMetrics());

    const job = await this.messageQueue.add('send-message', data);
    // Job options inherited from global BullModule.forRootAsync() configuration

    const platformIds = data.message.targets.map(t => t.platformId);
    this.logger.log(
      `✅ Message queued for ${data.message.targets.length} targets with platformIds: ${platformIds.join(', ')} (Job ID: ${job.id})`,
    );

    this.logger.log(`📊 Queue metrics after adding:`, await this.getQueueMetrics());
    this.logger.log(`🔍 Job added to BullMQ queue: messages`);

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
    const progress = job.progress;

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
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.messageQueue.getWaitingCount(),
      this.messageQueue.getActiveCount(),
      this.messageQueue.getCompletedCount(),
      this.messageQueue.getFailedCount(),
      this.messageQueue.getDelayedCount(),
    ]);

    const paused = 0; // BullMQ doesn't have getPausedCount

    // DEEP DEBUG: Check for stalled jobs that might be blocking the queue
    try {
      const activeJobs = await this.messageQueue.getActive();

      this.logger.log(`🔍 STALLED JOB DETECTION:`, {
        activeJobsCount: activeJobs.length,
        activeJobIds: activeJobs.map(j => j.id),
      });

      if (activeJobs.length > 0) {
        this.logger.warn(`⚠️ FOUND ${activeJobs.length} ACTIVE JOBS - These might be stalled and blocking the queue!`);

        // Check if active jobs are actually stalled
        for (const job of activeJobs) {
          const timeSinceStarted = Date.now() - (job.processedOn || 0);
          this.logger.warn(`🕐 Active job ${job.id} has been running for ${timeSinceStarted}ms`);

          if (timeSinceStarted > 60000) { // More than 1 minute
            this.logger.error(`🚨 Job ${job.id} appears STALLED (running > 1 minute) - This blocks all other jobs!`);
          }
        }
      }
    } catch (error) {
      this.logger.error(`❌ Stalled job detection failed: ${error.message}`);
    }

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
    await this.messageQueue.clean(0, 0, 'failed');
    this.logger.log('Cleared all failed jobs');
  }

  async clearCompletedJobs() {
    await this.messageQueue.clean(0, 0, 'completed');
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