export interface CredentialValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface PlatformCredentialValidator {
  /**
   * Validates credentials for a specific platform
   */
  validateCredentials(
    credentials: Record<string, any>,
  ): CredentialValidationResult;

  /**
   * Gets required credential fields for this platform
   */
  getRequiredFields(): string[];

  /**
   * Gets optional credential fields for this platform
   */
  getOptionalFields(): string[];

  /**
   * Gets example credentials structure for documentation
   */
  getExampleCredentials(): Record<string, any>;

  /**
   * Platform this validator supports
   */
  readonly platform: string;
}
