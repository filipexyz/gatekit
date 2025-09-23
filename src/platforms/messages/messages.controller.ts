import { Controller, Post, Body, Param, UseGuards, Get } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SendMessageDto } from '../dto/send-message.dto';
import { AppAuthGuard } from '../../common/guards/app-auth.guard';
import { RequireScopes } from '../../common/decorators/require-scopes.decorator';
import { SdkContract } from '../../common/decorators/sdk-contract.decorator';
import { MessageSendResponse, MessageStatusResponse, MessageRetryResponse } from '../../common/types/api-responses';

@Controller('api/v1/projects/:projectSlug/messages')
@UseGuards(AppAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post('send')
  @RequireScopes('messages:send')
  @SdkContract({
    command: 'messages send',
    description: 'Send a message to platforms',
    category: 'Messages',
    requiredScopes: ['messages:send'],
    inputType: 'SendMessageDto',
    outputType: 'MessageSendResponse',
    options: {
      targets: { required: true, description: 'Message targets array', type: 'object' },
      content: { required: true, description: 'Message content object', type: 'object' },
      options: { description: 'Message options', type: 'object' },
      metadata: { description: 'Message metadata', type: 'object' }
    },
    examples: [
      {
        description: 'Send text message',
        command: 'gatekit messages send --targets "[{\"platformId\":\"id\",\"type\":\"channel\",\"id\":\"123\"}]" --text "Hello!"'
      }
    ]
  })
  async sendMessage(
    @Param('projectSlug') projectSlug: string,
    @Body() sendMessageDto: SendMessageDto,
  ) {
    return this.messagesService.sendMessage(projectSlug, sendMessageDto);
  }

  @Get('status/:jobId')
  @RequireScopes('messages:read')
  @SdkContract({
    command: 'messages status',
    description: 'Check message delivery status',
    category: 'Messages',
    requiredScopes: ['messages:read'],
    outputType: 'MessageStatusResponse',
    options: {
      jobId: { required: true, description: 'Message job ID', type: 'string' }
    },
    examples: [
      {
        description: 'Check message status',
        command: 'gatekit messages status --jobId "job-123"'
      }
    ]
  })
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
  @SdkContract({
    command: 'messages retry',
    description: 'Retry a failed message',
    category: 'Messages',
    requiredScopes: ['messages:send'],
    outputType: 'MessageRetryResponse',
    options: {
      jobId: { required: true, description: 'Failed message job ID', type: 'string' }
    },
    examples: [
      {
        description: 'Retry failed message',
        command: 'gatekit messages retry --jobId "job-123"'
      }
    ]
  })
  async retryMessage(
    @Param('projectSlug') projectSlug: string,
    @Param('jobId') jobId: string,
  ) {
    return this.messagesService.retryMessage(jobId);
  }
}