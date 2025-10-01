import {
  IsString,
  IsUUID,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';

export class AddAliasDto {
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
