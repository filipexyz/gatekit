import { BadRequestException } from '@nestjs/common';
import { AttachmentUtil } from './attachment.util';

describe('AttachmentUtil', () => {
  describe('validateAttachmentUrl', () => {
    it('should allow valid HTTPS URLs', async () => {
      await expect(
        AttachmentUtil.validateAttachmentUrl('https://example.com/file.png'),
      ).resolves.not.toThrow();
    });

    it('should allow valid HTTP URLs', async () => {
      await expect(
        AttachmentUtil.validateAttachmentUrl('http://example.com/file.png'),
      ).resolves.not.toThrow();
    });

    it('should reject URLs with invalid protocol', async () => {
      await expect(
        AttachmentUtil.validateAttachmentUrl('ftp://example.com/file.png'),
      ).rejects.toThrow(
        new BadRequestException(
          'Only HTTP and HTTPS protocols are allowed for attachment URL',
        ),
      );
    });

    it('should reject file:// protocol', async () => {
      await expect(
        AttachmentUtil.validateAttachmentUrl('file:///etc/passwd'),
      ).rejects.toThrow(
        new BadRequestException(
          'Only HTTP and HTTPS protocols are allowed for attachment URL',
        ),
      );
    });

    it('should reject localhost URLs', async () => {
      await expect(
        AttachmentUtil.validateAttachmentUrl('http://localhost/file.png'),
      ).rejects.toThrow(
        new BadRequestException(
          'Localhost and loopback addresses are not allowed',
        ),
      );
    });

    it('should reject 127.0.0.1 loopback', async () => {
      await expect(
        AttachmentUtil.validateAttachmentUrl('http://127.0.0.1/file.png'),
      ).rejects.toThrow(
        new BadRequestException(
          'Localhost and loopback addresses are not allowed',
        ),
      );
    });

    it('should reject 0.0.0.0 address', async () => {
      await expect(
        AttachmentUtil.validateAttachmentUrl('http://0.0.0.0/file.png'),
      ).rejects.toThrow(
        new BadRequestException(
          'Localhost and loopback addresses are not allowed',
        ),
      );
    });

    it('should reject IPv6 loopback', async () => {
      await expect(
        AttachmentUtil.validateAttachmentUrl('http://[::1]/file.png'),
      ).rejects.toThrow(
        new BadRequestException(
          'Localhost and loopback addresses are not allowed',
        ),
      );
    });

    it('should reject private IP range 10.x.x.x', async () => {
      await expect(
        AttachmentUtil.validateAttachmentUrl('http://10.0.0.1/file.png'),
      ).rejects.toThrow(
        new BadRequestException('Private IP addresses are not allowed'),
      );
    });

    it('should reject private IP range 192.168.x.x', async () => {
      await expect(
        AttachmentUtil.validateAttachmentUrl('http://192.168.1.1/file.png'),
      ).rejects.toThrow(
        new BadRequestException('Private IP addresses are not allowed'),
      );
    });

    it('should reject private IP range 172.16-31.x.x', async () => {
      await expect(
        AttachmentUtil.validateAttachmentUrl('http://172.16.0.1/file.png'),
      ).rejects.toThrow(
        new BadRequestException('Private IP addresses are not allowed'),
      );

      await expect(
        AttachmentUtil.validateAttachmentUrl('http://172.31.255.255/file.png'),
      ).rejects.toThrow(
        new BadRequestException('Private IP addresses are not allowed'),
      );
    });

    it('should allow 172.x.x.x outside private range', async () => {
      await expect(
        AttachmentUtil.validateAttachmentUrl('http://172.15.0.1/file.png'),
      ).resolves.not.toThrow();

      await expect(
        AttachmentUtil.validateAttachmentUrl('http://172.32.0.1/file.png'),
      ).resolves.not.toThrow();
    });

    it('should reject AWS metadata endpoint', async () => {
      await expect(
        AttachmentUtil.validateAttachmentUrl(
          'http://169.254.169.254/latest/meta-data/',
        ),
      ).rejects.toThrow(
        new BadRequestException('Cloud metadata endpoints are not allowed'),
      );
    });

    it('should reject GCP metadata endpoint', async () => {
      await expect(
        AttachmentUtil.validateAttachmentUrl(
          'http://metadata.google.internal/computeMetadata/v1/',
        ),
      ).rejects.toThrow(
        new BadRequestException('Cloud metadata endpoints are not allowed'),
      );
    });

    it('should reject Azure metadata endpoint', async () => {
      await expect(
        AttachmentUtil.validateAttachmentUrl(
          'http://100.100.100.200/metadata/instance',
        ),
      ).rejects.toThrow(
        new BadRequestException('Cloud metadata endpoints are not allowed'),
      );
    });

    it('should reject invalid URL format', async () => {
      await expect(
        AttachmentUtil.validateAttachmentUrl('not-a-valid-url'),
      ).rejects.toThrow(
        new BadRequestException('Invalid attachment URL format'),
      );
    });

    it('should reject .localhost subdomain', async () => {
      await expect(
        AttachmentUtil.validateAttachmentUrl('http://test.localhost/file.png'),
      ).rejects.toThrow(
        new BadRequestException(
          'Localhost and loopback addresses are not allowed',
        ),
      );
    });
  });

  describe('validateBase64Data', () => {
    it('should accept valid base64 string', () => {
      const validBase64 = Buffer.from('test data').toString('base64');
      expect(() =>
        AttachmentUtil.validateBase64Data(validBase64),
      ).not.toThrow();
    });

    it('should accept base64 with data URI prefix', () => {
      const validBase64 =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      expect(() =>
        AttachmentUtil.validateBase64Data(validBase64),
      ).not.toThrow();
    });

    it('should reject invalid base64 format', () => {
      expect(() =>
        AttachmentUtil.validateBase64Data('not@valid#base64!'),
      ).toThrow(new BadRequestException('Invalid base64 format'));
    });

    it('should reject data exceeding size limit', () => {
      // Create a base64 string larger than 1MB
      const largeData = Buffer.alloc(2 * 1024 * 1024).toString('base64');
      expect(() =>
        AttachmentUtil.validateBase64Data(largeData, 1 * 1024 * 1024),
      ).toThrow(
        new BadRequestException(
          'Attachment size exceeds maximum allowed size of 1MB',
        ),
      );
    });

    it('should accept data within size limit', () => {
      const smallData = Buffer.alloc(100 * 1024).toString('base64'); // 100KB
      expect(() =>
        AttachmentUtil.validateBase64Data(smallData, 1 * 1024 * 1024),
      ).not.toThrow();
    });

    it('should use default 25MB limit', () => {
      const data = Buffer.alloc(1 * 1024 * 1024).toString('base64'); // 1MB
      expect(() => AttachmentUtil.validateBase64Data(data)).not.toThrow();
    });
  });

  describe('detectMimeType', () => {
    it('should use provided MIME type when valid', () => {
      const result = AttachmentUtil.detectMimeType({
        providedMimeType: 'image/png',
      });
      expect(result).toBe('image/png');
    });

    it('should extract MIME type from data URI', () => {
      const result = AttachmentUtil.detectMimeType({
        data: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
      });
      expect(result).toBe('image/jpeg');
    });

    it('should detect MIME type from filename extension', () => {
      const result = AttachmentUtil.detectMimeType({
        filename: 'document.pdf',
      });
      expect(result).toBe('application/pdf');
    });

    it('should detect MIME type from URL extension', () => {
      const result = AttachmentUtil.detectMimeType({
        url: 'https://example.com/image.png',
      });
      expect(result).toBe('image/png');
    });

    it('should prioritize provided MIME type over detection', () => {
      const result = AttachmentUtil.detectMimeType({
        url: 'https://example.com/image.png',
        filename: 'file.jpg',
        providedMimeType: 'image/webp',
      });
      expect(result).toBe('image/webp');
    });

    it('should detect common image formats', () => {
      expect(AttachmentUtil.detectMimeType({ filename: 'file.jpg' })).toBe(
        'image/jpeg',
      );
      expect(AttachmentUtil.detectMimeType({ filename: 'file.jpeg' })).toBe(
        'image/jpeg',
      );
      expect(AttachmentUtil.detectMimeType({ filename: 'file.png' })).toBe(
        'image/png',
      );
      expect(AttachmentUtil.detectMimeType({ filename: 'file.gif' })).toBe(
        'image/gif',
      );
      expect(AttachmentUtil.detectMimeType({ filename: 'file.webp' })).toBe(
        'image/webp',
      );
    });

    it('should detect video formats', () => {
      expect(AttachmentUtil.detectMimeType({ filename: 'file.mp4' })).toBe(
        'video/mp4',
      );
      expect(AttachmentUtil.detectMimeType({ filename: 'file.webm' })).toBe(
        'video/webm',
      );
      expect(AttachmentUtil.detectMimeType({ filename: 'file.mov' })).toBe(
        'video/quicktime',
      );
    });

    it('should detect audio formats', () => {
      expect(AttachmentUtil.detectMimeType({ filename: 'file.mp3' })).toBe(
        'audio/mpeg',
      );
      expect(AttachmentUtil.detectMimeType({ filename: 'file.wav' })).toBe(
        'audio/wav',
      );
      expect(AttachmentUtil.detectMimeType({ filename: 'file.ogg' })).toBe(
        'audio/ogg',
      );
    });

    it('should detect document formats', () => {
      expect(AttachmentUtil.detectMimeType({ filename: 'file.pdf' })).toBe(
        'application/pdf',
      );
      expect(AttachmentUtil.detectMimeType({ filename: 'file.doc' })).toBe(
        'application/msword',
      );
      expect(AttachmentUtil.detectMimeType({ filename: 'file.docx' })).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      expect(AttachmentUtil.detectMimeType({ filename: 'file.txt' })).toBe(
        'text/plain',
      );
      expect(AttachmentUtil.detectMimeType({ filename: 'file.zip' })).toBe(
        'application/zip',
      );
    });

    it('should return generic type for unknown extension', () => {
      const result = AttachmentUtil.detectMimeType({
        filename: 'file.unknown',
      });
      expect(result).toBe('application/octet-stream');
    });

    it('should return generic type when no info provided', () => {
      const result = AttachmentUtil.detectMimeType({});
      expect(result).toBe('application/octet-stream');
    });

    it('should be case insensitive for extensions', () => {
      expect(AttachmentUtil.detectMimeType({ filename: 'file.PNG' })).toBe(
        'image/png',
      );
      expect(AttachmentUtil.detectMimeType({ filename: 'file.PDF' })).toBe(
        'application/pdf',
      );
    });

    it('should ignore invalid MIME type format', () => {
      const result = AttachmentUtil.detectMimeType({
        filename: 'file.png',
        providedMimeType: 'invalid-mime',
      });
      expect(result).toBe('image/png'); // Falls back to filename detection
    });
  });

  describe('getAttachmentType', () => {
    it('should classify image MIME types', () => {
      expect(AttachmentUtil.getAttachmentType('image/png')).toBe('image');
      expect(AttachmentUtil.getAttachmentType('image/jpeg')).toBe('image');
      expect(AttachmentUtil.getAttachmentType('image/gif')).toBe('image');
      expect(AttachmentUtil.getAttachmentType('image/webp')).toBe('image');
    });

    it('should classify video MIME types', () => {
      expect(AttachmentUtil.getAttachmentType('video/mp4')).toBe('video');
      expect(AttachmentUtil.getAttachmentType('video/webm')).toBe('video');
      expect(AttachmentUtil.getAttachmentType('video/quicktime')).toBe('video');
    });

    it('should classify audio MIME types', () => {
      expect(AttachmentUtil.getAttachmentType('audio/mpeg')).toBe('audio');
      expect(AttachmentUtil.getAttachmentType('audio/wav')).toBe('audio');
      expect(AttachmentUtil.getAttachmentType('audio/ogg')).toBe('audio');
    });

    it('should classify other types as document', () => {
      expect(AttachmentUtil.getAttachmentType('application/pdf')).toBe(
        'document',
      );
      expect(AttachmentUtil.getAttachmentType('text/plain')).toBe('document');
      expect(AttachmentUtil.getAttachmentType('application/zip')).toBe(
        'document',
      );
      expect(AttachmentUtil.getAttachmentType('application/octet-stream')).toBe(
        'document',
      );
    });

    it('should handle empty MIME type', () => {
      expect(AttachmentUtil.getAttachmentType('')).toBe('document');
    });
  });

  describe('base64ToBuffer', () => {
    it('should convert plain base64 to Buffer', () => {
      const base64 = Buffer.from('test data').toString('base64');
      const result = AttachmentUtil.base64ToBuffer(base64);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe('test data');
    });

    it('should strip data URI prefix and convert to Buffer', () => {
      const base64 = Buffer.from('test data').toString('base64');
      const dataUri = `data:image/png;base64,${base64}`;
      const result = AttachmentUtil.base64ToBuffer(dataUri);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe('test data');
    });

    it('should handle empty data', () => {
      const result = AttachmentUtil.base64ToBuffer('');
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(0);
    });
  });

  describe('getFilenameFromUrl', () => {
    it('should extract filename from URL', () => {
      const result = AttachmentUtil.getFilenameFromUrl(
        'https://example.com/path/to/file.png',
      );
      expect(result).toBe('file.png');
    });

    it('should extract filename from URL with query params', () => {
      const result = AttachmentUtil.getFilenameFromUrl(
        'https://example.com/file.png?size=large',
      );
      expect(result).toBe('file.png');
    });

    it('should extract filename from simple path', () => {
      const result = AttachmentUtil.getFilenameFromUrl('/path/to/file.pdf');
      expect(result).toBe('file.pdf');
    });

    it('should return "file" for URL without filename', () => {
      const result = AttachmentUtil.getFilenameFromUrl('https://example.com/');
      expect(result).toBe('file');
    });

    it('should return "file" for URL ending with slash', () => {
      const result = AttachmentUtil.getFilenameFromUrl(
        'https://example.com/path/',
      );
      expect(result).toBe('file');
    });

    it('should handle filenames with multiple dots', () => {
      const result = AttachmentUtil.getFilenameFromUrl(
        'https://example.com/my.file.name.tar.gz',
      );
      expect(result).toBe('my.file.name.tar.gz');
    });

    it('should return "file" for empty string', () => {
      const result = AttachmentUtil.getFilenameFromUrl('');
      expect(result).toBe('file');
    });
  });
});
