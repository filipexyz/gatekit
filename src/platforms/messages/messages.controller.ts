import { Controller, Post, Body, Param, UseGuards, Get } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SendMessageDto } from '../dto/send-message.dto';
import { AppAuthGuard } from '../../common/guards/app-auth.guard';
import { RequireScopes } from '../../common/decorators/require-scopes.decorator';

@Controller('api/v1/projects/:projectSlug/messages')
@UseGuards(AppAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post('send')
  @RequireScopes('messages:send')
  async sendMessage(
    @Param('projectSlug') projectSlug: string,
    @Body() sendMessageDto: SendMessageDto,
  ) {
    return this.messagesService.sendMessage(projectSlug, sendMessageDto);
  }

  @Get('status/:jobId')
  @RequireScopes('messages:read')
  async getMessageStatus(
    @Param('projectSlug') projectSlug: string,
    @Param('jobId') jobId: string,
  ) {
    return this.messagesService.getMessageStatus(jobId);
  }

  @Get('queue/metrics')
  @RequireScopes('messages:read')
  async getQueueMetrics(
    @Param('projectSlug') projectSlug: string,
  ) {
    return this.messagesService.getQueueMetrics();
  }

  @Post('retry/:jobId')
  @RequireScopes('messages:send')
  async retryMessage(
    @Param('projectSlug') projectSlug: string,
    @Param('jobId') jobId: string,
  ) {
    return this.messagesService.retryMessage(jobId);
  }
}