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

  describe('EmbedDto validation', () => {
    it('should accept valid embed with all fields', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          text: 'Check this embed',
          embeds: [
            {
              author: {
                name: 'Test Author',
                url: 'https://example.com/author',
                iconUrl: 'https://example.com/icon.png',
              },
              title: 'Embed Title',
              url: 'https://example.com/embed',
              description: 'This is a description',
              color: '#FF5733',
              imageUrl: 'https://example.com/image.png',
              thumbnailUrl: 'https://example.com/thumb.png',
              fields: [
                {
                  name: 'Field 1',
                  value: 'Value 1',
                  inline: true,
                },
                {
                  name: 'Field 2',
                  value: 'Value 2',
                  inline: false,
                },
              ],
              footer: {
                text: 'Footer text',
                iconUrl: 'https://example.com/footer-icon.png',
              },
              timestamp: '2025-09-30T20:00:00.000Z',
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept embed with minimal fields', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          embeds: [
            {
              title: 'Simple embed',
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject embed with invalid author URL', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          embeds: [
            {
              author: {
                name: 'Test',
                url: 'not-a-valid-url',
              },
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject embed with invalid icon URL', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          embeds: [
            {
              author: {
                name: 'Test',
                iconUrl: 'ftp://invalid-protocol.com/icon.png',
              },
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject embed with invalid timestamp', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          embeds: [
            {
              title: 'Test',
              timestamp: 'not-a-date',
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should accept embed with 25 fields (Discord limit)', async () => {
      const fields = Array.from({ length: 25 }, (_, i) => ({
        name: `Field ${i + 1}`,
        value: `Value ${i + 1}`,
        inline: i % 2 === 0,
      }));

      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          embeds: [
            {
              title: 'Many fields',
              fields,
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept embed with more than 25 fields (validation at provider level)', async () => {
      const fields = Array.from({ length: 30 }, (_, i) => ({
        name: `Field ${i + 1}`,
        value: `Value ${i + 1}`,
      }));

      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          embeds: [
            {
              title: 'Too many fields',
              fields,
            },
          ],
        },
      });

      const errors = await validate(dto);
      // DTO validation passes, provider will truncate
      expect(errors).toHaveLength(0);
    });

    it('should accept multiple embeds', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          embeds: [
            {
              title: 'Embed 1',
              description: 'First embed',
            },
            {
              title: 'Embed 2',
              description: 'Second embed',
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept embed with empty fields array', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          embeds: [
            {
              title: 'No fields',
              fields: [],
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject embed field without name', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          embeds: [
            {
              title: 'Invalid field',
              fields: [
                {
                  value: 'Value without name',
                },
              ],
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject embed field without value', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          embeds: [
            {
              title: 'Invalid field',
              fields: [
                {
                  name: 'Name without value',
                },
              ],
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should accept message with text, attachments, and embeds', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          text: 'Check this out!',
          attachments: [
            {
              url: 'https://example.com/file.pdf',
            },
          ],
          embeds: [
            {
              title: 'Embed Title',
              description: 'Embed description',
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject footer without text', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          embeds: [
            {
              title: 'Test',
              footer: {
                iconUrl: 'https://example.com/icon.png',
              },
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject author without name', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          embeds: [
            {
              title: 'Test',
              author: {
                url: 'https://example.com',
              },
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('ButtonDto validation', () => {
    it('should accept button with value', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          text: 'Choose an action',
          buttons: [
            {
              text: 'Confirm',
              value: 'confirm_action',
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept button with url', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          text: 'Visit our website',
          buttons: [
            {
              text: 'Visit GateKit',
              url: 'https://gatekit.dev',
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept button with value and style', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          text: 'Confirm action',
          buttons: [
            {
              text: 'Confirm',
              value: 'confirm',
              style: 'success',
            },
            {
              text: 'Cancel',
              value: 'cancel',
              style: 'danger',
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept button with url and style', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          buttons: [
            {
              text: 'Visit Website',
              url: 'https://example.com',
              style: 'link',
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept all button styles', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          buttons: [
            { text: 'Primary', value: 'primary', style: 'primary' },
            { text: 'Secondary', value: 'secondary', style: 'secondary' },
            { text: 'Success', value: 'success', style: 'success' },
            { text: 'Danger', value: 'danger', style: 'danger' },
            { text: 'Link', url: 'https://example.com', style: 'link' },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject button with invalid style', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          buttons: [
            {
              text: 'Button',
              value: 'action',
              style: 'invalid-style' as any,
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject button with invalid url protocol', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          buttons: [
            {
              text: 'Invalid URL',
              url: 'ftp://invalid.com',
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject button with http url (must be https)', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          buttons: [
            {
              text: 'Insecure',
              url: 'http://example.com',
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject button without text', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          buttons: [
            {
              value: 'action',
            } as any,
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject button with neither value nor url', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          buttons: [
            {
              text: 'Invalid Button',
              style: 'primary',
            } as any,
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should accept button with both value and url (either is valid)', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          buttons: [
            {
              text: 'Button',
              value: 'action',
              url: 'https://example.com',
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept multiple buttons', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          text: 'Choose an action',
          buttons: [
            { text: 'Confirm', value: 'confirm', style: 'success' },
            { text: 'Cancel', value: 'cancel', style: 'danger' },
            { text: 'Help', url: 'https://help.example.com', style: 'link' },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept message with text, attachments, embeds, and buttons', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          text: 'Complete message',
          attachments: [
            {
              url: 'https://example.com/file.pdf',
            },
          ],
          embeds: [
            {
              title: 'Embed Title',
              description: 'Description',
            },
          ],
          buttons: [
            {
              text: 'Download',
              value: 'download',
              style: 'primary',
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept button-only message', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          buttons: [
            { text: 'Option A', value: 'a' },
            { text: 'Option B', value: 'b' },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept empty buttons array', async () => {
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
          buttons: [],
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should handle unicode in button text', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          buttons: [
            {
              text: '✅ Confirm',
              value: 'confirm',
            },
            {
              text: '❌ Cancel',
              value: 'cancel',
            },
            {
              text: '📚 Documentation',
              url: 'https://docs.example.com',
            },
          ],
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept very long button text', async () => {
      const dto = plainToClass(SendMessageDto, {
        targets: [
          {
            platformId: 'platform-123',
            type: 'channel',
            id: 'channel-456',
          },
        ],
        content: {
          buttons: [
            {
              text: 'a'.repeat(500),
              value: 'action',
            },
          ],
        },
      });

      const errors = await validate(dto);
      // Should validate - platform providers will handle truncation
      expect(errors).toHaveLength(0);
    });
  });
});
