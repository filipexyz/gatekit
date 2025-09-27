import {
  Controller,
  Get,
  Query,
  Param,
  Delete,
  UseGuards,
  Body,
  Post,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { QueryMessagesDto } from './dto/query-messages.dto';
// Clean interface for SDK generation
import type { QueryMessagesDto as QueryMessagesInterface } from './interfaces/query-messages.interface';
import { SendMessageDto } from '../platforms/dto/send-message.dto';
import { MessagesService as PlatformMessagesService } from '../platforms/messages/messages.service';
import { AppAuthGuard } from '../common/guards/app-auth.guard';
import { RequireScopes } from '../common/decorators/require-scopes.decorator';
import { SdkContract } from '../common/decorators/sdk-contract.decorator';

@Controller('api/v1/projects/:projectSlug/messages')
@UseGuards(AppAuthGuard)
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly platformMessagesService: PlatformMessagesService,
  ) {}

  @Get()
  @RequireScopes('messages:read')
  @SdkContract({
    command: 'messages list',
    description: 'List received messages for a project',
    category: 'Messages',
    requiredScopes: ['messages:read'],
    inputType: 'QueryMessagesDto',
    outputType: 'MessageListResponse',
    options: {
      platform: {
        description: 'Filter by platform (telegram, discord, whatsapp-evo)',
        type: 'string',
        choices: ['telegram', 'discord', 'whatsapp-evo'],
      },
      chatId: {
        description: 'Filter by chat/channel ID',
        type: 'string',
      },
      userId: {
        description: 'Filter by user ID',
        type: 'string',
      },
      startDate: {
        description: 'Filter messages after this date (ISO 8601)',
        type: 'string',
      },
      endDate: {
        description: 'Filter messages before this date (ISO 8601)',
        type: 'string',
      },
      limit: {
        description: 'Number of messages to return (1-100)',
        type: 'number',
        default: 50,
      },
      offset: {
        description: 'Number of messages to skip',
        type: 'number',
        default: 0,
      },
      order: {
        description: 'Sort order (asc or desc)',
        type: 'string',
        choices: ['asc', 'desc'],
        default: 'desc',
      },
    },
    examples: [
      {
        description: 'Get latest 50 messages',
        command: 'gatekit messages list',
      },
      {
        description: 'Get Telegram messages from specific chat',
        command:
          'gatekit messages list --platform telegram --chatId "123456789"',
      },
      {
        description: 'Get messages from last 24 hours',
        command: 'gatekit messages list --startDate "2024-01-01T00:00:00Z"',
      },
    ],
  })
  async getMessages(
    @Param('projectSlug') projectSlug: string,
    @Query() query: QueryMessagesDto,
  ) {
    return this.messagesService.getMessages(projectSlug, query);
  }

  @Get('stats')
  @RequireScopes('messages:read')
  @SdkContract({
    command: 'messages stats',
    description: 'Get message statistics for a project',
    category: 'Messages',
    requiredScopes: ['messages:read'],
    outputType: 'MessageStatsResponse',
    examples: [
      {
        description: 'Get message statistics',
        command: 'gatekit messages stats',
      },
    ],
  })
  async getMessageStats(@Param('projectSlug') projectSlug: string) {
    return this.messagesService.getMessageStats(projectSlug);
  }

  @Get(':messageId')
  @RequireScopes('messages:read')
  @SdkContract({
    command: 'messages get',
    description: 'Get a specific message by ID',
    category: 'Messages',
    requiredScopes: ['messages:read'],
    outputType: 'ReceivedMessage',
    options: {
      messageId: {
        required: true,
        description: 'Message ID',
        type: 'string',
      },
    },
    examples: [
      {
        description: 'Get specific message',
        command: 'gatekit messages get --messageId "msg-123"',
      },
    ],
  })
  async getMessage(
    @Param('projectSlug') projectSlug: string,
    @Param('messageId') messageId: string,
  ) {
    return this.messagesService.getMessage(projectSlug, messageId);
  }

  @Delete('cleanup')
  @RequireScopes('messages:write')
  @SdkContract({
    command: 'messages cleanup',
    description: 'Delete messages older than specified days',
    category: 'Messages',
    requiredScopes: ['messages:write'],
    outputType: 'MessageResponse',
    options: {
      daysBefore: {
        required: true,
        description: 'Delete messages older than this many days',
        type: 'number',
      },
    },
    examples: [
      {
        description: 'Delete messages older than 30 days',
        command: 'gatekit messages cleanup --daysBefore 30',
      },
    ],
  })
  async deleteOldMessages(
    @Param('projectSlug') projectSlug: string,
    @Body('daysBefore') daysBefore: number,
  ) {
    return this.messagesService.deleteOldMessages(projectSlug, daysBefore);
  }

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
      target: {
        description: 'Single target in format: platformId:type:id',
        type: 'target_pattern',
      },
      targets: {
        description:
          'Multiple targets comma-separated: platformId:type:id,platformId:type:id',
        type: 'targets_pattern',
      },
      text: {
        description: 'Message text content',
        type: 'string',
      },
      content: {
        description: 'Full message content object (advanced)',
        type: 'object',
      },
      options: { description: 'Message options', type: 'object' },
      metadata: { description: 'Message metadata', type: 'object' },
    },
    examples: [
      {
        description: 'Send to single user',
        command:
          'gatekit messages send --target "platformId:user:253191879" --text "Hello!"',
      },
      {
        description: 'Send to multiple targets',
        command:
          'gatekit messages send --targets "platform1:user:123,platform2:channel:456" --text "Broadcast message"',
      },
      {
        description: 'Advanced with full content object',
        command:
          'gatekit messages send --target "platformId:user:123" --content \'{"text":"Hello","buttons":[{"text":"Click me"}]}\'',
      },
    ],
  })
  async sendMessage(
    @Param('projectSlug') projectSlug: string,
    @Body() sendMessageDto: SendMessageDto,
  ) {
    return this.platformMessagesService.sendMessage(
      projectSlug,
      sendMessageDto,
    );
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
      jobId: { required: true, description: 'Message job ID', type: 'string' },
    },
    examples: [
      {
        description: 'Check message status',
        command: 'gatekit messages status --jobId "job-123"',
      },
    ],
  })
  async getMessageStatus(
    @Param('projectSlug') projectSlug: string,
    @Param('jobId') jobId: string,
  ) {
    return this.platformMessagesService.getMessageStatus(jobId);
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
      jobId: {
        required: true,
        description: 'Failed message job ID',
        type: 'string',
      },
    },
    examples: [
      {
        description: 'Retry failed message',
        command: 'gatekit messages retry --jobId "job-123"',
      },
    ],
  })
  async retryMessage(
    @Param('projectSlug') projectSlug: string,
    @Param('jobId') jobId: string,
  ) {
    return this.platformMessagesService.retryMessage(jobId);
  }

  @Get('sent')
  @RequireScopes('messages:read')
  @SdkContract({
    command: 'messages sent',
    description: 'List sent messages for a project',
    category: 'Messages',
    requiredScopes: ['messages:read'],
    outputType: 'SentMessage[]',
    options: {
      platform: { description: 'Filter by platform', type: 'string' },
      status: {
        description: 'Filter by status (pending, sent, failed)',
        type: 'string',
        choices: ['pending', 'sent', 'failed'],
      },
      limit: {
        description: 'Number of messages to return',
        type: 'number',
        default: 50,
      },
      offset: {
        description: 'Number of messages to skip',
        type: 'number',
        default: 0,
      },
    },
    examples: [
      {
        description: 'Get sent messages',
        command: 'gatekit messages sent',
      },
      {
        description: 'Get failed messages',
        command: 'gatekit messages sent --status failed',
      },
    ],
  })
  async getSentMessages(
    @Param('projectSlug') projectSlug: string,
    @Query() query: any,
  ) {
    return this.messagesService.getSentMessages(projectSlug, query);
  }
}
