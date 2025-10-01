import { Logger } from '@nestjs/common';
import { EmbedDto } from '../dto/send-message.dto';
import { UrlValidationUtil } from '../../common/utils/url-validation.util';

/**
 * Validated embed data with all URLs checked for SSRF protection
 */
export interface ValidatedEmbedData {
  title?: string;
  titleUrl?: string;
  description?: string;
  color?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  author?: {
    name: string;
    url?: string;
    iconUrl?: string;
  };
  footer?: {
    text: string;
    iconUrl?: string;
  };
  fields: Array<{ name: string; value: string; inline: boolean }>;
  timestamp?: Date;
}

/**
 * Centralized embed transformation utility
 * Handles URL validation and common embed processing logic for all platform providers
 */
export class EmbedTransformerUtil {
  /**
   * Validate all URLs in an embed and return sanitized data
   * This centralizes the URL validation logic that was duplicated across Discord, Telegram, and WhatsApp providers
   *
   * @param embed - The embed DTO to validate
   * @param logger - Logger instance for warnings
   * @returns Validated embed data with only safe URLs included
   */
  static async validateAndProcessEmbed(
    embed: EmbedDto,
    logger: Logger,
  ): Promise<ValidatedEmbedData> {
    const result: ValidatedEmbedData = {
      title: embed.title,
      description: embed.description,
      color: embed.color,
      fields: embed.fields
        ? embed.fields.map((f) => ({
            name: f.name,
            value: f.value,
            inline: f.inline ?? false,
          }))
        : [],
    };

    // Validate and set title URL (makes title clickable)
    if (embed.url) {
      try {
        await UrlValidationUtil.validateUrl(embed.url, 'embed URL');
        result.titleUrl = embed.url;
      } catch (error) {
        logger.warn(
          `Invalid or unsafe embed URL: ${embed.url}, skipping link. ${error.message}`,
        );
      }
    }

    // Validate and set image URL
    if (embed.imageUrl) {
      try {
        await UrlValidationUtil.validateUrl(embed.imageUrl, 'embed image');
        result.imageUrl = embed.imageUrl;
      } catch (error) {
        logger.warn(
          `Invalid or unsafe imageUrl: ${embed.imageUrl}, skipping image. ${error.message}`,
        );
      }
    }

    // Validate and set thumbnail URL
    if (embed.thumbnailUrl) {
      try {
        await UrlValidationUtil.validateUrl(
          embed.thumbnailUrl,
          'embed thumbnail',
        );
        result.thumbnailUrl = embed.thumbnailUrl;
      } catch (error) {
        logger.warn(
          `Invalid or unsafe thumbnailUrl: ${embed.thumbnailUrl}, skipping thumbnail. ${error.message}`,
        );
      }
    }

    // Validate author with URL and icon
    if (embed.author) {
      result.author = {
        name: embed.author.name,
      };

      if (embed.author.url) {
        try {
          await UrlValidationUtil.validateUrl(
            embed.author.url,
            'embed author URL',
          );
          result.author.url = embed.author.url;
        } catch (error) {
          logger.warn(
            `Invalid or unsafe author URL: ${embed.author.url}, skipping URL. ${error.message}`,
          );
        }
      }

      if (embed.author.iconUrl) {
        try {
          await UrlValidationUtil.validateUrl(
            embed.author.iconUrl,
            'embed author icon',
          );
          result.author.iconUrl = embed.author.iconUrl;
        } catch (error) {
          logger.warn(
            `Invalid or unsafe author iconUrl: ${embed.author.iconUrl}, skipping icon. ${error.message}`,
          );
        }
      }
    }

    // Validate footer with icon
    if (embed.footer) {
      result.footer = {
        text: embed.footer.text,
      };

      if (embed.footer.iconUrl) {
        try {
          await UrlValidationUtil.validateUrl(
            embed.footer.iconUrl,
            'embed footer icon',
          );
          result.footer.iconUrl = embed.footer.iconUrl;
        } catch (error) {
          logger.warn(
            `Invalid or unsafe footer iconUrl: ${embed.footer.iconUrl}, skipping icon. ${error.message}`,
          );
        }
      }
    }

    // Parse and validate timestamp
    if (embed.timestamp) {
      try {
        const date = new Date(embed.timestamp);
        if (!isNaN(date.getTime())) {
          result.timestamp = date;
        } else {
          logger.warn(
            `Invalid timestamp: ${embed.timestamp}, skipping timestamp`,
          );
        }
      } catch (error) {
        logger.warn(
          `Failed to parse timestamp: ${embed.timestamp}, skipping. ${error.message}`,
        );
      }
    }

    return result;
  }

  /**
   * Parse Discord color value (supports both hex #FF5733 and decimal 16734003)
   * Returns a valid Discord color integer or null if invalid
   */
  static parseDiscordColor(
    colorValue: string | undefined,
    logger: Logger,
  ): number | null {
    if (!colorValue || colorValue.length === 0) {
      return null;
    }

    const parsed = colorValue.startsWith('#')
      ? parseInt(colorValue.slice(1), 16)
      : parseInt(colorValue, 10);

    if (!isNaN(parsed) && parsed >= 0 && parsed <= 0xffffff) {
      return parsed;
    }

    logger.warn(`Invalid Discord color value: ${colorValue}, skipping color`);
    return null;
  }
}
