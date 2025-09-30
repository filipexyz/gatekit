import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './services/webhooks.service';
import { WebhookDeliveryService } from './services/webhook-delivery.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookDeliveryService],
  exports: [WebhookDeliveryService], // Export so other modules can use it
})
export class WebhooksModule {}
