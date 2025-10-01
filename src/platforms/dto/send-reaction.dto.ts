import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class SendReactionDto {
  @IsString()
  @IsNotEmpty()
  platformId: string;

  @IsString()
  @IsNotEmpty()
  messageId: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1, { message: 'Emoji cannot be empty' })
  @MaxLength(100, { message: 'Emoji is too long (max 100 characters)' })
  emoji: string;
}
