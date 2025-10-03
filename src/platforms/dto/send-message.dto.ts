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

export enum ButtonStyle {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  SUCCESS = 'success',
  DANGER = 'danger',
  LINK = 'link',
}

export class ButtonDto {
  @IsString()
  text: string;

  @ValidateIf((o) => !o.url)
  @IsString()
  value?: string;

  @ValidateIf((o) => !o.value)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  url?: string;

  @IsOptional()
  @IsEnum(ButtonStyle)
  style?: ButtonStyle;
}

export class EmbedAuthorDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url?: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  iconUrl?: string;
}

export class EmbedFooterDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  iconUrl?: string;
}

export class EmbedFieldDto {
  @IsString()
  name: string;

  @IsString()
  value: string;

  @IsOptional()
  @IsBoolean()
  inline?: boolean;
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
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url?: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  imageUrl?: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  thumbnailUrl?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => EmbedAuthorDto)
  author?: EmbedAuthorDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => EmbedFooterDto)
  footer?: EmbedFooterDto;

  @IsOptional()
  @IsDateString()
  timestamp?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmbedFieldDto)
  fields?: EmbedFieldDto[];
}

export class ContentDto {
  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  markdown?: string;

  @IsOptional()
  @IsString()
  html?: string;

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

  @IsOptional()
  platformOptions?: Record<string, any>;
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
