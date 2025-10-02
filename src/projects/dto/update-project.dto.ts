import {
  IsString,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsJSON,
} from 'class-validator';
import { ProjectEnvironment } from '@prisma/client';

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsEnum(ProjectEnvironment)
  environment?: ProjectEnvironment;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsJSON()
  settings?: any;
}
