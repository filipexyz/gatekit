import { Module } from '@nestjs/common';
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
export class QueuesModule {}