import { IsObject, IsOptional, IsBoolean } from 'class-validator';

export class UpdatePlatformDto {
  @IsOptional()
  @IsObject()
  credentials?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  testMode?: boolean;
}
