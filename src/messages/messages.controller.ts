import {
  Controller,
  Get,
  Query,
  Param,
  Delete,
  UseGuards,
  Body,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { QueryMessagesDto } from './dto/query-messages.dto';
import { AppAuthGuard } from '../common/guards/app-auth.guard';
import { RequireScopes } from '../common/decorators/require-scopes.decorator';
import { SdkContract } from '../common/decorators/sdk-contract.decorator';

@Controller('api/v1/projects/:projectSlug/messages')
@UseGuards(AppAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

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
        description: 'Filter by platform (telegram, discord)',
        type: 'string',
        choices: ['telegram', 'discord'],
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
        command: 'gatekit messages list --platform telegram --chatId "123456789"',
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
}