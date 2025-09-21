# Testing Guidelines for GateKit Backend

## CRITICAL Testing Rules

### Determinism is Non-Negotiable
- **Every test MUST be deterministic** - No conditional assertions or multiple acceptable outcomes
- **NEVER accept multiple status codes** - Each test must expect exactly one specific status code
- **Study implementation before writing tests** - Read the actual code to understand exact behavior
- **Tests must be reliable** - Double-check all assertions match actual implementation
- **NEVER write tests with security breaches** - Don't bypass authentication/authorization in tests

## Test Organization

### Directory Structure
```
test/
├── fixtures/           # Reusable test data generators
│   ├── projects.fixture.ts
│   └── api-keys.fixture.ts
├── integration/        # End-to-end integration tests
│   └── app.e2e-spec.ts
├── app.e2e-spec.ts    # Basic app tests
└── jest-e2e.json      # Jest config for e2e tests
```

### Unit Tests
- Located alongside source files (`*.spec.ts`)
- Test individual services, controllers, guards
- Mock all external dependencies
- Focus on business logic

### Integration Tests
- Located in `test/integration/`
- Test complete request/response cycles
- Use real database (cleaned between tests)
- Verify authentication, authorization, and data flow

## Running Tests

### Commands
```bash
npm test                  # Run unit tests
npm run test:watch       # Run tests in watch mode
npm run test:cov         # Run tests with coverage
npm run test:e2e         # Run integration tests
```

### Environment
- **ALWAYS run tests locally** - Never inside Docker containers
- Start databases separately: `docker compose up -d postgres redis`
- Run application locally: `npm run start:dev`

## Writing Tests

### General Guidelines
- **ONLY test what exists** - Don't write tests for unimplemented features
- Use fixtures for consistent test data generation
- Mock external dependencies in unit tests
- Test actual behavior, not implementation details
- Verify both success and failure cases
- Clean database state between tests

### Authentication & Authorization Tests
- Test authentication (401) and authorization (403) separately
- Always include API key in headers for protected endpoints
- Test with invalid keys, expired keys, and revoked keys
- Verify scope-based authorization works correctly

### Expected HTTP Status Codes
- **200** - Success (GET, PATCH)
- **201** - Created (POST)
- **204** - No Content (DELETE)
- **400** - Bad Request (validation errors)
- **401** - Unauthorized (missing/invalid API key)
- **403** - Forbidden (valid API key but insufficient permissions)
- **404** - Not Found (resource doesn't exist)
- **409** - Conflict (duplicate resource)

### Example: Proper Authentication Test
```typescript
describe('Authentication', () => {
  it('should reject requests without API key', () => {
    return request(app.getHttpServer())
      .get('/api/v1/projects')
      .expect(401) // EXACTLY 401, not 401 or 403
      .expect((res) => {
        expect(res.body.message).toBe('API key is required'); // EXACT message
      });
  });

  it('should reject requests with invalid API key', () => {
    return request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('X-API-Key', 'invalid-key')
      .expect(401) // Invalid key = 401
      .expect((res) => {
        expect(res.body.message).toBe('Invalid API key');
      });
  });
});
```

### Example: Proper Authorization Test
```typescript
describe('Authorization', () => {
  it('should reject valid API key without required scope', async () => {
    const { rawKey } = await createTestApiKey(prisma, projectId, {
      scopes: ['messages:read'], // Missing projects:write
    });

    return request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('X-API-Key', rawKey)
      .send(projectData)
      .expect(403) // Valid key but no permission = 403
      .expect((res) => {
        expect(res.body.message).toBe('Insufficient permissions');
      });
  });
});
```

## Security Testing

### Manual Verification
After making changes, always verify security features:

```bash
# Test API key authentication
curl -s http://localhost:3000/api/v1/projects
# Expected: 401 {"message":"API key is required"}

# Test with invalid key
curl -s -H "X-API-Key: invalid" http://localhost:3000/api/v1/projects
# Expected: 401 {"message":"Invalid API key"}

# Test with valid key
curl -H "X-API-Key: <your-key>" http://localhost:3000/api/v1/projects
# Expected: 200 with data

# Test CORS with unauthorized origin
curl -H "Origin: http://evil.com" -I http://localhost:3000/api/v1/projects
# Expected: No Access-Control-Allow-Origin header

# Test rate limiting
for i in {1..110}; do curl -H "X-API-Key: <key>" http://localhost:3000/api/v1/projects; done
# Expected: 429 Too Many Requests after limit
```

### Security Test Checklist
- [ ] All endpoints require authentication (except /health)
- [ ] Invalid API keys return 401, not 500
- [ ] Expired/revoked keys are rejected
- [ ] Scope authorization returns 403 for insufficient permissions
- [ ] Rate limiting is enforced
- [ ] CORS only allows configured origins
- [ ] No sensitive data in error messages
- [ ] API keys are properly hashed in database

## Test Coverage Requirements

### Minimum Coverage
- Services: 80%
- Controllers: 70%
- Guards: 90%
- Overall: 75%

### What to Test
- All success paths
- All error conditions
- Edge cases (empty arrays, nulls, boundaries)
- Security scenarios (auth failures, invalid data)
- Database constraints (uniqueness, foreign keys)

### What NOT to Test
- NestJS framework internals
- Third-party library behavior
- Database/Redis connection logic
- Simple getters/setters with no logic

## Common Mistakes to Avoid

### ❌ WRONG: Accepting multiple outcomes
```typescript
// NEVER DO THIS
.expect((res) => {
  expect([401, 403]).toContain(res.status); // NON-DETERMINISTIC!
});
```

### ✅ CORRECT: Expecting exact outcome
```typescript
// ALWAYS DO THIS
.expect(403) // Exactly one expected status
.expect((res) => {
  expect(res.body.message).toBe('Insufficient permissions'); // Exact message
});
```

### ❌ WRONG: Testing without reading implementation
```typescript
// Guessing at behavior
.expect(200) // Maybe it returns 201?
```

### ✅ CORRECT: Implementation-based testing
```typescript
// After checking controller has @HttpCode(200)
.expect(200) // Confident in expected status
```

### ❌ WRONG: Bypassing security in tests
```typescript
// Skipping authentication for convenience
const result = await service.create(data); // Direct service call
```

### ✅ CORRECT: Testing through proper channels
```typescript
// Going through authentication guard
return request(app.getHttpServer())
  .post('/api/v1/resource')
  .set('X-API-Key', validApiKey) // Proper auth
  .send(data)
  .expect(201);
```

## Debugging Failed Tests

### Steps to Debug
1. Run single test: `npm test -- --testNamePattern="should create"`
2. Check actual vs expected status code
3. Read the implementation code
4. Verify test fixtures are correct
5. Check database state if integration test
6. Add console.log to see actual response
7. Ensure services are mocked correctly

### Common Issues
- **401 instead of 403**: Check if API key is actually valid
- **500 errors**: Check for missing mocks or database issues
- **Timeout errors**: Increase Jest timeout or check async operations
- **Database conflicts**: Ensure proper cleanup between tests