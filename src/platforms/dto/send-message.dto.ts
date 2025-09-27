import { IsString, IsEnum, IsOptional, ValidateNested, IsArray, IsBoolean, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export enum TargetType {
  USER = 'user',
  CHANNEL = 'channel',
  GROUP = 'group',
}

export enum Platform {
  DISCORD = 'discord',
  TELEGRAM = 'telegram',
}

export enum Priority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
}

class TargetDto {
  @IsString()
  platformId: string;

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

class ButtonDto {
  @IsString()
  text: string;

  @IsString()
  value: string;
}

class EmbedDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;
}

class ContentDto {
  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ButtonDto)
  buttons?: ButtonDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmbedDto)
  embeds?: EmbedDto[];
}

class OptionsDto {
  @IsOptional()
  @IsString()
  replyTo?: string;

  @IsOptional()
  @IsBoolean()
  silent?: boolean;

  @IsOptional()
  @IsDateString()
  scheduled?: string;
}

class MetadataDto {
  @IsOptional()
  @IsString()
  trackingId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;
}

export class SendMessageDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TargetDto)
  targets: TargetDto[];

  @ValidateNested()
  @Type(() => ContentDto)
  content: ContentDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OptionsDto)
  options?: OptionsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MetadataDto)
  metadata?: MetadataDto;
}