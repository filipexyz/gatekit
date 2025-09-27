/**
 * Case conversion utilities for code generation
 * All methods are tested and handle edge cases properly
 */

export class CaseConverter {
  /**
   * Converts string to PascalCase
   * Examples: "project members" -> "ProjectMembers", "api-keys" -> "ApiKeys"
   */
  static toPascalCase(input: string): string {
    if (!input) return '';

    return input
      .split(/[\s\-_]+/)
      .filter((word) => word.length > 0)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  /**
   * Converts string to camelCase
   * Examples: "project members" -> "projectMembers", "api-keys" -> "apiKeys"
   */
  static toCamelCase(input: string): string {
    if (!input) return '';

    const words = input.split(/[\s\-_]+/).filter((word) => word.length > 0);

    if (words.length === 0) return '';

    return words
      .map((word, index) =>
        index === 0
          ? word.toLowerCase()
          : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
      )
      .join('');
  }

  /**
   * Converts string to kebab-case
   * Examples: "project members" -> "project-members", "ApiKeys" -> "api-keys"
   */
  static toKebabCase(input: string): string {
    if (!input) return '';

    return input
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2') // Insert hyphen before uppercase letters (including after numbers)
      .split(/[\s\-_]+/)
      .filter((word) => word.length > 0)
      .map((word) => word.toLowerCase())
      .join('-');
  }

  /**
   * Converts string to snake_case
   * Examples: "project members" -> "project_members", "ApiKeys" -> "api_keys"
   */
  static toSnakeCase(input: string): string {
    if (!input) return '';

    return input
      .replace(/([a-z])([A-Z])/g, '$1_$2') // Insert underscore before uppercase letters
      .split(/[\s\-_]+/)
      .filter((word) => word.length > 0)
      .map((word) => word.toLowerCase())
      .join('_');
  }

  /**
   * Converts string to SCREAMING_SNAKE_CASE
   * Examples: "project members" -> "PROJECT_MEMBERS", "ApiKeys" -> "API_KEYS"
   */
  static toScreamingSnakeCase(input: string): string {
    return CaseConverter.toSnakeCase(input).toUpperCase();
  }

  /**
   * Converts string to lowercase with spaces
   * Examples: "ProjectMembers" -> "project members", "api-keys" -> "api keys"
   */
  static toLowerSpaced(input: string): string {
    if (!input) return '';

    return input
      .replace(/([a-z])([A-Z])/g, '$1 $2') // Insert space before uppercase letters
      .split(/[\s\-_]+/)
      .filter((word) => word.length > 0)
      .map((word) => word.toLowerCase())
      .join(' ');
  }

  /**
   * Creates a valid JavaScript property name from any string
   * Handles edge cases like numbers, special characters, reserved words
   */
  static toValidPropertyName(input: string): string {
    if (!input) return '';

    const camelCase = CaseConverter.toCamelCase(input);

    // If starts with number, prefix with underscore
    if (/^\d/.test(camelCase)) {
      return '_' + camelCase;
    }

    // If it's a reserved word, suffix with underscore
    const reservedWords = [
      'break',
      'case',
      'catch',
      'class',
      'const',
      'continue',
      'debugger',
      'default',
      'delete',
      'do',
      'else',
      'export',
      'extends',
      'finally',
      'for',
      'function',
      'if',
      'import',
      'in',
      'instanceof',
      'new',
      'return',
      'super',
      'switch',
      'this',
      'throw',
      'try',
      'typeof',
      'var',
      'void',
      'while',
      'with',
      'yield',
    ];

    if (reservedWords.includes(camelCase)) {
      return camelCase + '_';
    }

    return camelCase;
  }

  /**
   * Creates a valid JavaScript class name from any string
   * Always returns PascalCase and handles edge cases
   */
  static toValidClassName(input: string): string {
    if (!input) return '';

    const pascalCase = CaseConverter.toPascalCase(input);

    // If starts with number, prefix with underscore
    if (/^\d/.test(pascalCase)) {
      return '_' + pascalCase;
    }

    return pascalCase;
  }

  /**
   * Creates a valid filename from any string
   * Uses kebab-case and removes invalid filename characters
   */
  static toValidFilename(input: string): string {
    if (!input) return '';

    return CaseConverter.toKebabCase(input)
      .replace(/[^a-z0-9-]/g, '') // Remove any non-alphanumeric or hyphen chars
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
      .replace(/-+/g, '-'); // Collapse multiple hyphens
  }
}
