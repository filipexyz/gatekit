import { Injectable } from '@nestjs/common';
import {
  PlatformCredentialValidator,
  CredentialValidationResult,
} from '../interfaces/credential-validator.interface';
import { PlatformType } from '../../common/enums/platform-type.enum';

@Injectable()
export class DiscordCredentialsValidator
  implements PlatformCredentialValidator
{
  readonly platform = PlatformType.DISCORD;

  validateCredentials(
    credentials: Record<string, any>,
  ): CredentialValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required field: token
    if (!credentials.token) {
      errors.push('Bot token is required');
    } else if (typeof credentials.token !== 'string') {
      errors.push('Bot token must be a string');
    } else {
      // Basic string validation - just ensure it's not empty
      if (credentials.token.trim().length === 0) {
        errors.push('Bot token cannot be empty');
      }
    }

    // Optional field: intents
    if (credentials.intents) {
      if (
        !Array.isArray(credentials.intents) &&
        typeof credentials.intents !== 'number'
      ) {
        errors.push(
          'Intents must be an array of intent names or a numeric bitmask',
        );
      } else if (Array.isArray(credentials.intents)) {
        const validIntents = [
          'Guilds',
          'GuildMembers',
          'GuildBans',
          'GuildEmojisAndStickers',
          'GuildIntegrations',
          'GuildWebhooks',
          'GuildInvites',
          'GuildVoiceStates',
          'GuildPresences',
          'GuildMessages',
          'GuildMessageReactions',
          'GuildMessageTyping',
          'DirectMessages',
          'DirectMessageReactions',
          'DirectMessageTyping',
          'MessageContent',
          'GuildScheduledEvents',
          'AutoModerationConfiguration',
          'AutoModerationExecution',
        ];
        const invalidIntents = credentials.intents.filter(
          (intent) => !validIntents.includes(intent),
        );
        if (invalidIntents.length > 0) {
          errors.push(`Invalid Discord intents: ${invalidIntents.join(', ')}`);
        }
      }
    }

    // Optional field: clientId
    if (credentials.clientId) {
      if (typeof credentials.clientId !== 'string') {
        errors.push('Client ID must be a string');
      } else if (!/^\d{17,19}$/.test(credentials.clientId)) {
        errors.push(
          'Invalid Discord client ID format (expected: 17-19 digit snowflake)',
        );
      }
    }

    // Optional field: guildId
    if (credentials.guildId) {
      if (typeof credentials.guildId !== 'string') {
        errors.push('Guild ID must be a string');
      } else if (!/^\d{17,19}$/.test(credentials.guildId)) {
        errors.push(
          'Invalid Discord guild ID format (expected: 17-19 digit snowflake)',
        );
      }
    }

    // Optional field: permissions
    if (credentials.permissions) {
      if (
        typeof credentials.permissions !== 'number' &&
        typeof credentials.permissions !== 'string'
      ) {
        errors.push('Permissions must be a number (bitmask) or string');
      }
    }

    // Warn about test tokens (only if token is a string)
    if (
      credentials.token &&
      typeof credentials.token === 'string' &&
      (credentials.token.includes('test') ||
        credentials.token.includes('example'))
    ) {
      warnings.push(
        'This appears to be a test/example token - ensure you use a real bot token',
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  getRequiredFields(): string[] {
    return ['token'];
  }

  getOptionalFields(): string[] {
    return ['clientId', 'guildId', 'intents', 'permissions'];
  }

  getExampleCredentials(): Record<string, any> {
    return {
      token:
        'MTExMjIzMzQ0NTU2Njc3ODg5MA.Xx-Xxx.FakeTokenForTestingPurposesOnly123456789',
      clientId: '1014986224337285120',
      intents: ['GuildMessages', 'MessageContent'],
      permissions: '8',
    };
  }
}
