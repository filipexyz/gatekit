import {
  IsString,
  IsEnum,
  IsObject,
  IsOptional,
  IsBoolean,
  Matches,
  Length,
} from 'class-validator';
import { PlatformType } from '../../common/enums/platform-type.enum';

export class CreatePlatformDto {
  @IsEnum(PlatformType)
  platform: PlatformType;

  @IsString()
  @Length(1, 20, {
    message: 'Platform name must be between 1 and 20 characters',
  })
  @Matches(/^[a-zA-Z0-9.\s-]+$/, {
    message:
      'Platform name can only contain letters, numbers, spaces, hyphens, and dots',
  })
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsObject()
  credentials: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  testMode?: boolean;
}
