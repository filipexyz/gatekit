import { SetMetadata } from '@nestjs/common';

export const SCOPES_KEY = 'requiredScopes';
export const RequireScopes = (...scopes: string[]) =>
  SetMetadata(SCOPES_KEY, scopes);
