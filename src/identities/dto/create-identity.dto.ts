import {
  IsString,
  IsOptional,
  IsEmail,
  IsObject,
  IsArray,
  ValidateNested,
  IsUUID,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class IdentityAliasDto {
  @IsUUID()
  platformId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  providerUserId: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  providerUserDisplay?: string;
}

export class CreateIdentityDto {
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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IdentityAliasDto)
  aliases: IdentityAliasDto[];
}
