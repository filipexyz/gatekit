import { WhatsAppCredentialsValidator } from './whatsapp-credentials.validator';

describe('WhatsAppCredentialsValidator', () => {
  let validator: WhatsAppCredentialsValidator;

  beforeEach(() => {
    validator = new WhatsAppCredentialsValidator();
  });

  describe('validateCredentials', () => {
    it('should validate correct WhatsApp credentials', () => {
      const validCredentials = {
        evolutionApiUrl: 'https://evolution.example.com',
        evolutionApiKey: 'valid-api-key-123456',
        instanceName: 'my-whatsapp-instance',
        webhookEvents: [
          'QRCODE_UPDATED',
          'CONNECTION_UPDATE',
          'MESSAGES_UPSERT',
        ],
        qrCodeTimeout: 120,
      };

      const result = validator.validateCredentials(validCredentials);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    describe('evolutionApiUrl validation', () => {
      it('should reject missing Evolution API URL', () => {
        const invalidCredentials = {
          evolutionApiKey: 'valid-key',
          instanceName: 'test-instance',
        };

        const result = validator.validateCredentials(invalidCredentials);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Evolution API URL is required');
      });

      it('should reject non-string Evolution API URL', () => {
        const invalidCredentials = {
          evolutionApiUrl: 12345,
          evolutionApiKey: 'valid-key',
          instanceName: 'test-instance',
        };

        const result = validator.validateCredentials(invalidCredentials);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Evolution API URL must be a string');
      });

      it('should reject invalid URL format', () => {
        const invalidCredentials = {
          evolutionApiUrl: 'not-a-valid-url',
          evolutionApiKey: 'valid-key',
          instanceName: 'test-instance',
        };

        const result = validator.validateCredentials(invalidCredentials);

        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('Invalid Evolution API URL format');
      });

      it('should reject non-HTTP/HTTPS protocols', () => {
        const invalidCredentials = {
          evolutionApiUrl: 'ftp://evolution.example.com',
          evolutionApiKey: 'valid-key',
          instanceName: 'test-instance',
        };

        const result = validator.validateCredentials(invalidCredentials);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'Evolution API URL must use HTTP or HTTPS protocol',
        );
      });

      it('should warn about localhost URLs', () => {
        const localhostCredentials = {
          evolutionApiUrl: 'http://localhost:8080',
          evolutionApiKey: 'valid-key',
          instanceName: 'test-instance',
        };

        const result = validator.validateCredentials(localhostCredentials);

        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain(
          'Using localhost URL - ensure Evolution API is accessible from this server in production',
        );
      });

      it('should warn about 127.0.0.1 URLs', () => {
        const localhostCredentials = {
          evolutionApiUrl: 'http://127.0.0.1:8080',
          evolutionApiKey: 'valid-key',
          instanceName: 'test-instance',
        };

        const result = validator.validateCredentials(localhostCredentials);

        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain(
          'Using localhost URL - ensure Evolution API is accessible from this server in production',
        );
      });
    });

    describe('evolutionApiKey validation', () => {
      it('should reject missing Evolution API key', () => {
        const invalidCredentials = {
          evolutionApiUrl: 'https://evolution.example.com',
          instanceName: 'test-instance',
        };

        const result = validator.validateCredentials(invalidCredentials);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Evolution API key is required');
      });

      it('should reject non-string Evolution API key', () => {
        const invalidCredentials = {
          evolutionApiUrl: 'https://evolution.example.com',
          evolutionApiKey: 12345,
          instanceName: 'test-instance',
        };

        const result = validator.validateCredentials(invalidCredentials);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Evolution API key must be a string');
      });

      it('should warn about short API keys', () => {
        const shortKeyCredentials = {
          evolutionApiUrl: 'https://evolution.example.com',
          evolutionApiKey: 'short',
          instanceName: 'test-instance',
        };

        const result = validator.validateCredentials(shortKeyCredentials);

        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain(
          "Evolution API key seems too short - ensure it's a valid API key",
        );
      });

      it('should warn about test/demo API keys', () => {
        const testKeyCredentials = {
          evolutionApiUrl: 'https://evolution.example.com',
          evolutionApiKey: 'test-api-key-for-demo',
          instanceName: 'test-instance',
        };

        const result = validator.validateCredentials(testKeyCredentials);

        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain(
          'This appears to be a test/demo API key - ensure you use a production key in live environments',
        );
      });
    });

    describe('instanceName validation', () => {
      it('should reject missing instance name', () => {
        const invalidCredentials = {
          evolutionApiUrl: 'https://evolution.example.com',
          evolutionApiKey: 'valid-key',
        };

        const result = validator.validateCredentials(invalidCredentials);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Instance name is required');
      });

      it('should reject non-string instance name', () => {
        const invalidCredentials = {
          evolutionApiUrl: 'https://evolution.example.com',
          evolutionApiKey: 'valid-key',
          instanceName: 12345,
        };

        const result = validator.validateCredentials(invalidCredentials);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Instance name must be a string');
      });

      it('should reject invalid instance name characters', () => {
        const invalidCredentials = {
          evolutionApiUrl: 'https://evolution.example.com',
          evolutionApiKey: 'valid-key',
          instanceName: 'invalid@name!',
        };

        const result = validator.validateCredentials(invalidCredentials);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'Instance name can only contain letters, numbers, hyphens, and underscores',
        );
      });

      it('should reject instance names that are too long', () => {
        const invalidCredentials = {
          evolutionApiUrl: 'https://evolution.example.com',
          evolutionApiKey: 'valid-key',
          instanceName: 'a'.repeat(51), // 51 characters
        };

        const result = validator.validateCredentials(invalidCredentials);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'Instance name must be 50 characters or less',
        );
      });

      it('should accept valid instance names', () => {
        const validNames = [
          'my-instance',
          'my_instance',
          'MyInstance123',
          'instance-name-123_test',
        ];

        validNames.forEach((instanceName) => {
          const credentials = {
            evolutionApiUrl: 'https://evolution.example.com',
            evolutionApiKey: 'valid-key',
            instanceName,
          };

          const result = validator.validateCredentials(credentials);
          expect(result.isValid).toBe(true);
        });
      });
    });

    describe('webhookEvents validation', () => {
      it('should reject non-array webhook events', () => {
        const invalidCredentials = {
          evolutionApiUrl: 'https://evolution.example.com',
          evolutionApiKey: 'valid-key',
          instanceName: 'test-instance',
          webhookEvents: 'not-an-array',
        };

        const result = validator.validateCredentials(invalidCredentials);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('webhookEvents must be an array');
      });

      it('should reject invalid webhook event types', () => {
        const invalidCredentials = {
          evolutionApiUrl: 'https://evolution.example.com',
          evolutionApiKey: 'valid-key',
          instanceName: 'test-instance',
          webhookEvents: ['QRCODE_UPDATED', 'INVALID_EVENT', 'ANOTHER_INVALID'],
        };

        const result = validator.validateCredentials(invalidCredentials);

        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain(
          'Invalid webhook events: INVALID_EVENT, ANOTHER_INVALID',
        );
      });

      it('should accept valid webhook events', () => {
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

        const credentials = {
          evolutionApiUrl: 'https://evolution.example.com',
          evolutionApiKey: 'valid-key',
          instanceName: 'test-instance',
          webhookEvents: validEvents,
        };

        const result = validator.validateCredentials(credentials);
        expect(result.isValid).toBe(true);
      });
    });

    describe('qrCodeTimeout validation', () => {
      it('should reject non-number QR code timeout', () => {
        const invalidCredentials = {
          evolutionApiUrl: 'https://evolution.example.com',
          evolutionApiKey: 'valid-key',
          instanceName: 'test-instance',
          qrCodeTimeout: 'not-a-number',
        };

        const result = validator.validateCredentials(invalidCredentials);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'QR code timeout must be a number (seconds)',
        );
      });

      it('should warn about very short QR code timeout', () => {
        const shortTimeoutCredentials = {
          evolutionApiUrl: 'https://evolution.example.com',
          evolutionApiKey: 'valid-key',
          instanceName: 'test-instance',
          qrCodeTimeout: 10, // Too short
        };

        const result = validator.validateCredentials(shortTimeoutCredentials);

        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain(
          'QR code timeout should be between 30-300 seconds for best user experience',
        );
      });

      it('should warn about very long QR code timeout', () => {
        const longTimeoutCredentials = {
          evolutionApiUrl: 'https://evolution.example.com',
          evolutionApiKey: 'valid-key',
          instanceName: 'test-instance',
          qrCodeTimeout: 600, // Too long
        };

        const result = validator.validateCredentials(longTimeoutCredentials);

        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain(
          'QR code timeout should be between 30-300 seconds for best user experience',
        );
      });

      it('should accept reasonable QR code timeout values', () => {
        const reasonableTimeouts = [30, 60, 120, 180, 300];

        reasonableTimeouts.forEach((qrCodeTimeout) => {
          const credentials = {
            evolutionApiUrl: 'https://evolution.example.com',
            evolutionApiKey: 'valid-api-key-long-enough', // Make sure it's long enough
            instanceName: 'test-instance',
            qrCodeTimeout,
          };

          const result = validator.validateCredentials(credentials);
          expect(result.isValid).toBe(true);
          expect(result.warnings).toBeUndefined();
        });
      });
    });

    describe('getRequiredFields', () => {
      it('should return correct required fields', () => {
        const requiredFields = validator.getRequiredFields();
        expect(requiredFields).toEqual([
          'evolutionApiUrl',
          'evolutionApiKey',
          'instanceName',
        ]);
      });
    });

    describe('getOptionalFields', () => {
      it('should return correct optional fields', () => {
        const optionalFields = validator.getOptionalFields();
        expect(optionalFields).toEqual(['webhookEvents', 'qrCodeTimeout']);
      });
    });

    describe('getExampleCredentials', () => {
      it('should return valid example credentials', () => {
        const exampleCredentials = validator.getExampleCredentials();

        expect(exampleCredentials).toHaveProperty('evolutionApiUrl');
        expect(exampleCredentials).toHaveProperty('evolutionApiKey');
        expect(exampleCredentials).toHaveProperty('instanceName');
        expect(exampleCredentials).toHaveProperty('webhookEvents');
        expect(exampleCredentials).toHaveProperty('qrCodeTimeout');

        // Example should pass validation
        const result = validator.validateCredentials(exampleCredentials);
        expect(result.isValid).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should handle empty credentials object', () => {
        const result = validator.validateCredentials({});

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Evolution API URL is required');
        expect(result.errors).toContain('Evolution API key is required');
        expect(result.errors).toContain('Instance name is required');
      });

      it('should handle null and undefined values', () => {
        const credentialsWithNulls = {
          evolutionApiUrl: null,
          evolutionApiKey: undefined,
          instanceName: null,
          webhookEvents: null,
          qrCodeTimeout: null,
        };

        const result = validator.validateCredentials(credentialsWithNulls);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Evolution API URL is required');
        expect(result.errors).toContain('Evolution API key is required');
        expect(result.errors).toContain('Instance name is required');
      });

      it('should handle mixed valid and invalid fields', () => {
        const mixedCredentials = {
          evolutionApiUrl: 'https://evolution.example.com', // Valid
          evolutionApiKey: 'valid-key', // Valid
          instanceName: 'invalid@name!', // Invalid
          webhookEvents: ['VALID_EVENT', 'INVALID_EVENT'], // Partially invalid
          qrCodeTimeout: 'not-a-number', // Invalid
        };

        const result = validator.validateCredentials(mixedCredentials);

        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(3); // instanceName, webhookEvents, qrCodeTimeout
      });

      it('should handle very long strings without crashing', () => {
        const longString = 'a'.repeat(10000);
        const credentialsWithLongStrings = {
          evolutionApiUrl: `https://${longString}.example.com`,
          evolutionApiKey: longString,
          instanceName: longString,
        };

        // Should not crash
        expect(() =>
          validator.validateCredentials(credentialsWithLongStrings),
        ).not.toThrow();
      });
    });
  });
});
