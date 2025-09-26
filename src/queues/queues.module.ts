import { Module, Logger, OnModuleInit } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MessageQueue } from './message.queue';
import { DynamicMessageProcessor } from './processors/dynamic-message.processor';
import { PlatformsModule } from '../platforms/platforms.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'messages',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
    PlatformsModule,
    PrismaModule,
  ],
  providers: [MessageQueue, DynamicMessageProcessor],
  exports: [MessageQueue, BullModule],
})
export class QueuesModule implements OnModuleInit {
  private readonly logger = new Logger(QueuesModule.name);

  async onModuleInit() {
    this.logger.log('🚀 QueuesModule initialized - registering message queue and processor');
    this.logger.log('📦 Queue name: "messages" | Job type: "send-message"');
    this.logger.log('🔄 Default job options: 3 attempts, exponential backoff, keep failed jobs');
    this.logger.log('⚙️ Processor: DynamicMessageProcessor should be connected to Redis');
  }
}