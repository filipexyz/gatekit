import {
  IsString,
  IsEnum,
  IsOptional,
  ValidateNested,
  IsArray,
  IsBoolean,
  IsDateString,
  ValidateIf,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum TargetType {
  USER = 'user',
  CHANNEL = 'channel',
  GROUP = 'group',
}

export enum Platform {
  DISCORD = 'discord',
  TELEGRAM = 'telegram',
  WHATSAPP_EVO = 'whatsapp-evo',
}

export enum Priority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
}

export class TargetDto {
  @IsString()
  platformId: string;

  @IsEnum(TargetType)
  type: TargetType;

  @IsString()
  id: string;
}

export class AttachmentDto {
  @ValidateIf((o) => !o.data)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url?: string;

  @ValidateIf((o) => !o.url)
  @IsString()
  data?: string;

  @IsOptional()
  @IsString()
  filename?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsString()
  caption?: string;
}

export class ButtonDto {
  @IsString()
  text: string;

  @IsString()
  value: string;
}

export class EmbedDto {
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

export class ContentDto {
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

export class OptionsDto {
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

export class MetadataDto {
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
