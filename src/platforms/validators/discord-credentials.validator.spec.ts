import { DiscordCredentialsValidator } from './discord-credentials.validator';

describe('DiscordCredentialsValidator', () => {
  let validator: DiscordCredentialsValidator;

  beforeEach(() => {
    validator = new DiscordCredentialsValidator();
  });

  describe('validateCredentials', () => {
    it('should validate correct Discord credentials', () => {
      const validCredentials = {
        token: 'MTExMjIzMzQ0NTU2Njc3ODg5MA.Xx-Xxx.FakeTokenForTestingPurposesOnly123456789',
        clientId: '1014986224337285120',
        intents: ['GuildMessages', 'MessageContent'],
      };

      const result = validator.validateCredentials(validCredentials);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing token', () => {
      const invalidCredentials = {
        clientId: '1014986224337285120',
      };

      const result = validator.validateCredentials(invalidCredentials);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Bot token is required');
    });

    it('should reject invalid token format', () => {
      const invalidCredentials = {
        token: 'invalid-discord-token',
      };

      const result = validator.validateCredentials(invalidCredentials);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid Discord bot token format');
    });

    it('should reject non-string token', () => {
      const invalidCredentials = {
        token: 123456789,
      };

      const result = validator.validateCredentials(invalidCredentials);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Bot token must be a string');
    });

    it('should validate client ID format if provided', () => {
      const credentialsWithInvalidClientId = {
        token: 'MTExMjIzMzQ0NTU2Njc3ODg5MA.Xx-Xxx.FakeTokenForTestingPurposesOnly123456789',
        clientId: 'not-a-valid-id',
      };

      const result = validator.validateCredentials(credentialsWithInvalidClientId);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid Discord client ID format (expected: 17-19 digit snowflake)');
    });

    it('should validate guild ID format if provided', () => {
      const credentialsWithInvalidGuildId = {
        token: 'MTExMjIzMzQ0NTU2Njc3ODg5MA.Xx-Xxx.FakeTokenForTestingPurposesOnly123456789',
        guildId: 'invalid-guild-id',
      };

      const result = validator.validateCredentials(credentialsWithInvalidGuildId);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid Discord guild ID format (expected: 17-19 digit snowflake)');
    });

    it('should validate intents array if provided', () => {
      const credentialsWithInvalidIntents = {
        token: 'MTExMjIzMzQ0NTU2Njc3ODg5MA.Xx-Xxx.FakeTokenForTestingPurposesOnly123456789',
        intents: ['GuildMessages', 'InvalidIntent'],
      };

      const result = validator.validateCredentials(credentialsWithInvalidIntents);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid Discord intents: InvalidIntent');
    });

    it('should accept numeric intents', () => {
      const credentialsWithNumericIntents = {
        token: 'MTExMjIzMzQ0NTU2Njc3ODg5MA.Xx-Xxx.FakeTokenForTestingPurposesOnly123456789',
        intents: 3276800, // GuildMessages + MessageContent
      };

      const result = validator.validateCredentials(credentialsWithNumericIntents);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should warn about test/example tokens', () => {
      const testCredentials = {
        token: 'MTAxNDk4NjIyNDMzNzI4NTEyMA.Gk-J6g.test_token_here_AbCdEfGhIjKlMnOpQr',
      };

      const result = validator.validateCredentials(testCredentials);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('This appears to be a test/example token - ensure you use a real bot token');
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
      expect(optional).toEqual(['clientId', 'guildId', 'intents', 'permissions']);
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