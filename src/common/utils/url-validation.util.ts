import { BadRequestException } from '@nestjs/common';
import * as dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);

/**
 * Utility class for URL validation with SSRF protection
 */
export class UrlValidationUtil {
  /**
   * Validates URL and protects against SSRF attacks
   * @param url - URL to validate
   * @param context - Context for error messages (e.g., "webhook", "attachment")
   * @throws BadRequestException if URL is invalid or potentially malicious
   */
  static async validateUrl(url: string, context = 'URL'): Promise<void> {
    let parsed: URL;

    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException(`Invalid ${context} format`);
    }

    // 1. Only allow HTTP/HTTPS protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException(
        `Only HTTP and HTTPS protocols are allowed for ${context}`,
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
}
