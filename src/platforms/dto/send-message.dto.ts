import { IsString, IsEnum, IsOptional, IsObject, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export enum TargetType {
  USER = 'user',
  CHANNEL = 'channel',
  GROUP = 'group',
}

class TargetDto {
  @IsEnum(TargetType)
  type: TargetType;

  @IsString()
  id: string;
}

class AttachmentDto {
  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  mime?: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export class SendMessageDto {
  @IsEnum(['discord', 'telegram'])
  platform: 'discord' | 'telegram';

  @ValidateNested()
  @Type(() => TargetDto)
  target: TargetDto;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}