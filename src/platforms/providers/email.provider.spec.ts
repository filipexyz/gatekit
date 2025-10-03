import { Test, TestingModule } from '@nestjs/testing';
import { EmailProvider } from './email.provider';
import { EVENT_BUS } from '../interfaces/event-bus.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformLogsService } from '../services/platform-logs.service';
import * as nodemailer from 'nodemailer';

// Mock nodemailer
jest.mock('nodemailer');

describe('EmailProvider', () => {
  let provider: EmailProvider;
  let eventBus: any;
  let prisma: any;

  const mockTransporter = {
    verify: jest.fn().mockResolvedValue(true),
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    close: jest.fn(),
  };

  const mockEventBus = {
    publish: jest.fn(),
  };

  const mockPrisma = {
    projectPlatform: {
      findUnique: jest.fn(),
    },
  };

  const mockPlatformLogsService = {
    logActivity: jest.fn().mockResolvedValue(undefined),
  };

  const validCredentials = {
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: 'test@example.com',
    smtpPassword: 'test-password',
    fromEmail: 'test@example.com',
    fromName: 'Test Sender',
  };

  beforeEach(async () => {
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProvider,
        {
          provide: EVENT_BUS,
          useValue: mockEventBus,
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: PlatformLogsService,
          useValue: mockPlatformLogsService,
        },
      ],
    }).compile();

    provider = module.get<EmailProvider>(EmailProvider);
    eventBus = module.get(EVENT_BUS);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  afterEach(async () => {
    await provider.shutdown();
  });

  describe('Platform Metadata', () => {
    it('should have correct platform metadata', () => {
      expect(provider.name).toBe('email');
      expect(provider.displayName).toBe('Email (SMTP)');
      expect(provider.connectionType).toBe('http');
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await expect(provider.initialize()).resolves.toBeUndefined();
    });
  });

  describe('SMTP Connection Management', () => {
    it('should create SMTP connection with valid credentials', async () => {
      const connectionKey = 'project-1:platform-1';

      await provider.createAdapter(connectionKey, validCredentials);

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: validCredentials.smtpHost,
          port: validCredentials.smtpPort,
          secure: validCredentials.smtpSecure,
          auth: {
            user: validCredentials.smtpUser,
            pass: validCredentials.smtpPassword,
          },
        }),
      );
      expect(mockTransporter.verify).toHaveBeenCalled();
    });

    it('should reject invalid credentials (missing smtpHost)', async () => {
      const invalidCredentials = { ...validCredentials };
      delete invalidCredentials.smtpHost;

      await expect(
        provider.createAdapter('project-1:platform-1', invalidCredentials),
      ).rejects.toThrow('Missing required SMTP credential: smtpHost');
    });

    it('should reject invalid email address', async () => {
      const invalidCredentials = {
        ...validCredentials,
        fromEmail: 'invalid-email',
      };

      await expect(
        provider.createAdapter('project-1:platform-1', invalidCredentials),
      ).rejects.toThrow('Invalid fromEmail address');
    });

    it('should reject invalid port number', async () => {
      const invalidCredentials = {
        ...validCredentials,
        smtpPort: 99999,
      };

      await expect(
        provider.createAdapter('project-1:platform-1', invalidCredentials),
      ).rejects.toThrow('Invalid SMTP port');
    });

    it('should auto-set smtpSecure based on port 465', async () => {
      const credentials = { ...validCredentials, smtpPort: 465 };
      delete credentials.smtpSecure;

      await provider.createAdapter('project-1:platform-1', credentials);

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          secure: true,
        }),
      );
    });

    it('should return existing connection if already created', async () => {
      const connectionKey = 'project-1:platform-1';

      const adapter1 = await provider.createAdapter(
        connectionKey,
        validCredentials,
      );
      const adapter2 = await provider.createAdapter(
        connectionKey,
        validCredentials,
      );

      expect(adapter1).toBe(adapter2);
      expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
    });

    it('should get existing adapter', async () => {
      const connectionKey = 'project-1:platform-1';

      await provider.createAdapter(connectionKey, validCredentials);
      const adapter = provider.getAdapter(connectionKey);

      expect(adapter).toBe(provider);
    });

    it('should remove adapter and close SMTP connection', async () => {
      const connectionKey = 'project-1:platform-1';

      await provider.createAdapter(connectionKey, validCredentials);
      await provider.removeAdapter(connectionKey);

      expect(mockTransporter.close).toHaveBeenCalled();
      expect(provider.getAdapter(connectionKey)).toBeUndefined();
    });
  });

  describe('Send Email', () => {
    beforeEach(async () => {
      await provider.createAdapter('project-1:platform-1', validCredentials);
    });

    it('should send email successfully', async () => {
      const envelope = {
        projectId: 'project-1',
        threadId: 'recipient@example.com',
        provider: {
          raw: { platformId: 'platform-1' },
        },
      } as any;

      const reply = {
        subject: 'Test Subject',
        text: 'Test email body',
      };

      const result = await provider.sendMessage(envelope, reply);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'Test Sender <test@example.com>',
          to: 'recipient@example.com',
          subject: 'Test Subject',
          text: 'Test email body',
        }),
      );
      expect(result.providerMessageId).toBe('test-message-id');
    });

    it('should require subject field', async () => {
      const envelope = {
        projectId: 'project-1',
        threadId: 'recipient@example.com',
        provider: {
          raw: { platformId: 'platform-1' },
        },
      } as any;

      const reply = {
        text: 'Email without subject',
      };

      await expect(provider.sendMessage(envelope, reply)).rejects.toThrow(
        'Email platform requires content.subject field',
      );
    });

    it('should send email with attachments', async () => {
      const envelope = {
        projectId: 'project-1',
        threadId: 'recipient@example.com',
        provider: {
          raw: { platformId: 'platform-1' },
        },
      } as any;

      const reply = {
        subject: 'Email with attachment',
        text: 'See attached file',
        attachments: [
          {
            url: 'https://example.com/file.pdf',
            filename: 'document.pdf',
          },
        ],
      };

      await provider.sendMessage(envelope, reply);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Email with attachment',
          attachments: expect.arrayContaining([
            expect.objectContaining({
              filename: 'document.pdf',
            }),
          ]),
        }),
      );
    });

    it('should send HTML email', async () => {
      const envelope = {
        projectId: 'project-1',
        threadId: 'recipient@example.com',
        provider: {
          raw: { platformId: 'platform-1' },
        },
      } as any;

      const reply = {
        subject: 'HTML Email',
        text: 'Plain text version',
        html: '<h1>HTML version</h1><p>Rich content</p>',
      };

      await provider.sendMessage(envelope, reply);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'HTML Email',
          text: 'Plain text version',
          html: '<h1>HTML version</h1><p>Rich content</p>',
        }),
      );
    });

    it('should send markdown email (converted to HTML)', async () => {
      const envelope = {
        projectId: 'project-1',
        threadId: 'recipient@example.com',
        provider: {
          raw: { platformId: 'platform-1' },
        },
      } as any;

      const reply = {
        subject: 'Markdown Email',
        markdown: '# Heading\n\nParagraph text',
      };

      await provider.sendMessage(envelope, reply);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Markdown Email',
          text: '# Heading\n\nParagraph text',
          html: expect.stringContaining('# Heading'),
        }),
      );
    });

    it('should send email with platform options (CC, BCC, replyTo)', async () => {
      const envelope = {
        projectId: 'project-1',
        threadId: 'recipient@example.com',
        provider: {
          raw: { platformId: 'platform-1' },
        },
      } as any;

      const reply = {
        subject: 'Test Email',
        text: 'Test body',
        platformOptions: {
          email: {
            cc: ['cc@example.com'],
            bcc: ['bcc@example.com'],
            replyTo: 'noreply@example.com',
          },
        },
      };

      await provider.sendMessage(envelope, reply);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          cc: ['cc@example.com'],
          bcc: ['bcc@example.com'],
          replyTo: 'noreply@example.com',
        }),
      );
    });

    it('should reject invalid recipient email', async () => {
      const envelope = {
        projectId: 'project-1',
        threadId: 'invalid-email',
        provider: {
          raw: { platformId: 'platform-1' },
        },
      } as any;

      const reply = {
        subject: 'Test',
        text: 'Test email',
      };

      await expect(provider.sendMessage(envelope, reply)).rejects.toThrow(
        'Invalid recipient email address',
      );
    });

    it('should throw error if no platformId in envelope', async () => {
      const envelope = {
        projectId: 'project-1',
        threadId: 'recipient@example.com',
        provider: {
          raw: {},
        },
      } as any;

      const reply = {
        text: 'Test email',
      };

      await expect(provider.sendMessage(envelope, reply)).rejects.toThrow(
        'No platformId in envelope',
      );
    });

    it('should throw error if connection not found', async () => {
      const envelope = {
        projectId: 'project-1',
        threadId: 'recipient@example.com',
        provider: {
          raw: { platformId: 'non-existent-platform' },
        },
      } as any;

      const reply = {
        text: 'Test email',
      };

      await expect(provider.sendMessage(envelope, reply)).rejects.toThrow(
        'Email SMTP not connected',
      );
    });
  });

  describe('Health Check', () => {
    it('should report healthy when connections exist', async () => {
      await provider.createAdapter('project-1:platform-1', validCredentials);

      const healthy = await provider.isHealthy();

      expect(healthy).toBe(true);
    });

    it('should report healthy even without connections', async () => {
      const healthy = await provider.isHealthy();

      expect(healthy).toBe(true);
    });
  });

  describe('Connection Stats', () => {
    it('should return connection statistics', async () => {
      await provider.createAdapter('project-1:platform-1', validCredentials);
      await provider.createAdapter('project-2:platform-2', validCredentials);

      const stats = provider.getConnectionStats();

      expect(stats.totalConnections).toBe(2);
      expect(stats.connections).toHaveLength(2);
      expect(stats.connections[0]).toMatchObject({
        connectionKey: 'project-1:platform-1',
        fromEmail: 'test@example.com',
        isConnected: true,
      });
    });
  });

  describe('Platform Lifecycle Events', () => {
    it('should handle platform created event', async () => {
      const event = {
        type: 'created' as const,
        projectId: 'project-1',
        platformId: 'platform-1',
        platform: 'email',
        credentials: validCredentials,
      };

      await provider.onPlatformEvent(event);

      expect(nodemailer.createTransport).toHaveBeenCalled();
    });

    it('should handle platform updated event', async () => {
      const connectionKey = 'project-1:platform-1';

      await provider.createAdapter(connectionKey, validCredentials);

      const updatedCredentials = {
        ...validCredentials,
        fromName: 'Updated Sender',
      };

      const event = {
        type: 'updated' as const,
        projectId: 'project-1',
        platformId: 'platform-1',
        platform: 'email',
        credentials: updatedCredentials,
      };

      await provider.onPlatformEvent(event);

      expect(mockTransporter.close).toHaveBeenCalled();
      expect(nodemailer.createTransport).toHaveBeenCalledTimes(2);
    });

    it('should handle platform deleted event', async () => {
      const connectionKey = 'project-1:platform-1';

      await provider.createAdapter(connectionKey, validCredentials);

      const event = {
        type: 'deleted' as const,
        projectId: 'project-1',
        platformId: 'platform-1',
        platform: 'email',
        credentials: validCredentials,
      };

      await provider.onPlatformEvent(event);

      expect(mockTransporter.close).toHaveBeenCalled();
      expect(provider.getAdapter(connectionKey)).toBeUndefined();
    });
  });

  describe('Project Isolation', () => {
    it('should isolate connections between projects', async () => {
      await provider.createAdapter('project-1:platform-1', validCredentials);
      await provider.createAdapter('project-2:platform-2', validCredentials);

      const adapter1 = provider.getAdapter('project-1:platform-1');
      const adapter2 = provider.getAdapter('project-2:platform-2');

      expect(adapter1).toBe(provider);
      expect(adapter2).toBe(provider);
      expect(nodemailer.createTransport).toHaveBeenCalledTimes(2);
    });
  });

});
