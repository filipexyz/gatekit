import { Injectable } from '@nestjs/common';
import {
  PlatformCredentialValidator,
  CredentialValidationResult,
} from '../interfaces/credential-validator.interface';

interface EmailCredentials {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  fromEmail: string;
  fromName?: string;
}

@Injectable()
export class EmailCredentialsValidator implements PlatformCredentialValidator {
  readonly platform = 'email';

  getRequiredFields(): string[] {
    return [
      'smtpHost',
      'smtpPort',
      'smtpSecure',
      'smtpUser',
      'smtpPassword',
      'fromEmail',
    ];
  }

  getOptionalFields(): string[] {
    return ['fromName'];
  }

  validateCredentials(
    credentials: Record<string, any>,
  ): CredentialValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required fields
    const required = this.getRequiredFields();
    for (const field of required) {
      if (credentials[field] === undefined || credentials[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    if (errors.length > 0) {
      return { isValid: false, errors, warnings };
    }

    const creds = credentials as EmailCredentials;

    // Validate smtpHost
    if (typeof creds.smtpHost !== 'string' || creds.smtpHost.length === 0) {
      errors.push('smtpHost must be a non-empty string');
    }

    // Validate smtpPort
    if (
      typeof creds.smtpPort !== 'number' ||
      creds.smtpPort < 1 ||
      creds.smtpPort > 65535
    ) {
      errors.push('smtpPort must be a number between 1 and 65535');
    }

    // Validate smtpSecure
    if (typeof creds.smtpSecure !== 'boolean') {
      errors.push('smtpSecure must be a boolean');
    }

    // Validate smtpUser
    if (typeof creds.smtpUser !== 'string' || creds.smtpUser.length === 0) {
      errors.push('smtpUser must be a non-empty string');
    }

    // Validate smtpPassword
    if (
      typeof creds.smtpPassword !== 'string' ||
      creds.smtpPassword.length === 0
    ) {
      errors.push('smtpPassword must be a non-empty string');
    }

    // Validate fromEmail format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(creds.fromEmail)) {
      errors.push('fromEmail must be a valid email address');
    }

    // Validate fromName if provided
    if (creds.fromName !== undefined && typeof creds.fromName !== 'string') {
      errors.push('fromName must be a string');
    }

    // Warnings for common mistakes
    if (creds.smtpPort === 465 && !creds.smtpSecure) {
      warnings.push(
        'Port 465 typically requires smtpSecure: true (SSL/TLS from start)',
      );
    }

    if (creds.smtpPort === 587 && creds.smtpSecure) {
      warnings.push(
        'Port 587 typically uses smtpSecure: false (STARTTLS upgrade)',
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  getExampleCredentials(): Record<string, any> {
    return {
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      smtpSecure: false,
      smtpUser: 'your-email@gmail.com',
      smtpPassword: 'your-app-password',
      fromEmail: 'noreply@example.com',
      fromName: 'My Application',
    };
  }
}
