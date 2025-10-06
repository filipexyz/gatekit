import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Local Authentication (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Clean all local auth users
    await prisma.user.deleteMany({
      where: { passwordHash: { not: null } },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /api/v1/auth/signup', () => {
    it('should create first user as admin', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({
          email: 'admin@test.com',
          password: 'Admin123',
          name: 'Admin User',
        })
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.accessToken).toBeTruthy();
      expect(response.body.user).toEqual({
        id: expect.any(String),
        email: 'admin@test.com',
        name: 'Admin User',
        isAdmin: true, // First user is admin
      });
    });

    it('should reject second signup attempt', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({
          email: 'user@test.com',
          password: 'User1234',
          name: 'Regular User',
        })
        .expect(409)
        .expect((res) => {
          expect(res.body.message).toBe(
            'Signup is disabled. Please contact your administrator for an invitation.',
          );
        });
    });

    it('should reject duplicate email', async () => {
      // Since only first signup is allowed, this now returns "Signup is disabled"
      await request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({
          email: 'admin@test.com',
          password: 'Admin123',
          name: 'Duplicate',
        })
        .expect(409)
        .expect((res) => {
          expect(res.body.message).toBe(
            'Signup is disabled. Please contact your administrator for an invitation.',
          );
        });
    });

    it('should reject password without uppercase', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({
          email: 'weak@test.com',
          password: 'weakpass123',
          name: 'Weak',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain(
            'Password must contain at least one uppercase letter',
          );
        });
    });

    it('should reject password without number', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({
          email: 'weak@test.com',
          password: 'WeakPass',
          name: 'Weak',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain(
            'Password must contain at least one number',
          );
        });
    });

    it('should reject password less than 8 characters', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({
          email: 'short@test.com',
          password: 'Abc123',
          name: 'Short',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain(
            'Password must be at least 8 characters long',
          );
        });
    });

    it('should reject invalid email', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({
          email: 'not-an-email',
          password: 'Valid123',
          name: 'Invalid',
        })
        .expect(400)
        .expect((res) => {
          // NestJS validation returns message as array
          const message = Array.isArray(res.body.message)
            ? res.body.message.join(' ')
            : res.body.message;
          expect(message).toContain('email');
        });
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'Admin123',
        })
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.accessToken).toBeTruthy();
      expect(response.body.user).toEqual({
        id: expect.any(String),
        email: 'admin@test.com',
        name: 'Admin User',
        isAdmin: true,
      });
    });

    it('should reject invalid email', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'Admin123',
        })
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toBe('Invalid credentials');
        });
    });

    it('should reject invalid password', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'WrongPassword123',
        })
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toBe('Invalid credentials');
        });
    });

    it('should reject Auth0 user trying local login', async () => {
      // Create Auth0 user (no passwordHash)
      await prisma.user.create({
        data: {
          email: 'auth0@test.com',
          auth0Id: 'auth0|123456',
          name: 'Auth0 User',
        },
      });

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'auth0@test.com',
          password: 'AnyPassword123',
        })
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toBe('Invalid credentials');
        });
    });
  });

  describe('JWT Authentication', () => {
    let accessToken: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'Admin123',
        });

      accessToken = response.body.accessToken;
    });

    it('should authenticate with valid JWT token', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/whoami')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toEqual({
        authType: 'jwt',
        permissions: [],
        user: {
          userId: expect.any(String),
          email: 'admin@test.com',
          name: 'Admin User',
        },
      });
    });

    it('should reject invalid JWT token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/whoami')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toBe('Invalid or expired token');
        });
    });

    it('should reject request without authorization header', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/whoami')
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toBe(
            'Authentication required. Provide either an API key or Bearer token.',
          );
        });
    });
  });

  describe('First User Logic', () => {
    beforeAll(async () => {
      // Clean all local auth users again
      await prisma.user.deleteMany({
        where: { passwordHash: { not: null } },
      });
    });

    it('should make first local user admin even with Auth0 users present', async () => {
      // Create some Auth0 users first
      await prisma.user.createMany({
        data: [
          {
            email: 'auth0-1@test.com',
            auth0Id: 'auth0|111',
            name: 'Auth0 User 1',
          },
          {
            email: 'auth0-2@test.com',
            auth0Id: 'auth0|222',
            name: 'Auth0 User 2',
          },
        ],
      });

      // First LOCAL user should still be admin
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({
          email: 'first-local@test.com',
          password: 'First123',
          name: 'First Local',
        })
        .expect(201);

      expect(response.body.user.isAdmin).toBe(true);
    });
  });
});
