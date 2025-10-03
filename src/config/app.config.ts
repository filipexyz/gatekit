import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';

export interface AppConfig {
  nodeEnv: string;
  port: number;
  encryptionKey: string;
  jwtSecret: string;
  corsOrigins: string[];
  database: {
    url: string;
  };
  redis: {
    url: string;
  };
  auth0: {
    domain: string;
    audience: string;
    clientId: string;
    clientSecret: string;
  };
  rateLimit: {
    ttl: number;
    limit: number;
    apiKeyValidationLimit: number;
  };
}

export const appConfig = registerAs(
  'app',
  (): AppConfig => ({
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    encryptionKey: process.env.ENCRYPTION_KEY || '',
    jwtSecret: process.env.JWT_SECRET || '',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || [
      'http://localhost:3000',
    ],
    database: {
      url: process.env.DATABASE_URL || '',
    },
    redis: {
      url: process.env.REDIS_URL || '',
    },
    auth0: {
      domain: process.env.AUTH0_DOMAIN || '',
      audience: process.env.AUTH0_AUDIENCE || '',
      clientId: process.env.AUTH0_CLIENT_ID || '',
      clientSecret: process.env.AUTH0_CLIENT_SECRET || '',
    },
    rateLimit: {
      ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10),
      limit: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
      apiKeyValidationLimit: parseInt(
        process.env.API_KEY_VALIDATION_LIMIT || '10',
        10,
      ),
    },
  }),
);

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  ENCRYPTION_KEY: Joi.string().min(32).required().messages({
    'string.min':
      'ENCRYPTION_KEY must be at least 32 characters. Generate using: openssl rand -hex 32',
    'any.required': 'ENCRYPTION_KEY is required for securing sensitive data',
  }),
  JWT_SECRET: Joi.string().min(32).required().messages({
    'string.min':
      'JWT_SECRET must be at least 32 characters. Generate using: openssl rand -hex 32',
    'any.required':
      'JWT_SECRET is required for local authentication. Generate using: openssl rand -hex 32',
  }),
  CORS_ORIGINS: Joi.string().optional(),
  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().required(),
  AUTH0_DOMAIN: Joi.string().allow('').optional(),
  AUTH0_AUDIENCE: Joi.string().allow('').optional(),
  AUTH0_CLIENT_ID: Joi.string().allow('').optional(),
  AUTH0_CLIENT_SECRET: Joi.string().allow('').optional(),
  RATE_LIMIT_TTL: Joi.number().default(60),
  RATE_LIMIT_MAX: Joi.number().default(100),
  API_KEY_VALIDATION_LIMIT: Joi.number().default(10),
});
