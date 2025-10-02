import { Injectable, BadRequestException } from '@nestjs/common';
import {
  PlatformCredentialValidator,
  CredentialValidationResult,
} from '../interfaces/credential-validator.interface';
import { PlatformType } from '../../common/enums/platform-type.enum';
import { TelegramCredentialsValidator } from '../validators/telegram-credentials.validator';
import { DiscordCredentialsValidator } from '../validators/discord-credentials.validator';
import { WhatsAppCredentialsValidator } from '../validators/whatsapp-credentials.validator';

@Injectable()
export class CredentialValidationService {
  private readonly validators = new Map<string, PlatformCredentialValidator>();

  constructor(
    private readonly telegramValidator: TelegramCredentialsValidator,
    private readonly discordValidator: DiscordCredentialsValidator,
    private readonly whatsappValidator: WhatsAppCredentialsValidator,
  ) {
    // Register platform validators
    this.validators.set(PlatformType.TELEGRAM, this.telegramValidator);
    this.validators.set(PlatformType.DISCORD, this.discordValidator);
    this.validators.set(PlatformType.WHATSAPP_EVO, this.whatsappValidator);
  }

  /**
   * Validates credentials for a specific platform
   * Throws BadRequestException if validation fails
   */
  validateAndThrow(platform: string, credentials: Record<string, any>): void {
    const result = this.validate(platform, credentials);

    if (!result.isValid) {
      const validator = this.validators.get(platform.toLowerCase());
      const required = validator?.getRequiredFields() || [];
      const optional = validator?.getOptionalFields() || [];

      const errorMessage = `Invalid ${platform} credentials: ${result.errors.join(', ')}`;
      const helpMessage =
        required.length > 0
          ? `\n\nRequired fields: ${required.join(', ')}` +
            (optional.length > 0
              ? `\nOptional fields: ${optional.join(', ')}`
              : '')
          : '';

      throw new BadRequestException(errorMessage + helpMessage);
    }

    // Log warnings if any
    if (result.warnings && result.warnings.length > 0) {
      console.warn(
        `[${platform.toUpperCase()}] Credential warnings: ${result.warnings.join(', ')}`,
      );
    }
  }

  /**
   * Validates credentials for a specific platform
   * Returns validation result without throwing
   */
  validate(
    platform: string,
    credentials: Record<string, any>,
  ): CredentialValidationResult {
    const validator = this.validators.get(platform.toLowerCase());

    if (!validator) {
      return {
        isValid: false,
        errors: [`No validator found for platform: ${platform}`],
      };
    }

    return validator.validateCredentials(credentials);
  }

  /**
   * Gets required fields for a platform
   */
  getRequiredFields(platform: string): string[] {
    const validator = this.validators.get(platform.toLowerCase());
    return validator?.getRequiredFields() || [];
  }

  /**
   * Gets optional fields for a platform
   */
  getOptionalFields(platform: string): string[] {
    const validator = this.validators.get(platform.toLowerCase());
    return validator?.getOptionalFields() || [];
  }

  /**
   * Gets example credentials for a platform
   */
  getExampleCredentials(platform: string): Record<string, any> {
    const validator = this.validators.get(platform.toLowerCase());
    return validator?.getExampleCredentials() || {};
  }

  /**
   * Gets all supported platforms
   */
  getSupportedPlatforms(): string[] {
    return Array.from(this.validators.keys());
  }

  /**
   * Gets validation schema for API documentation
   */
  getValidationSchema(platform: string) {
    const validator = this.validators.get(platform.toLowerCase());
    if (!validator) {
      return null;
    }

    return {
      platform,
      required: validator.getRequiredFields(),
      optional: validator.getOptionalFields(),
      example: validator.getExampleCredentials(),
    };
  }

  /**
   * Gets validation schemas for all platforms
   */
  getAllValidationSchemas() {
    return Array.from(this.validators.keys()).map((platform) =>
      this.getValidationSchema(platform),
    );
  }
}
