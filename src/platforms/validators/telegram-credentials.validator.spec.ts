import { TelegramCredentialsValidator } from './telegram-credentials.validator';

describe('TelegramCredentialsValidator', () => {
  let validator: TelegramCredentialsValidator;

  beforeEach(() => {
    validator = new TelegramCredentialsValidator();
  });

  describe('validateCredentials', () => {
    it('should validate correct Telegram credentials', () => {
      const validCredentials = {
        token: '123456789:AbCdEfGhIjKlMnOpQrStUvWxYz123456789',
        botUsername: 'my_awesome_bot',
        allowedUpdates: ['message', 'callback_query'],
      };

      const result = validator.validateCredentials(validCredentials);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing token', () => {
      const invalidCredentials = {
        botUsername: 'my_bot',
      };

      const result = validator.validateCredentials(invalidCredentials);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Bot token is required');
    });

    it('should accept any non-empty token', () => {
      const validCredentials = {
        token: 'any-token',
      };

      const result = validator.validateCredentials(validCredentials);

      expect(result.isValid).toBe(true);
    });

    it('should reject non-string token', () => {
      const invalidCredentials = {
        token: 123456789,
      };

      const result = validator.validateCredentials(invalidCredentials);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Bot token must be a string');
    });

    it('should validate webhook URL if provided', () => {
      const credentialsWithInvalidUrl = {
        token: '123456789:AbCdEfGhIjKlMnOpQrStUvWxYz123456789',
        webhookUrl: 'not-a-valid-url',
      };

      const result = validator.validateCredentials(credentialsWithInvalidUrl);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid webhook URL format');
    });

    it('should validate allowed updates if provided', () => {
      const credentialsWithInvalidUpdates = {
        token: '123456789:AbCdEfGhIjKlMnOpQrStUvWxYz123456789',
        allowedUpdates: ['message', 'invalid_update_type'],
      };

      const result = validator.validateCredentials(
        credentialsWithInvalidUpdates,
      );

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain(
        'Invalid update types: invalid_update_type',
      );
    });

    it('should warn about test tokens', () => {
      const testCredentials = {
        token: '110201543:AAFmi_test_token_AbCdEfGhIjKlMnOpQr',
      };

      const result = validator.validateCredentials(testCredentials);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'This appears to be a Telegram test token - ensure you use a real bot token in production',
      );
    });

    it('should warn about bot username not ending with bot', () => {
      const credentialsWithWeirdUsername = {
        token: '123456789:AbCdEfGhIjKlMnOpQrStUvWxYz123456789',
        botUsername: 'my_awesome_service',
      };

      const result = validator.validateCredentials(
        credentialsWithWeirdUsername,
      );

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'Telegram bot usernames typically end with "bot"',
      );
    });
  });

  describe('getRequiredFields', () => {
    it('should return required fields', () => {
      const required = validator.getRequiredFields();
      expect(required).toEqual(['token']);
    });
  });

  describe('getOptionalFields', () => {
    it('should return optional fields', () => {
      const optional = validator.getOptionalFields();
      expect(optional).toEqual(['webhookUrl', 'botUsername', 'allowedUpdates']);
    });
  });

  describe('getExampleCredentials', () => {
    it('should return valid example credentials', () => {
      const example = validator.getExampleCredentials();

      expect(example).toHaveProperty('token');
      expect(typeof example.token).toBe('string');

      // Test the example against the validator
      const validationResult = validator.validateCredentials(example);
      expect(validationResult.isValid).toBe(true);
    });
  });
});
