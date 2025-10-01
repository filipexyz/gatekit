import { PrismaService } from '../../prisma/prisma.service';
import { CryptoUtil } from '../../common/utils/crypto.util';

/**
 * Shared utility for platform providers
 * Eliminates code duplication across Telegram, WhatsApp, and other HTTP-based providers
 */
export class ProviderUtil {
  /**
   * Extract platformId and credentials from connectionKey
   * @param connectionKey Format: "projectId:platformId"
   * @param prisma PrismaService instance
   * @param platformName Platform name for error messages (e.g., 'Telegram', 'WhatsApp')
   * @returns Object with platformId and decrypted credentials
   */
  static async getPlatformCredentials<T = Record<string, any>>(
    connectionKey: string,
    prisma: PrismaService,
    platformName: string,
  ): Promise<{ platformId: string; credentials: T }> {
    const [, platformId] = connectionKey.split(':');

    if (!platformId) {
      throw new Error(
        `Invalid connection key format for ${platformName}: ${connectionKey}`,
      );
    }

    const platformConfig = await prisma.projectPlatform.findUnique({
      where: { id: platformId },
    });

    if (!platformConfig) {
      throw new Error(
        `${platformName} platform configuration not found for ${platformId}`,
      );
    }

    const credentials = this.decryptPlatformCredentials<T>(
      platformConfig.credentialsEncrypted,
    );

    return { platformId, credentials };
  }

  /**
   * Decrypt platform credentials from encrypted string
   * @param credentialsEncrypted Encrypted credentials string
   * @returns Decrypted credentials object
   */
  static decryptPlatformCredentials<T = Record<string, any>>(
    credentialsEncrypted: string,
  ): T {
    return JSON.parse(CryptoUtil.decrypt(credentialsEncrypted)) as T;
  }
}
