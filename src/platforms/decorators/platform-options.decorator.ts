import { SetMetadata } from '@nestjs/common';

export const PLATFORM_OPTIONS_METADATA = 'platform_options_schema';

/**
 * Decorator to register platform-specific options schema
 *
 * Platform providers can declare their own options schema using class-validator decorators.
 * The schema is stored as metadata and auto-discovered by PlatformRegistry.
 * Contract system uses this to generate typed SDK, CLI flags, OpenAPI schema, and n8n UI.
 *
 * @param optionsClass - Class with class-validator decorators defining schema
 *
 * @example
 * ```typescript
 * export class EmailPlatformOptions {
 *   @IsOptional()
 *   @IsArray()
 *   @IsEmail({}, { each: true })
 *   cc?: string[];
 * }
 *
 * @PlatformProviderDecorator(PlatformType.EMAIL, [...])
 * @PlatformOptionsDecorator(EmailPlatformOptions)
 * export class EmailProvider implements PlatformProvider { }
 * ```
 */
export const PlatformOptionsDecorator = (optionsClass: any) => {
  return (target: any) => {
    SetMetadata(PLATFORM_OPTIONS_METADATA, optionsClass)(target);
  };
};
