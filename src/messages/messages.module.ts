import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MessagesService as PlatformMessagesService } from '../platforms/messages/messages.service';
import { PlatformsModule } from '../platforms/platforms.module';

@Module({
  imports: [PrismaModule, PlatformsModule],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
