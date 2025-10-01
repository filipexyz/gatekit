import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
  IsISO8601,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class QueryMessagesDto {
  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  platformId?: string;

  @IsOptional()
  @IsString()
  chatId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  raw?: boolean = false;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  reactions?: boolean = false;
}
