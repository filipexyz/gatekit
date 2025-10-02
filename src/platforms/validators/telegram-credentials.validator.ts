import { Injectable } from '@nestjs/common';
import {
  PlatformCredentialValidator,
  CredentialValidationResult,
} from '../interfaces/credential-validator.interface';
import { PlatformType } from '../../common/enums/platform-type.enum';

@Injectable()
export class TelegramCredentialsValidator
  implements PlatformCredentialValidator
{
  readonly platform = PlatformType.TELEGRAM;

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

    // Optional field: webhookUrl
    if (credentials.webhookUrl) {
      if (typeof credentials.webhookUrl !== 'string') {
        errors.push('Webhook URL must be a string');
      } else {
        try {
          new URL(credentials.webhookUrl);
        } catch {
          errors.push('Invalid webhook URL format');
        }
      }
    }

    // Optional field: botUsername
    if (credentials.botUsername) {
      if (typeof credentials.botUsername !== 'string') {
        warnings.push('Bot username should be a string');
      } else if (!credentials.botUsername.endsWith('bot')) {
        warnings.push('Telegram bot usernames typically end with "bot"');
      }
    }

    // Optional field: allowedUpdates
    if (credentials.allowedUpdates) {
      if (!Array.isArray(credentials.allowedUpdates)) {
        errors.push('allowedUpdates must be an array');
      } else {
        const validUpdates = [
          'message',
          'callback_query',
          'inline_query',
          'chosen_inline_result',
          'channel_post',
          'edited_channel_post',
        ];
        const invalidUpdates = credentials.allowedUpdates.filter(
          (update) => !validUpdates.includes(update),
        );
        if (invalidUpdates.length > 0) {
          errors.push(`Invalid update types: ${invalidUpdates.join(', ')}`);
        }
      }
    }

    // Warn about test tokens (only if token is a string)
    if (
      credentials.token &&
      typeof credentials.token === 'string' &&
      credentials.token.startsWith('110201543:')
    ) {
      warnings.push(
        'This appears to be a Telegram test token - ensure you use a real bot token in production',
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
    return ['webhookUrl', 'botUsername', 'allowedUpdates'];
  }

  getExampleCredentials(): Record<string, any> {
    return {
      token: '123456789:AbCdEfGhIjKlMnOpQrStUvWxYz123456789',
      botUsername: 'my_awesome_bot',
      allowedUpdates: ['message', 'callback_query'],
    };
  }
}
