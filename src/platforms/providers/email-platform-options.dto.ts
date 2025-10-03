import { IsOptional, IsArray, IsEmail, IsString } from 'class-validator';

/**
 * Email platform-specific options
 *
 * These options are only available when sending to email platforms.
 * They are validated at runtime and auto-generated into SDK/CLI/OpenAPI/n8n.
 *
 * Usage:
 * ```json
 * {
 *   "content": {
 *     "subject": "Hello",
 *     "text": "Message body",
 *     "platformOptions": {
 *       "email": {
 *         "cc": ["manager@example.com"],
 *         "bcc": ["archive@example.com"],
 *         "replyTo": "noreply@example.com"
 *       }
 *     }
 *   }
 * }
 * ```
 */
export class EmailPlatformOptions {
  /**
   * CC recipients (Carbon Copy)
   * Multiple recipients who will receive a copy of the email
   */
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  cc?: string[];

  /**
   * BCC recipients (Blind Carbon Copy)
   * Multiple recipients who will receive a copy without others knowing
   */
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  bcc?: string[];

  /**
   * Reply-To address
   * Email address where replies should be sent (different from sender)
   */
  @IsOptional()
  @IsEmail()
  replyTo?: string;

  /**
   * Custom SMTP headers
   * Advanced: Add custom headers to the email
   */
  @IsOptional()
  headers?: Record<string, string>;
}
