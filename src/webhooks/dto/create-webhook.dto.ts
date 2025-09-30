import {
  IsString,
  IsUrl,
  IsArray,
  IsOptional,
  ArrayNotEmpty,
  ArrayUnique,
  IsEnum,
  MinLength,
  MaxLength,
} from 'class-validator';
import { WebhookEventType } from '../types/webhook-event.types';

export class CreateWebhookDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
  })
  url: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(WebhookEventType, { each: true })
  events: WebhookEventType[];

  @IsOptional()
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  secret?: string; // Optional - auto-generated if not provided
}
