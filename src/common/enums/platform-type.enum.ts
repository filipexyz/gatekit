/**
 * Platform Type Enum
 *
 * Defines all supported messaging platforms.
 * This is the single source of truth for platform types across the entire application.
 */
export enum PlatformType {
  DISCORD = 'discord',
  TELEGRAM = 'telegram',
  WHATSAPP_EVO = 'whatsapp-evo',
  EMAIL = 'email',
}

/**
 * Type guard to check if a string is a valid PlatformType
 */
export function isPlatformType(value: string): value is PlatformType {
  return Object.values(PlatformType).includes(value as PlatformType);
}

/**
 * Safely cast a string to PlatformType enum
 * Throws if the value is not a valid platform type
 */
export function toPlatformType(value: string): PlatformType {
  if (isPlatformType(value)) {
    return value;
  }
  throw new Error(`Invalid platform type: ${value}`);
}
