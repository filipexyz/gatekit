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
import { SendMessageDto } from '../platforms/dto/send-message.dto';
import { SendReactionDto } from '../platforms/dto/send-reaction.dto';
import { MessagesService as PlatformMessagesService } from '../platforms/messages/messages.service';
import { AppAuthGuard } from '../common/guards/app-auth.guard';
import { ProjectAccessGuard } from '../common/guards/project-access.guard';
import { RequireScopes } from '../common/decorators/require-scopes.decorator';
import { SdkContract } from '../common/decorators/sdk-contract.decorator';
import { AuthContextParam } from '../common/decorators/auth-context.decorator';
import type { AuthContext } from '../common/utils/security.util';
import { ApiScope } from '../common/enums/api-scopes.enum';

@Controller('api/v1/projects/:project/messages')
@UseGuards(AppAuthGuard, ProjectAccessGuard)
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly platformMessagesService: PlatformMessagesService,
  ) {}

  @Get()
  @RequireScopes(ApiScope.MESSAGES_READ)
  @SdkContract({
    command: 'messages list',
    description: 'List received messages for a project',
    category: 'Messages',
    requiredScopes: [ApiScope.MESSAGES_READ],
    inputType: 'QueryMessagesDto',
    outputType: 'MessageListResponse',
    options: {
      platformId: {
        description: 'Filter by platform ID',
        type: 'string',
      },
      platform: {
        description:
          'Filter by platform type (telegram, discord, whatsapp-evo)',
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
      raw: {
        description: 'Include raw platform message data',
        type: 'boolean',
        default: false,
      },
      reactions: {
        description: 'Include reactions on each message',
        type: 'boolean',
        default: false,
      },
    },
    examples: [
      {
        description: 'Get latest 50 messages',
        command: 'gatekit messages list',
      },
      {
        description: 'Get messages from specific platform instance',
        command:
          'gatekit messages list --platformId "platform-abc123" --chatId "123456789"',
      },
      {
        description: 'Get Telegram messages from any instance',
        command:
          'gatekit messages list --platform telegram --chatId "123456789"',
      },
      {
        description: 'Get messages from last 24 hours',
        command: 'gatekit messages list --startDate "2024-01-01T00:00:00Z"',
      },
      {
        description: 'Get messages with raw platform data',
        command: 'gatekit messages list --raw --limit 5',
      },
      {
        description: 'Get messages with reactions included',
        command: 'gatekit messages list --reactions --limit 10',
      },
    ],
  })
  async getMessages(
    @Param('project') project: string,
    @Query() query: QueryMessagesDto,
    @AuthContextParam() authContext: AuthContext,
  ) {
    return this.messagesService.getMessages(project, query, authContext);
  }

  @Get('stats')
  @RequireScopes(ApiScope.MESSAGES_READ)
  @SdkContract({
    command: 'messages stats',
    description: 'Get message statistics for a project',
    category: 'Messages',
    requiredScopes: [ApiScope.MESSAGES_READ],
    outputType: 'MessageStatsResponse',
    examples: [
      {
        description: 'Get message statistics',
        command: 'gatekit messages stats',
      },
    ],
  })
  async getMessageStats(@Param('project') project: string) {
    return this.messagesService.getMessageStats(project);
  }

  @Get('sent')
  @RequireScopes(ApiScope.MESSAGES_READ)
  @SdkContract({
    command: 'messages sent',
    description: 'List sent messages for a project',
    category: 'Messages',
    requiredScopes: [ApiScope.MESSAGES_READ],
    outputType: 'SentMessageResponse[]',
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
    @Param('project') project: string,
    @Query() query: any,
    @AuthContextParam() authContext: AuthContext,
  ) {
    return this.messagesService.getSentMessages(project, query, authContext);
  }

  @Get(':messageId')
  @RequireScopes(ApiScope.MESSAGES_READ)
  @SdkContract({
    command: 'messages get',
    description: 'Get a specific message by ID',
    category: 'Messages',
    requiredScopes: [ApiScope.MESSAGES_READ],
    outputType: 'ReceivedMessageResponse',
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
    @Param('project') project: string,
    @Param('messageId') messageId: string,
  ) {
    return this.messagesService.getMessage(project, messageId);
  }

  @Delete('cleanup')
  @RequireScopes(ApiScope.MESSAGES_WRITE)
  @SdkContract({
    command: 'messages cleanup',
    description: 'Delete messages older than specified days',
    category: 'Messages',
    requiredScopes: [ApiScope.MESSAGES_WRITE],
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
    @Param('project') project: string,
    @Body('daysBefore') daysBefore: number,
  ) {
    return this.messagesService.deleteOldMessages(project, daysBefore);
  }

  @Post('send')
  @RequireScopes(ApiScope.MESSAGES_SEND)
  @SdkContract({
    command: 'messages send',
    description: 'Send a message to platforms',
    category: 'Messages',
    requiredScopes: [ApiScope.MESSAGES_SEND],
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
    @Param('project') project: string,
    @Body() sendMessageDto: SendMessageDto,
  ) {
    return this.platformMessagesService.sendMessage(project, sendMessageDto);
  }

  @Get('status/:jobId')
  @RequireScopes(ApiScope.MESSAGES_READ)
  @SdkContract({
    command: 'messages status',
    description: 'Check message delivery status',
    category: 'Messages',
    requiredScopes: [ApiScope.MESSAGES_READ],
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
    @Param('project') project: string,
    @Param('jobId') jobId: string,
  ) {
    return this.platformMessagesService.getMessageStatus(jobId);
  }

  @Post('retry/:jobId')
  @RequireScopes(ApiScope.MESSAGES_SEND)
  @SdkContract({
    command: 'messages retry',
    description: 'Retry a failed message',
    category: 'Messages',
    requiredScopes: [ApiScope.MESSAGES_SEND],
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
    @Param('project') project: string,
    @Param('jobId') jobId: string,
  ) {
    return this.platformMessagesService.retryMessage(jobId);
  }

  @Post('react')
  @RequireScopes(ApiScope.MESSAGES_SEND)
  @SdkContract({
    command: 'messages react',
    description: 'Add a reaction to a message',
    category: 'Messages',
    requiredScopes: [ApiScope.MESSAGES_SEND],
    inputType: 'SendReactionDto',
    outputType: 'MessageResponse',
    options: {
      platformId: {
        required: true,
        description: 'Platform configuration ID',
        type: 'string',
      },
      messageId: {
        required: true,
        description: 'Message ID to react to',
        type: 'string',
      },
      emoji: {
        required: true,
        description: 'Emoji to react with (e.g., "👍", "❤️")',
        type: 'string',
      },
    },
    examples: [
      {
        description: 'React with thumbs up',
        command:
          'gatekit messages react --platformId "platform-123" --messageId "msg-456" --emoji "👍"',
      },
      {
        description: 'React with heart',
        command:
          'gatekit messages react --platformId "platform-123" --messageId "msg-456" --emoji "❤️"',
      },
    ],
  })
  async reactToMessage(
    @Param('project') project: string,
    @Body() sendReactionDto: SendReactionDto,
    @AuthContextParam() authContext: AuthContext,
  ) {
    return this.platformMessagesService.reactToMessage(
      project,
      sendReactionDto,
      authContext,
    );
  }

  @Post('unreact')
  @RequireScopes(ApiScope.MESSAGES_SEND)
  @SdkContract({
    command: 'messages unreact',
    description: 'Remove a reaction from a message',
    category: 'Messages',
    requiredScopes: [ApiScope.MESSAGES_SEND],
    inputType: 'SendReactionDto',
    outputType: 'MessageResponse',
    options: {
      platformId: {
        required: true,
        description: 'Platform configuration ID',
        type: 'string',
      },
      messageId: {
        required: true,
        description: 'Message ID to unreact from',
        type: 'string',
      },
      emoji: {
        required: true,
        description: 'Emoji to remove (e.g., "👍", "❤️")',
        type: 'string',
      },
    },
    examples: [
      {
        description: 'Remove thumbs up reaction',
        command:
          'gatekit messages unreact --platformId "platform-123" --messageId "msg-456" --emoji "👍"',
      },
    ],
  })
  async unreactToMessage(
    @Param('project') project: string,
    @Body() sendReactionDto: SendReactionDto,
    @AuthContextParam() authContext: AuthContext,
  ) {
    return this.platformMessagesService.unreactToMessage(
      project,
      sendReactionDto,
      authContext,
    );
  }
}
