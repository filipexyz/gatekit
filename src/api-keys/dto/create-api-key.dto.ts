import { IsString, IsEnum, IsOptional, IsNumber, IsArray } from 'class-validator';
import { ApiKeyEnvironment } from '@prisma/client';

export class CreateApiKeyDto {
  @IsString()
  name: string;

  @IsEnum(ApiKeyEnvironment)
  environment: ApiKeyEnvironment;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @IsOptional()
  @IsNumber()
  expiresInDays?: number;
}