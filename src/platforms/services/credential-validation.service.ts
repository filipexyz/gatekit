import { Injectable, BadRequestException } from '@nestjs/common';
import {
  PlatformCredentialValidator,
  CredentialValidationResult,
} from '../interfaces/credential-validator.interface';
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
    this.validators.set('telegram', this.telegramValidator);
    this.validators.set('discord', this.discordValidator);
    this.validators.set('whatsapp-evo', this.whatsappValidator);
  }

  /**
   * Validates credentials for a specific platform
   * Throws BadRequestException if validation fails
   */
  validateAndThrow(platform: string, credentials: Record<string, any>): void {
    const result = this.validate(platform, credentials);

    if (!result.isValid) {
      const errorMessage = `Invalid ${platform} credentials: ${result.errors.join(', ')}`;
      throw new BadRequestException(errorMessage);
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
