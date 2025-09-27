// IMPORTANT: Make sure to import `instrument.ts` at the top of your file.
import './instrument';

// All other imports below
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CryptoUtil } from './common/utils/crypto.util';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Initialize encryption key on startup
  CryptoUtil.initializeEncryptionKey();

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Sentry is integrated via the interceptor instead of middleware for NestJS

  // Configure CORS with specific origins
  const corsOrigins = configService.get<string[]>('app.corsOrigins') || [
    'http://localhost:3000',
  ];
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or Postman)
      if (!origin) return callback(null, true);

      if (corsOrigins && corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
  });

  const port = configService.get<number>('app.port') || 3000;
  await app.listen(port);

  const nodeEnv = configService.get<string>('app.nodeEnv') || 'development';
  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log(`Environment: ${nodeEnv}`);
  console.log(`CORS origins: ${corsOrigins.join(', ')}`);
}
bootstrap();
