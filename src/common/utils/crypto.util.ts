import {
  randomBytes,
  createHash,
  createCipheriv,
  createDecipheriv,
  scryptSync,
} from 'crypto';

export class CryptoUtil {
  private static readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm';
  private static encryptionKey: Buffer;

  static initializeEncryptionKey(): void {
    const key = process.env.ENCRYPTION_KEY;

    if (!key) {
      throw new Error(
        'ENCRYPTION_KEY environment variable is required. ' +
          'Generate a secure key using: openssl rand -hex 32',
      );
    }

    if (key.length < 64) {
      throw new Error(
        'ENCRYPTION_KEY must be at least 64 characters (32 bytes hex). ' +
          'Generate a secure key using: openssl rand -hex 32',
      );
    }

    // Use the key directly as a hex string
    this.encryptionKey = Buffer.from(key, 'hex');

    if (this.encryptionKey.length !== 32) {
      throw new Error(
        'ENCRYPTION_KEY must be exactly 32 bytes when decoded from hex. ' +
          'Generate a secure key using: openssl rand -hex 32',
      );
    }
  }

  static getEncryptionKey(): Buffer {
    if (!this.encryptionKey) {
      this.initializeEncryptionKey();
    }
    return this.encryptionKey;
  }

  static generateApiKey(
    environment: 'production' | 'staging' | 'development' | 'custom',
  ): string {
    const envPrefix = {
      production: 'prod',
      staging: 'stg',
      development: 'dev',
      custom: 'custom',
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
    const key = this.getEncryptionKey();
    const cipher = createCipheriv(this.ENCRYPTION_ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  static decrypt(encryptedData: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const key = this.getEncryptionKey();
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
