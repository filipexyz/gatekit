import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { PlatformsService } from './platforms.service';
import { CreatePlatformDto } from './dto/create-platform.dto';
import { UpdatePlatformDto } from './dto/update-platform.dto';
import { AppAuthGuard } from '../common/guards/app-auth.guard';
import { RequireScopes } from '../common/decorators/require-scopes.decorator';
import { SdkContract } from '../common/decorators/sdk-contract.decorator';

@Controller('api/v1/projects/:projectSlug/platforms')
@UseGuards(AppAuthGuard)
export class PlatformsController {
  constructor(private readonly platformsService: PlatformsService) {}

  @Post()
  @RequireScopes('platforms:write')
  @SdkContract({
    command: 'platforms create',
    description: 'Configure a new platform integration',
    category: 'Platforms',
    requiredScopes: ['platforms:write'],
    inputType: 'CreatePlatformDto',
    outputType: 'PlatformResponse',
    options: {
      platform: {
        required: true,
        description: 'Platform type',
        choices: ['discord', 'telegram', 'whatsapp-evo'],
        type: 'string',
      },
      credentials: {
        required: true,
        description:
          'Platform credentials (JSON object). Use "gatekit platforms supported" to see required fields for each platform.',
        type: 'object',
      },
      isActive: {
        description: 'Enable platform',
        default: true,
        type: 'boolean',
      },
      testMode: {
        description: 'Enable test mode',
        default: false,
        type: 'boolean',
      },
    },
    examples: [
      {
        description: 'Add Discord bot',
        command:
          'gatekit platforms create --platform discord --credentials \'{"token":"MTExMjIzMzQ0NTU2Njc3ODg5MA.Xx-Xxx.FakeTokenForTestingPurposesOnly123456789"}\'',
      },
      {
        description: 'Add Telegram bot in test mode',
        command:
          'gatekit platforms create --platform telegram --credentials \'{"token":"7654321:AAFmi_SampleTelegramBotTokenHere_abcdefg"}\' --testMode true',
      },
      {
        description: 'Add WhatsApp Evolution API',
        command:
          'gatekit platforms create --platform whatsapp-evo --credentials \'{"evolutionApiUrl":"https://evo.example.com","evolutionApiKey":"your-api-key"}\'',
      },
    ],
  })
  create(
    @Param('projectSlug') projectSlug: string,
    @Body() createPlatformDto: CreatePlatformDto,
  ) {
    return this.platformsService.create(projectSlug, createPlatformDto);
  }

  @Get()
  @RequireScopes('platforms:read')
  @SdkContract({
    command: 'platforms list',
    description: 'List configured platforms for project',
    category: 'Platforms',
    requiredScopes: ['platforms:read'],
    outputType: 'PlatformResponse[]',
    examples: [
      {
        description: 'List all platforms',
        command: 'gatekit platforms list',
      },
    ],
  })
  findAll(@Param('projectSlug') projectSlug: string) {
    return this.platformsService.findAll(projectSlug);
  }

  @Get(':id')
  @RequireScopes('platforms:read')
  @SdkContract({
    command: 'platforms get',
    description: 'Get platform configuration details',
    category: 'Platforms',
    requiredScopes: ['platforms:read'],
    outputType: 'PlatformResponse',
    options: {
      id: { required: true, description: 'Platform ID', type: 'string' },
    },
    examples: [
      {
        description: 'Get platform details',
        command: 'gatekit platforms get --id "platform-123"',
      },
    ],
  })
  findOne(@Param('projectSlug') projectSlug: string, @Param('id') id: string) {
    return this.platformsService.findOne(projectSlug, id);
  }

  @Patch(':id')
  @RequireScopes('platforms:write')
  @SdkContract({
    command: 'platforms update',
    description: 'Update platform configuration',
    category: 'Platforms',
    requiredScopes: ['platforms:write'],
    inputType: 'UpdatePlatformDto',
    outputType: 'PlatformResponse',
    options: {
      credentials: {
        description: 'Updated credentials (JSON object)',
        type: 'object',
      },
      isActive: { description: 'Enable/disable platform', type: 'boolean' },
      testMode: { description: 'Enable/disable test mode', type: 'boolean' },
    },
    examples: [
      {
        description: 'Update Telegram bot token',
        command:
          'gatekit platforms update my-project platform-123 --credentials \'{"token":"7654321:AAFmi_newtoken_here"}\'',
      },
      {
        description: 'Update Discord bot token',
        command:
          'gatekit platforms update my-project platform-456 --credentials \'{"token":"MTA1new.discord.token"}\'',
      },
      {
        description: 'Disable platform',
        command:
          'gatekit platforms update my-project platform-123 --isActive false',
      },
      {
        description: 'Enable test mode',
        command:
          'gatekit platforms update my-project platform-123 --testMode true',
      },
    ],
  })
  update(
    @Param('projectSlug') projectSlug: string,
    @Param('id') id: string,
    @Body() updatePlatformDto: UpdatePlatformDto,
  ) {
    return this.platformsService.update(projectSlug, id, updatePlatformDto);
  }

  @Delete(':id')
  @RequireScopes('platforms:write')
  @SdkContract({
    command: 'platforms delete',
    description: 'Remove platform configuration',
    category: 'Platforms',
    requiredScopes: ['platforms:write'],
    outputType: 'MessageResponse',
    options: {
      id: { required: true, description: 'Platform ID', type: 'string' },
    },
    examples: [
      {
        description: 'Remove platform',
        command: 'gatekit platforms delete --id "platform-123"',
      },
    ],
  })
  remove(@Param('projectSlug') projectSlug: string, @Param('id') id: string) {
    return this.platformsService.remove(projectSlug, id);
  }

  @Post(':id/register-webhook')
  @RequireScopes('platforms:write')
  @SdkContract({
    command: 'platforms register-webhook',
    description: 'Register webhook URL with platform provider',
    category: 'Platforms',
    requiredScopes: ['platforms:write'],
    outputType: 'MessageResponse',
    options: {
      id: { required: true, description: 'Platform ID', type: 'string' },
    },
    examples: [
      {
        description: 'Register Telegram webhook',
        command: 'gatekit platforms register-webhook --id "platform-123"',
      },
    ],
  })
  async registerWebhook(
    @Param('projectSlug') projectSlug: string,
    @Param('id') id: string,
  ) {
    return this.platformsService.registerWebhook(projectSlug, id);
  }

  @Get(':id/qr-code')
  @RequireScopes('platforms:read')
  @SdkContract({
    command: 'platforms qr-code',
    description: 'Get QR code for WhatsApp authentication',
    category: 'Platforms',
    requiredScopes: ['platforms:read'],
    outputType: 'MessageResponse',
    options: {
      id: {
        required: true,
        description: 'WhatsApp Platform ID',
        type: 'string',
      },
    },
    examples: [
      {
        description: 'Get WhatsApp QR code',
        command: 'gatekit platforms qr-code --id "platform-123"',
      },
    ],
  })
  async getQRCode(
    @Param('projectSlug') projectSlug: string,
    @Param('id') id: string,
  ) {
    return this.platformsService.getQRCode(projectSlug, id);
  }
}
