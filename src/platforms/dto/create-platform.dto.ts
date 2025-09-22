import { IsString, IsEnum, IsObject, IsOptional, IsBoolean } from 'class-validator';

export enum PlatformType {
  DISCORD = 'discord',
  TELEGRAM = 'telegram',
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