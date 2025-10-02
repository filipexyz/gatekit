import { Injectable } from '@nestjs/common';
import {
  PlatformCredentialValidator,
  CredentialValidationResult,
} from '../interfaces/credential-validator.interface';
import { PlatformType } from '../../common/enums/platform-type.enum';

@Injectable()
export class WhatsAppCredentialsValidator
  implements PlatformCredentialValidator
{
  readonly platform = PlatformType.WHATSAPP_EVO;

  validateCredentials(
    credentials: Record<string, any>,
  ): CredentialValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required field: evolutionApiUrl
    if (!credentials.evolutionApiUrl) {
      errors.push('Evolution API URL is required');
    } else if (typeof credentials.evolutionApiUrl !== 'string') {
      errors.push('Evolution API URL must be a string');
    } else {
      try {
        const url = new URL(credentials.evolutionApiUrl);
        if (!['http:', 'https:'].includes(url.protocol)) {
          errors.push('Evolution API URL must use HTTP or HTTPS protocol');
        }
      } catch {
        errors.push(
          'Invalid Evolution API URL format (e.g., https://evolution.example.com)',
        );
      }
    }

    // Required field: evolutionApiKey
    if (!credentials.evolutionApiKey) {
      errors.push('Evolution API key is required');
    } else if (typeof credentials.evolutionApiKey !== 'string') {
      errors.push('Evolution API key must be a string');
    } else if (credentials.evolutionApiKey.length < 10) {
      warnings.push(
        "Evolution API key seems too short - ensure it's a valid API key",
      );
    }

    // Required field: instanceName
    if (!credentials.instanceName) {
      errors.push('Instance name is required');
    } else if (typeof credentials.instanceName !== 'string') {
      errors.push('Instance name must be a string');
    } else {
      // Validate instance name format (alphanumeric, hyphens, underscores only)
      const instanceNamePattern = /^[a-zA-Z0-9_-]+$/;
      if (!instanceNamePattern.test(credentials.instanceName)) {
        errors.push(
          'Instance name can only contain letters, numbers, hyphens, and underscores',
        );
      }
      if (credentials.instanceName.length > 50) {
        errors.push('Instance name must be 50 characters or less');
      }
    }

    // Optional field: webhookEvents
    if (credentials.webhookEvents) {
      if (!Array.isArray(credentials.webhookEvents)) {
        errors.push('webhookEvents must be an array');
      } else {
        const validEvents = [
          'QRCODE_UPDATED',
          'CONNECTION_UPDATE',
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'MESSAGES_DELETE',
          'SEND_MESSAGE',
          'TYPEBOT_START',
          'TYPEBOT_CHANGE_STATUS',
        ];
        const invalidEvents = credentials.webhookEvents.filter(
          (event) => !validEvents.includes(event),
        );
        if (invalidEvents.length > 0) {
          errors.push(`Invalid webhook events: ${invalidEvents.join(', ')}`);
        }
      }
    }

    // Optional field: qrCodeTimeout
    if (credentials.qrCodeTimeout) {
      if (typeof credentials.qrCodeTimeout !== 'number') {
        errors.push('QR code timeout must be a number (seconds)');
      } else if (
        credentials.qrCodeTimeout < 30 ||
        credentials.qrCodeTimeout > 300
      ) {
        warnings.push(
          'QR code timeout should be between 30-300 seconds for best user experience',
        );
      }
    }

    // Check for common localhost URLs in production
    if (
      credentials.evolutionApiUrl &&
      typeof credentials.evolutionApiUrl === 'string' &&
      (credentials.evolutionApiUrl.includes('localhost') ||
        credentials.evolutionApiUrl.includes('127.0.0.1'))
    ) {
      warnings.push(
        'Using localhost URL - ensure Evolution API is accessible from this server in production',
      );
    }

    // Check for test/demo API keys
    if (
      credentials.evolutionApiKey &&
      typeof credentials.evolutionApiKey === 'string' &&
      (credentials.evolutionApiKey.includes('test') ||
        credentials.evolutionApiKey.includes('demo'))
    ) {
      warnings.push(
        'This appears to be a test/demo API key - ensure you use a production key in live environments',
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  getRequiredFields(): string[] {
    return ['evolutionApiUrl', 'evolutionApiKey', 'instanceName'];
  }

  getOptionalFields(): string[] {
    return ['webhookEvents', 'qrCodeTimeout'];
  }

  getExampleCredentials(): Record<string, any> {
    return {
      evolutionApiUrl: 'https://evolution.example.com',
      evolutionApiKey: 'your-evolution-api-key-here',
      instanceName: 'my-whatsapp-instance',
      webhookEvents: [
        'QRCODE_UPDATED',
        'CONNECTION_UPDATE',
        'MESSAGES_UPSERT',
        'SEND_MESSAGE',
      ],
      qrCodeTimeout: 120,
    };
  }
}
