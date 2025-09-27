import {
  IsString,
  IsEnum,
  IsObject,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export enum PlatformType {
  DISCORD = 'discord',
  TELEGRAM = 'telegram',
  WHATSAPP_EVO = 'whatsapp-evo',
}

export class CreatePlatformDto {
  @IsEnum(PlatformType)
  platform: PlatformType;

  @IsObject()
  credentials: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  testMode?: boolean;
}
