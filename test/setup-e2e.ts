// Set up environment variables for E2E tests
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://gatekit:gatekit_password@localhost:5432/gatekit_test?schema=public';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ||
  '603ce4d06f761f2ace4ae4eda60987f404644414032d1ef216e9a306277afb00';
process.env.CORS_ORIGINS = 'http://localhost:3000';
