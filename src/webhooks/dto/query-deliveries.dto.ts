import { IsOptional, IsEnum, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { WebhookEventType } from '../types/webhook-event.types';

export class QueryDeliveriesDto {
  @IsOptional()
  @IsEnum(WebhookEventType)
  event?: WebhookEventType;

  @IsOptional()
  @IsIn(['pending', 'success', 'failed'])
  status?: 'pending' | 'success' | 'failed';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
