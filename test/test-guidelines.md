# Jest Testing Guidelines for GateKit

## Test Structure

```typescript
describe('Feature/Module Name', () => {
  describe('POST /endpoint', () => {
    it('should successfully create resource when valid data provided', () => {});
    it('should return 400 when required fields missing', () => {});
    it('should return 401 when API key invalid', () => {});
    it('should return 403 when lacking required scope', () => {});
  });
});
```

## API Key Testing

```typescript
// test/fixtures/api-keys.fixture.ts
import { CryptoUtil } from '../../src/common/utils/crypto.util';

export const createTestApiKey = async (prisma, projectId: string, overrides = {}) => {
  const environment = overrides.environment || 'test';
  const apiKey = CryptoUtil.generateApiKey(environment);
  const keyHash = CryptoUtil.hashApiKey(apiKey);
  const keyPrefix = CryptoUtil.getKeyPrefix(apiKey);

  const createdKey = await prisma.apiKey.create({
    data: {
      projectId,
      keyHash,
      keyPrefix,
      name: 'Test API Key',
      environment,
      ...overrides
    }
  });

  return { apiKey: createdKey, rawKey: apiKey };
};
```

## Database Setup

```typescript
// test/setup.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

beforeAll(async () => {
  await prisma.$connect();
});

beforeEach(async () => {
  // Clean database - order matters for foreign keys
  await prisma.apiKeyUsage.deleteMany();
  await prisma.apiKeyScope.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.projectPlatform.deleteMany();
  await prisma.project.deleteMany();

  // Create default test project
  await prisma.project.create({
    data: {
      id: 'test-project-id',
      name: 'Test Project',
      slug: 'test',
      environment: 'development',
      isDefault: true
    }
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

## Testing Patterns

### Testing Protected Endpoints
```typescript
it('should return 401 when no API key provided', async () => {
  const response = await request(app.getHttpServer())
    .get('/api/v1/projects')
    .send();

  expect(response.status).toBe(401);
  expect(response.body.message).toBe('API key is required');
});
```

### Testing Scopes
```typescript
it('should return 403 when API key lacks required scope', async () => {
  const { rawKey } = await createTestApiKey(prisma, 'test-project-id', {
    scopes: {
      create: [{ scope: 'messages:read' }] // Missing required scope
    }
  });

  const response = await request(app.getHttpServer())
    .post('/api/v1/projects')
    .set('X-API-Key', rawKey)
    .send(validPayload);

  expect(response.status).toBe(403);
  expect(response.body.message).toBe('Insufficient permissions');
});
```

### Testing Validation
```typescript
it('should return 400 for invalid data', async () => {
  const response = await request(app.getHttpServer())
    .post('/api/v1/projects')
    .set('X-API-Key', validApiKey)
    .send({
      name: '', // Empty name
      environment: 'invalid' // Invalid enum
    });

  expect(response.status).toBe(400);
  expect(response.body.message).toContain('Validation failed');
});
```

## Test Data Factories

```typescript
// test/factories/project.factory.ts
export const buildProject = (overrides = {}) => ({
  name: 'Test Project',
  slug: 'test-project',
  environment: 'development',
  isDefault: false,
  settings: {
    rateLimits: {
      test: 100,
      production: 1000
    }
  },
  ...overrides
});

// test/factories/api-key.factory.ts
export const buildApiKey = (overrides = {}) => ({
  name: 'Test API Key',
  environment: 'test',
  scopes: ['messages:send', 'messages:read'],
  ...overrides
});
```

## Mock Services

```typescript
// test/mocks/prisma.mock.ts
export const mockPrismaService = {
  project: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  apiKey: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn()
  }
};
```

## Common Test Scenarios

```typescript
describe('API Endpoint', () => {
  // Happy path
  it('should succeed with valid input');

  // Authentication
  it('should reject missing API key');
  it('should reject invalid API key');
  it('should reject expired API key');
  it('should reject revoked API key');

  // Authorization
  it('should reject when missing required scope');
  it('should accept when has required scope');

  // Validation
  it('should reject missing required fields');
  it('should reject invalid data types');
  it('should reject invalid enum values');

  // Business logic
  it('should handle conflicts appropriately');
  it('should track API key usage');
});
```

## Testing Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Run e2e tests
npm run test:e2e

# Run specific test file
npm test -- projects.service.spec.ts
```

## File Organization

```
src/
  projects/
    projects.controller.spec.ts  // Controller unit tests
    projects.service.spec.ts     // Service unit tests
  api-keys/
    api-keys.controller.spec.ts  // Controller unit tests
    api-keys.service.spec.ts     // Service unit tests
test/
  integration/
    projects.e2e-spec.ts         // Full flow tests
    api-keys.e2e-spec.ts         // Full flow tests
  fixtures/
    api-keys.fixture.ts
    projects.fixture.ts
  factories/
    project.factory.ts
    api-key.factory.ts
  mocks/
    prisma.mock.ts
  setup.ts                       // Global test setup
```

## Key Principles

1. **Isolate tests**: Each test should be independent
2. **Mock external services**: Use mocks for Prisma in unit tests
3. **Use factories**: Consistent test data generation
4. **Test behaviors, not implementation**: Focus on inputs/outputs
5. **Clean state**: Reset database between tests
6. **Descriptive names**: Test names should explain what and why
7. **Fast feedback**: Keep tests fast
8. **Test the actual implementation**: Don't test what we haven't built