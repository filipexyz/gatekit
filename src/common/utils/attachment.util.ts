import { BadRequestException } from '@nestjs/common';
import * as dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);

/**
 * Utility class for attachment handling: URL validation, SSRF protection, MIME type detection
 */
export class AttachmentUtil {
  /**
   * Validates attachment URL and protects against SSRF attacks
   * @param url - URL to validate
   * @throws BadRequestException if URL is invalid or potentially malicious
   */
  static async validateAttachmentUrl(url: string): Promise<void> {
    let parsed: URL;

    try {
      parsed = new URL(url);
    } catch (error) {
      throw new BadRequestException('Invalid URL format');
    }

    // 1. Only allow HTTP/HTTPS protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException(
        'Only HTTP and HTTPS protocols are allowed for attachments',
      );
    }

    // 2. Block localhost and loopback addresses
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname === '[::1]' ||
      hostname.startsWith('127.') ||
      hostname.endsWith('.localhost')
    ) {
      throw new BadRequestException(
        'Localhost and loopback addresses are not allowed',
      );
    }

    // 3. Block private IP ranges (RFC 1918)
    if (
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)
    ) {
      throw new BadRequestException('Private IP addresses are not allowed');
    }

    // 4. Block cloud metadata endpoints
    if (
      hostname === '169.254.169.254' || // AWS metadata
      hostname === 'metadata.google.internal' || // GCP metadata
      hostname === '100.100.100.200' // Azure metadata
    ) {
      throw new BadRequestException('Cloud metadata endpoints are not allowed');
    }

    // 5. DNS rebinding protection - resolve hostname and validate IP
    try {
      const { address } = await dnsLookup(hostname);

      // Check resolved IP against blocked ranges
      if (
        address.startsWith('127.') ||
        address.startsWith('10.') ||
        address.startsWith('192.168.') ||
        address.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./) ||
        address === '169.254.169.254' ||
        address === '0.0.0.0' ||
        address === '::1'
      ) {
        throw new BadRequestException(
          'URL resolves to a blocked IP address range',
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      // DNS lookup failed - allow it (could be temporary DNS issue)
      // Platform APIs will handle unreachable URLs
    }
  }

  /**
   * Validates base64 attachment data
   * @param data - Base64 string (with or without data URI prefix)
   * @param maxSizeBytes - Maximum allowed size in bytes (default: 25MB)
   * @throws BadRequestException if data is invalid or too large
   */
  static validateBase64Data(
    data: string,
    maxSizeBytes = 25 * 1024 * 1024,
  ): void {
    // Remove data URI prefix if present
    const base64Data = this.extractBase64String(data);

    // Validate base64 format
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(base64Data)) {
      throw new BadRequestException('Invalid base64 format');
    }

    // Calculate decoded size (base64 is ~33% larger than original)
    const decodedSize = (base64Data.length * 3) / 4;

    if (decodedSize > maxSizeBytes) {
      throw new BadRequestException(
        `Attachment size exceeds maximum allowed size of ${maxSizeBytes / 1024 / 1024}MB`,
      );
    }
  }

  /**
   * Auto-detects MIME type from various sources
   * @param options - Detection options
   * @returns MIME type or 'application/octet-stream' if unknown
   */
  static detectMimeType(options: {
    url?: string;
    data?: string;
    filename?: string;
    providedMimeType?: string;
  }): string {
    const { url, data, filename, providedMimeType } = options;

    // 1. Use provided MIME type if valid
    if (providedMimeType && this.isValidMimeType(providedMimeType)) {
      return providedMimeType;
    }

    // 2. Extract from data URI
    if (data && data.startsWith('data:')) {
      const match = data.match(/^data:([^;,]+)/);
      if (match) {
        return match[1];
      }
    }

    // 3. Detect from filename extension
    const fileToCheck = filename || url;
    if (fileToCheck) {
      const extension = this.getFileExtension(fileToCheck);
      const mimeType = this.getMimeTypeFromExtension(extension);
      if (mimeType) {
        return mimeType;
      }
    }

    // 4. Default to generic binary
    return 'application/octet-stream';
  }

  /**
   * Gets attachment type category for platform routing
   * @param mimeType - MIME type
   * @returns Attachment type: image, video, audio, or document
   */
  static getAttachmentType(
    mimeType: string,
  ): 'image' | 'video' | 'audio' | 'document' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
  }

  /**
   * Converts base64 data to Buffer
   * @param data - Base64 string (with or without data URI prefix)
   * @returns Buffer containing decoded data
   */
  static base64ToBuffer(data: string): Buffer {
    const base64Data = this.extractBase64String(data);
    return Buffer.from(base64Data, 'base64');
  }

  /**
   * Extracts raw base64 string from data (with or without data URI prefix)
   * @param data - Base64 string or data URI
   * @returns Raw base64 string without data URI prefix
   */
  static extractBase64String(data: string): string {
    // Remove data URI prefix if present (e.g., "data:image/jpeg;base64,")
    return data.includes(',') ? data.split(',')[1] : data;
  }

  /**
   * Extracts filename from URL or path
   * @param urlOrPath - URL or file path
   * @returns Filename extracted from path
   */
  static getFilenameFromUrl(urlOrPath: string): string {
    try {
      const url = new URL(urlOrPath);
      const pathname = url.pathname;
      const filename = pathname.split('/').pop();
      return filename || 'file';
    } catch {
      // Not a URL, extract from path
      const filename = urlOrPath.split('/').pop();
      return filename || 'file';
    }
  }

  /**
   * Gets file extension from filename or URL
   */
  private static getFileExtension(path: string): string {
    try {
      const url = new URL(path);
      path = url.pathname;
    } catch {
      // Not a URL, treat as filename
    }

    const parts = path.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  /**
   * Maps file extension to MIME type
   */
  private static getMimeTypeFromExtension(extension: string): string | null {
    const mimeTypes: Record<string, string> = {
      // Images
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      bmp: 'image/bmp',
      ico: 'image/x-icon',

      // Videos
      mp4: 'video/mp4',
      webm: 'video/webm',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
      mkv: 'video/x-matroska',

      // Audio
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      m4a: 'audio/mp4',
      flac: 'audio/flac',

      // Documents
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      txt: 'text/plain',
      csv: 'text/csv',
      json: 'application/json',
      xml: 'application/xml',
      zip: 'application/zip',
      rar: 'application/x-rar-compressed',
      '7z': 'application/x-7z-compressed',
    };

    return mimeTypes[extension] || null;
  }

  /**
   * Validates MIME type format
   */
  private static isValidMimeType(mimeType: string): boolean {
    // Basic MIME type format: type/subtype
    return /^[a-z]+\/[a-z0-9\-+.]+$/.test(mimeType);
  }
}
