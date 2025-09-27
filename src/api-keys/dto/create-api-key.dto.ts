import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ArrayMinSize,
} from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  name: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  scopes: string[];

  @IsOptional()
  @IsNumber()
  expiresInDays?: number;
}
