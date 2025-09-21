import { randomBytes, createHash, createCipheriv, createDecipheriv } from 'crypto';

export class CryptoUtil {
  private static readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm';
  private static readonly ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || randomBytes(32).toString('hex');

  static generateApiKey(environment: 'production' | 'test' | 'restricted'): string {
    const envPrefix = {
      production: 'live',
      test: 'test',
      restricted: 'restricted',
    };

    const randomPart = randomBytes(32).toString('base64url');
    return `gk_${envPrefix[environment]}_${randomPart}`;
  }

  static hashApiKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  static getKeyPrefix(key: string): string {
    return key.substring(0, 12);
  }

  static getKeySuffix(key: string): string {
    return key.substring(key.length - 4);
  }

  static maskApiKey(prefix: string, suffix: string): string {
    return `${prefix}...${suffix}`;
  }

  static encrypt(text: string): string {
    const iv = randomBytes(16);
    const key = Buffer.from(this.ENCRYPTION_KEY.substring(0, 32), 'utf-8');
    const cipher = createCipheriv(this.ENCRYPTION_ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  static decrypt(encryptedData: string): string {
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const key = Buffer.from(this.ENCRYPTION_KEY.substring(0, 32), 'utf-8');
    const decipher = createDecipheriv(this.ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}