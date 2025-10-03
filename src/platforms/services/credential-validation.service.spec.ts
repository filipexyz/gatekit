import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CredentialValidationService } from './credential-validation.service';
import { TelegramCredentialsValidator } from '../validators/telegram-credentials.validator';
import { DiscordCredentialsValidator } from '../validators/discord-credentials.validator';
import { WhatsAppCredentialsValidator } from '../validators/whatsapp-credentials.validator';
import { EmailCredentialsValidator } from '../validators/email-credentials.validator';

describe('CredentialValidationService', () => {
  let service: CredentialValidationService;
  let telegramValidator: TelegramCredentialsValidator;
  let discordValidator: DiscordCredentialsValidator;
  let whatsappValidator: WhatsAppCredentialsValidator;
  let emailValidator: EmailCredentialsValidator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CredentialValidationService,
        TelegramCredentialsValidator,
        DiscordCredentialsValidator,
        WhatsAppCredentialsValidator,
        EmailCredentialsValidator,
      ],
    }).compile();

    service = module.get<CredentialValidationService>(
      CredentialValidationService,
    );
    telegramValidator = module.get<TelegramCredentialsValidator>(
      TelegramCredentialsValidator,
    );
    discordValidator = module.get<DiscordCredentialsValidator>(
      DiscordCredentialsValidator,
    );
    whatsappValidator = module.get<WhatsAppCredentialsValidator>(
      WhatsAppCredentialsValidator,
    );
  });

  describe('validateAndThrow', () => {
    it('should not throw for valid Telegram credentials', () => {
      const validCredentials = {
        token: '123456789:AbCdEfGhIjKlMnOpQrStUvWxYz123456789',
      };

      expect(() => {
        service.validateAndThrow('telegram', validCredentials);
      }).not.toThrow();
    });

    it('should throw BadRequestException for empty Telegram credentials', () => {
      const invalidCredentials = {
        token: '   ',
      };

      expect(() => {
        service.validateAndThrow('telegram', invalidCredentials);
      }).toThrow(BadRequestException);
    });

    it('should not throw for valid Discord credentials', () => {
      const validCredentials = {
        token:
          'MTExMjIzMzQ0NTU2Njc3ODg5MA.Xx-Xxx.FakeTokenForTestingPurposesOnly123456789',
      };

      expect(() => {
        service.validateAndThrow('discord', validCredentials);
      }).not.toThrow();
    });

    it('should throw BadRequestException for empty Discord credentials', () => {
      const invalidCredentials = {
        token: '   ',
      };

      expect(() => {
        service.validateAndThrow('discord', invalidCredentials);
      }).toThrow(BadRequestException);
    });

    it('should throw for unsupported platform', () => {
      const credentials = { token: 'any-token' };

      expect(() => {
        service.validateAndThrow('unsupported-platform', credentials);
      }).toThrow(BadRequestException);
    });
  });

  describe('validate', () => {
    it('should return validation result for Telegram', () => {
      const credentials = {
        token: '123456789:AbCdEfGhIjKlMnOpQrStUvWxYz123456789',
      };

      const result = service.validate('telegram', credentials);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return error for empty credentials', () => {
      const credentials = {
        token: '   ',
      };

      const result = service.validate('telegram', credentials);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle unsupported platform', () => {
      const credentials = { token: 'any-token' };

      const result = service.validate('unsupported', credentials);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'No validator found for platform: unsupported',
      );
    });
  });

  describe('platform metadata methods', () => {
    it('should return Telegram required fields', () => {
      const fields = service.getRequiredFields('telegram');
      expect(fields).toEqual(['token']);
    });

    it('should return Discord required fields', () => {
      const fields = service.getRequiredFields('discord');
      expect(fields).toEqual(['token']);
    });

    it('should return WhatsApp-Evo required fields', () => {
      const fields = service.getRequiredFields('whatsapp-evo');
      expect(fields).toEqual([
        'evolutionApiUrl',
        'evolutionApiKey',
        'instanceName',
      ]);
    });

    it('should return empty array for unsupported platform', () => {
      const fields = service.getRequiredFields('unsupported');
      expect(fields).toEqual([]);
    });

    it('should return Telegram optional fields', () => {
      const fields = service.getOptionalFields('telegram');
      expect(fields).toContain('botUsername');
      expect(fields).toContain('allowedUpdates');
    });

    it('should return Discord optional fields', () => {
      const fields = service.getOptionalFields('discord');
      expect(fields).toContain('clientId');
      expect(fields).toContain('intents');
    });

    it('should return valid example credentials', () => {
      const telegramExample = service.getExampleCredentials('telegram');
      expect(telegramExample).toHaveProperty('token');

      const discordExample = service.getExampleCredentials('discord');
      expect(discordExample).toHaveProperty('token');

      const whatsappExample = service.getExampleCredentials('whatsapp-evo');
      expect(whatsappExample).toHaveProperty('evolutionApiUrl');
      expect(whatsappExample).toHaveProperty('evolutionApiKey');
      expect(whatsappExample).toHaveProperty('instanceName');

      // Examples should pass validation
      expect(service.validate('telegram', telegramExample).isValid).toBe(true);
      expect(service.validate('discord', discordExample).isValid).toBe(true);
      expect(service.validate('whatsapp-evo', whatsappExample).isValid).toBe(
        true,
      );
    });
  });

  describe('getSupportedPlatforms', () => {
    it('should return all supported platforms', () => {
      const platforms = service.getSupportedPlatforms();
      expect(platforms).toContain('telegram');
      expect(platforms).toContain('discord');
      expect(platforms).toContain('whatsapp-evo');
      expect(platforms).toContain('email');
    });
  });

  describe('getValidationSchema', () => {
    it('should return complete validation schema for platform', () => {
      const schema = service.getValidationSchema('telegram');

      expect(schema).toEqual({
        platform: 'telegram',
        required: ['token'],
        optional: ['webhookUrl', 'botUsername', 'allowedUpdates'],
        example: expect.any(Object),
      });
    });

    it('should return null for unsupported platform', () => {
      const schema = service.getValidationSchema('unsupported');
      expect(schema).toBeNull();
    });
  });

  describe('getAllValidationSchemas', () => {
    it('should return schemas for all platforms', () => {
      const schemas = service.getAllValidationSchemas();

      expect(schemas).toHaveLength(4);
      expect(schemas.map((s) => s.platform)).toContain('telegram');
      expect(schemas.map((s) => s.platform)).toContain('discord');
      expect(schemas.map((s) => s.platform)).toContain('whatsapp-evo');
      expect(schemas.map((s) => s.platform)).toContain('email');
    });
  });
});
