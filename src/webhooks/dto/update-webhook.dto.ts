import {
  IsString,
  IsUrl,
  IsArray,
  IsOptional,
  IsBoolean,
  ArrayNotEmpty,
  ArrayUnique,
  IsEnum,
  MinLength,
  MaxLength,
} from 'class-validator';
import { WebhookEventType } from '../types/webhook-event.types';

export class UpdateWebhookDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
  })
  url?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(WebhookEventType, { each: true })
  events?: WebhookEventType[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
