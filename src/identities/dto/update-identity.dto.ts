import {
  IsString,
  IsOptional,
  IsEmail,
  IsObject,
  MinLength,
  MaxLength,
} from 'class-validator';

export class UpdateIdentityDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(200)
  displayName?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
