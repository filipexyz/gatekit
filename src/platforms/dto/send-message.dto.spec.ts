import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { SendMessageDto } from './send-message.dto';

describe('SendMessageDto - Attachment Validation', () => {
  describe('AttachmentDto validation', () => {
    it('should accept valid URL attachment', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          text: 'Check this out',
          attachments: [
            {
              url: 'https://example.com/file.png',
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept valid base64 attachment', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          text: 'Check this out',
          attachments: [
            {
              data: Buffer.from('test data').toString('base64'),
              filename: 'test.txt',
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept URL attachment with all optional fields', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          attachments: [
            {
              url: 'https://example.com/image.png',
              filename: 'screenshot.png',
              mimeType: 'image/png',
              caption: 'This is a screenshot',
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept data URI format', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          attachments: [
            {
              data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject URL with invalid protocol', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          attachments: [
            {
              url: 'ftp://example.com/file.txt',
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      // URL validation happens at runtime via AttachmentUtil, not at DTO validation level
    });

    it('should reject invalid URL format', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          attachments: [
            {
              url: 'not-a-valid-url',
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should accept multiple attachments', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          text: 'Multiple files',
          attachments: [
            {
              url: 'https://example.com/file1.png',
            },
            {
              url: 'https://example.com/file2.pdf',
            },
            {
              data: Buffer.from('test').toString('base64'),
              filename: 'test.txt',
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept empty attachments array', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          text: 'Just text',
          attachments: [],
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept message without attachments field', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          text: 'Just text',
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept attachment with caption only', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          attachments: [
            {
              url: 'https://example.com/image.png',
              caption: 'This is the caption',
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept attachment with mimeType only', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          attachments: [
            {
              url: 'https://example.com/file',
              mimeType: 'application/pdf',
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject attachment with neither url nor data', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          attachments: [
            {
              filename: 'test.txt',
              mimeType: 'text/plain',
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      // Should fail validation because neither url nor data is present
    });

    it('should accept attachment with both url and data (url takes precedence)', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          attachments: [
            {
              url: 'https://example.com/file.png',
              data: Buffer.from('test').toString('base64'),
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Complete message validation with attachments', () => {
    it('should validate complete message with all features', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          text: 'Check out these files!',
          attachments: [
            {
              url: 'https://example.com/report.pdf',
              filename: 'quarterly-report.pdf',
              mimeType: 'application/pdf',
              caption: 'Q4 Report',
            },
          ],
          buttons: [
            {
              text: 'Download',
              value: 'download',
            },
          ],
        },
        options: {
          silent: true,
        },
        metadata: {
          trackingId: 'msg-12345',
          tags: ['important', 'quarterly'],
          priority: 'high',
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate attachment-only message', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'user',
            id: 'user-789',
          },
        ],
        content: {
          attachments: [
            {
              url: 'https://example.com/image.jpg',
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should allow empty targets array (validation happens at service level)', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [], // Empty targets - service level validation will handle this
        content: {
          attachments: [
            {
              url: 'https://example.com/file.png',
            },
          ],
        },
      });

      const errors = await validate(dto);
      // DTO validation passes, but service will reject empty targets
      expect(errors).toHaveLength(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle very long filenames', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          attachments: [
            {
              url: 'https://example.com/file.png',
              filename: 'a'.repeat(500),
            },
          ],
        },
      });

      const errors = await validate(dto);
      // Should still validate - no length restriction on filename
      expect(errors).toHaveLength(0);
    });

    it('should handle special characters in filenames', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          attachments: [
            {
              url: 'https://example.com/file.png',
              filename: 'my file (2024) [final].png',
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should handle unicode in captions', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          attachments: [
            {
              url: 'https://example.com/image.png',
              caption: '🎉 Celebration! 日本語 العربية',
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should handle empty strings in optional fields', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          attachments: [
            {
              url: 'https://example.com/file.png',
              filename: '',
              mimeType: '',
              caption: '',
            },
          ],
        },
      });

      const errors = await validate(dto);
      // Empty strings should still validate as they're technically strings
      expect(errors).toHaveLength(0);
    });
  });
});
