import { CredentialMaskUtil } from './credential-mask.util';

describe('CredentialMaskUtil', () => {
  describe('maskCredentials', () => {
    it('should mask Discord bot token', () => {
      const credentials = {
        token: 'bot_secret_token_12345',
      };

      const masked = CredentialMaskUtil.maskCredentials(credentials);

      expect(masked).toEqual({
        token: '*****',
      });
    });

    it('should mask Telegram bot token', () => {
      const credentials = {
        token: '123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      };

      const masked = CredentialMaskUtil.maskCredentials(credentials);

      expect(masked).toEqual({
        token: '*****',
      });
    });

    it('should mask WhatsApp Evolution API credentials', () => {
      const credentials = {
        evolutionApiUrl: 'https://evo.example.com',
        evolutionApiKey: 'evo_secret_key_12345',
      };

      const masked = CredentialMaskUtil.maskCredentials(credentials);

      expect(masked).toEqual({
        evolutionApiUrl: '*****',
        evolutionApiKey: '*****',
      });
    });

    it('should mask all credential fields', () => {
      const credentials = {
        token: 'secret_token',
        apiKey: 'secret_api_key',
        secret: 'secret_value',
        password: 'secret_password',
        url: 'https://api.example.com',
      };

      const masked = CredentialMaskUtil.maskCredentials(credentials);

      expect(masked).toEqual({
        token: '*****',
        apiKey: '*****',
        secret: '*****',
        password: '*****',
        url: '*****',
      });
    });

    it('should handle nested objects', () => {
      const credentials = {
        auth: {
          token: 'secret_token',
          userId: 'user123',
        },
        config: {
          apiKey: 'secret_key',
          url: 'https://api.example.com',
        },
      };

      const masked = CredentialMaskUtil.maskCredentials(credentials);

      expect(masked).toEqual({
        auth: {
          token: '*****',
          userId: '*****',
        },
        config: {
          apiKey: '*****',
          url: '*****',
        },
      });
    });

    it('should handle different field name formats', () => {
      const credentials = {
        token: 'secret1',
        api_key: 'secret2',
        clientSecret: 'secret3',
        'webhook-secret': 'secret4',
        normalField: 'normal_value',
      };

      const masked = CredentialMaskUtil.maskCredentials(credentials);

      expect(masked).toEqual({
        token: '*****',
        api_key: '*****',
        clientSecret: '*****',
        'webhook-secret': '*****',
        normalField: '*****',
      });
    });

    it('should handle null and undefined values', () => {
      const credentials = {
        token: null,
        apiKey: undefined,
        secret: '',
        normalField: 'value',
      };

      const masked = CredentialMaskUtil.maskCredentials(credentials);

      expect(masked).toEqual({
        token: '*****',
        apiKey: '*****',
        secret: '*****',
        normalField: '*****',
      });
    });

    it('should handle empty objects', () => {
      const credentials = {};

      const masked = CredentialMaskUtil.maskCredentials(credentials);

      expect(masked).toEqual({});
    });

    it('should handle non-object inputs', () => {
      expect(CredentialMaskUtil.maskCredentials(null)).toBeNull();
      expect(CredentialMaskUtil.maskCredentials(undefined)).toBeUndefined();
      expect(CredentialMaskUtil.maskCredentials('string')).toBe('string');
      expect(CredentialMaskUtil.maskCredentials(123)).toBe(123);
    });

    it('should not modify the original object', () => {
      const credentials = {
        token: 'secret_token',
        normalField: 'normal_value',
      };

      const original = { ...credentials };
      const masked = CredentialMaskUtil.maskCredentials(credentials);

      expect(credentials).toEqual(original);
      expect(masked).not.toBe(credentials);
    });

    it('should mask all fields regardless of case', () => {
      const credentials = {
        TOKEN: 'secret1',
        ApiKey: 'secret2',
        EVOLUTION_API_KEY: 'secret3',
        normalField: 'normal_value',
      };

      const masked = CredentialMaskUtil.maskCredentials(credentials);

      expect(masked).toEqual({
        TOKEN: '*****',
        ApiKey: '*****',
        EVOLUTION_API_KEY: '*****',
        normalField: '*****',
      });
    });
  });
});
