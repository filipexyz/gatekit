import { validate } from 'class-validator';
import { CreatePlatformDto } from './create-platform.dto';
import { PlatformType } from '../../common/enums/platform-type.enum';

describe('CreatePlatformDto', () => {
  it('should validate valid platform name with allowed characters', async () => {
    const dto = new CreatePlatformDto();
    dto.platform = PlatformType.DISCORD;
    dto.name = 'test-bot.v1';
    dto.credentials = { token: 'test' };

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject platform name with invalid characters', async () => {
    const dto = new CreatePlatformDto();
    dto.platform = PlatformType.DISCORD;
    dto.name = 'test bot@invalid!';
    dto.credentials = { token: 'test' };

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.matches).toContain(
      'letters, numbers, spaces, hyphens, and dots',
    );
  });

  it('should reject platform name that is too long', async () => {
    const dto = new CreatePlatformDto();
    dto.platform = PlatformType.DISCORD;
    dto.name = 'this-name-is-way-too-long-for-validation';
    dto.credentials = { token: 'test' };

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.isLength).toContain(
      'between 1 and 20 characters',
    );
  });

  it('should reject empty platform name', async () => {
    const dto = new CreatePlatformDto();
    dto.platform = PlatformType.DISCORD;
    dto.name = '';
    dto.credentials = { token: 'test' };

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.isLength).toContain(
      'between 1 and 20 characters',
    );
  });

  it('should allow valid names with spaces, dots and hyphens', async () => {
    const validNames = [
      'bot-1',
      'test.bot',
      'my-bot.v2',
      'simple',
      'Test Bot',
      'My Discord Bot',
    ];

    for (const name of validNames) {
      const dto = new CreatePlatformDto();
      dto.platform = PlatformType.TELEGRAM;
      dto.name = name;
      dto.credentials = { token: 'test' };

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });
});
