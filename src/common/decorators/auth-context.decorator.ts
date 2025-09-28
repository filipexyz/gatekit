import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SecurityUtil, AuthContext } from '../utils/security.util';

/**
 * Decorator to inject authentication context into controller methods
 * Provides clean way to pass auth context to services for defense-in-depth validation
 */
export const AuthContextParam = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthContext | null => {
    const request = ctx.switchToHttp().getRequest();
    return SecurityUtil.extractAuthContext(request);
  },
);
