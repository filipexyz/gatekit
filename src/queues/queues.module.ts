import { Module, Logger, OnModuleInit } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MessageQueue } from './message.queue';
import { DynamicMessageProcessor } from './processors/dynamic-message.processor';
import { PlatformsModule } from '../platforms/platforms.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { VoiceModule } from '../voice/voice.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'messages',
      // BullMQ uses different worker settings - configured in app.module.ts
    }),
    PlatformsModule,
    PrismaModule,
    WebhooksModule,
    VoiceModule,
  ],
  providers: [MessageQueue, DynamicMessageProcessor],
  exports: [MessageQueue, BullModule],
})
export class QueuesModule implements OnModuleInit {
  private readonly logger = new Logger(QueuesModule.name);

  async onModuleInit() {
    this.logger.log(
      '🚀 QueuesModule initialized - registering message queue and processor',
    );
    this.logger.log('📦 Queue name: "messages" | Job type: "send-message"');
    this.logger.log(
      '🔄 Default job options: 3 attempts, exponential backoff, keep failed jobs',
    );
    this.logger.log(
      '⚙️ Processor: DynamicMessageProcessor should be connected to Redis',
    );
  }
}
