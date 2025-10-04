import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bullmq';
import { PlatformsService } from './platforms.service';
import { PlatformsController } from './platforms.controller';
import { MessagesService } from './messages/messages.service';
import { DynamicWebhookController } from './webhooks/dynamic-webhook.controller';
import { PlatformHealthController } from './controllers/platform-health.controller';
import { PlatformLogsController } from './controllers/platform-logs.controller';
import { EventBusService } from './services/event-bus.service';
import { PlatformRegistry } from './services/platform-registry.service';
import { PlatformLogsService } from './services/platform-logs.service';
import { CredentialValidationService } from './services/credential-validation.service';
import { TelegramCredentialsValidator } from './validators/telegram-credentials.validator';
import { DiscordCredentialsValidator } from './validators/discord-credentials.validator';
import { WhatsAppCredentialsValidator } from './validators/whatsapp-credentials.validator';
import { EmailCredentialsValidator } from './validators/email-credentials.validator';
import { PrismaModule } from '../prisma/prisma.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { VoiceModule } from '../voice/voice.module';
import { EVENT_BUS } from './interfaces/event-bus.interface';
import { MessageQueue } from '../queues/message.queue';

// Platform Providers
import { DiscordProvider } from './providers/discord.provider';
import { TelegramProvider } from './providers/telegram.provider';
import { WhatsAppProvider } from './providers/whatsapp.provider';
import { EmailProvider } from './providers/email.provider';

@Module({
  imports: [
    PrismaModule,
    WebhooksModule,
    VoiceModule,
    DiscoveryModule,
    BullModule.registerQueue({
      name: 'messages',
    }),
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),
  ],
  controllers: [
    PlatformsController,
    DynamicWebhookController,
    PlatformHealthController,
    PlatformLogsController,
  ],
  providers: [
    PlatformsService,
    MessagesService,
    EventBusService,
    PlatformRegistry,
    PlatformLogsService,
    CredentialValidationService,
    TelegramCredentialsValidator,
    DiscordCredentialsValidator,
    WhatsAppCredentialsValidator,
    EmailCredentialsValidator,
    MessageQueue,
    {
      provide: EVENT_BUS,
      useClass: EventBusService,
    },
    // Platform Providers - will be auto-discovered
    DiscordProvider,
    TelegramProvider,
    WhatsAppProvider,
    EmailProvider,
  ],
  exports: [
    PlatformsService,
    MessagesService,
    PlatformRegistry,
    PlatformLogsService,
  ],
})
export class PlatformsModule {}
