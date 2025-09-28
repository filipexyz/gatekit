export class CredentialMaskUtil {
  private static readonly MASK_VALUE = '*****';

  /**
   * Masks ALL credential values in an object for security
   * @param credentials - The credentials object to mask
   * @returns Masked credentials object with ALL values replaced with '*****'
   */
  static maskCredentials(
    credentials: Record<string, any>,
  ): Record<string, any> {
    if (!credentials || typeof credentials !== 'object') {
      return credentials;
    }

    const masked = { ...credentials };

    // Mask ALL fields - credentials are sensitive by nature
    for (const [key, value] of Object.entries(masked)) {
      if (typeof value === 'object' && value !== null) {
        // Recursively mask nested objects
        masked[key] = this.maskCredentials(value);
      } else {
        // Mask ALL credential values
        masked[key] = this.MASK_VALUE;
      }
    }

    return masked;
  }
}
