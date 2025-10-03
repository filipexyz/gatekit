import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import {
  PlatformProvider,
  PlatformLifecycleEvent,
} from '../interfaces/platform-provider.interface';
import { PlatformAdapter } from '../interfaces/platform-adapter.interface';
import type { IEventBus } from '../interfaces/event-bus.interface';
import { EVENT_BUS } from '../interfaces/event-bus.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformProviderDecorator } from '../decorators/platform-provider.decorator';
import { MessageEnvelopeV1 } from '../interfaces/message-envelope.interface';
import { makeEnvelope } from '../utils/envelope.factory';
import { PlatformLogsService } from '../services/platform-logs.service';
import { PlatformLogger } from '../utils/platform-logger';
import { AttachmentUtil } from '../../common/utils/attachment.util';
import { AttachmentDto } from '../dto/send-message.dto';
import { PlatformCapability } from '../enums/platform-capability.enum';
import { PlatformType } from '../../common/enums/platform-type.enum';
import { PlatformOptionsDecorator } from '../decorators/platform-options.decorator';
import { EmailPlatformOptions } from './email-platform-options.dto';

interface EmailSmtpCredentials {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean; // true for 465, false for 587/25
  smtpUser: string;
  smtpPassword: string;
  fromEmail: string;
  fromName?: string;
}

interface EmailConnection {
  connectionKey: string; // projectId:platformId
  projectId: string;
  platformId: string;
  transporter: Transporter;
  fromEmail: string;
  fromName?: string;
  isConnected: boolean;
  lastActivity: Date;
}

@Injectable()
@PlatformProviderDecorator(PlatformType.EMAIL, [
  { capability: PlatformCapability.SEND_MESSAGE },
  {
    capability: PlatformCapability.ATTACHMENTS,
    limitations: 'Max 25MB (Gmail), 10MB (Outlook), varies by provider',
  },
])
@PlatformOptionsDecorator(EmailPlatformOptions)
export class EmailProvider implements PlatformProvider, PlatformAdapter {
  private readonly logger = new Logger(EmailProvider.name);
  private readonly connections = new Map<string, EmailConnection>();

  readonly name = PlatformType.EMAIL;
  readonly displayName = 'Email (SMTP)';
  readonly connectionType = 'http' as const;
  readonly channel = PlatformType.EMAIL;

  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
    private readonly prisma: PrismaService,
    private readonly platformLogsService: PlatformLogsService,
  ) {}

  async initialize(): Promise<void> {
    this.logger.log('Email (SMTP) provider initialized');
  }

  async onPlatformEvent(event: PlatformLifecycleEvent): Promise<void> {
    this.logger.log(
      `Email platform event: ${event.type} for ${event.projectId}:${event.platformId}`,
    );

    const connectionKey = `${event.projectId}:${event.platformId}`;

    if (event.type === 'created' || event.type === 'activated') {
      // Create SMTP connection
      try {
        await this.createAdapter(connectionKey, event.credentials);
        this.logger.log(`Email SMTP connection created for ${connectionKey}`);
      } catch (error) {
        this.logger.error(
          `Failed to create email connection for ${connectionKey}: ${error.message}`,
        );
      }
    } else if (event.type === 'updated') {
      // Recreate connection with new credentials
      try {
        if (this.connections.has(connectionKey)) {
          await this.removeAdapter(connectionKey);
        }
        await this.createAdapter(connectionKey, event.credentials);
        this.logger.log(`Email SMTP connection updated for ${connectionKey}`);
      } catch (error) {
        this.logger.error(
          `Failed to update email connection for ${connectionKey}: ${error.message}`,
        );
      }
    } else if (event.type === 'deactivated' || event.type === 'deleted') {
      // Close SMTP connection
      try {
        await this.removeAdapter(connectionKey);
        this.logger.log(`Email SMTP connection removed for ${connectionKey}`);
      } catch (error) {
        this.logger.error(
          `Failed to remove email connection for ${connectionKey}: ${error.message}`,
        );
      }
    }
  }

  private createPlatformLogger(
    projectId: string,
    platformId?: string,
  ): PlatformLogger {
    return PlatformLogger.create(this.platformLogsService, {
      projectId,
      platformId,
      platform: this.name,
    });
  }

  async shutdown(): Promise<void> {
    this.logger.log('Shutting down Email provider...');

    const promises: Promise<void>[] = [];
    for (const connectionKey of this.connections.keys()) {
      promises.push(this.removeAdapter(connectionKey));
    }

    await Promise.all(promises);
    this.logger.log('Email provider shut down');
  }

  async createAdapter(
    connectionKey: string,
    credentials: any,
  ): Promise<PlatformAdapter> {
    const existingConnection = this.connections.get(connectionKey);

    if (existingConnection) {
      return this;
    }

    // Parse connectionKey to get projectId and platformId
    const [projectId, platformId] = connectionKey.split(':');

    // Validate credentials
    this.validateSmtpCredentials(credentials);

    // Create Nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: credentials.smtpHost,
      port: credentials.smtpPort,
      secure: credentials.smtpSecure,
      auth: {
        user: credentials.smtpUser,
        pass: credentials.smtpPassword,
      },
      // Connection pool settings
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });

    const connection: EmailConnection = {
      connectionKey,
      projectId,
      platformId,
      transporter,
      fromEmail: credentials.fromEmail,
      fromName: credentials.fromName,
      isConnected: false,
      lastActivity: new Date(),
    };

    // Store connection
    this.connections.set(connectionKey, connection);

    try {
      // Verify SMTP connection
      await transporter.verify();
      connection.isConnected = true;

      const platformLogger = this.createPlatformLogger(projectId, platformId);
      platformLogger.logConnection(
        `Email SMTP connection created for ${connectionKey}`,
        {
          connectionKey,
          smtpHost: credentials.smtpHost,
          smtpPort: credentials.smtpPort,
          fromEmail: credentials.fromEmail,
        },
      );

      this.logger.log(`Email SMTP connection created for ${connectionKey}`);
      return this;
    } catch (error) {
      const platformLogger = this.createPlatformLogger(projectId, platformId);
      platformLogger.errorConnection(
        `Failed to create Email SMTP connection for ${connectionKey}`,
        error,
        {
          connectionKey,
          smtpHost: credentials.smtpHost,
          smtpPort: credentials.smtpPort,
        },
      );

      this.logger.error(
        `Failed to create Email SMTP connection for ${connectionKey}: ${error.message}`,
      );
      this.connections.delete(connectionKey);
      throw error;
    }
  }

  getAdapter(connectionKey: string): PlatformAdapter | undefined {
    const connection = this.connections.get(connectionKey);
    return connection ? this : undefined;
  }

  async removeAdapter(connectionKey: string): Promise<void> {
    const connection = this.connections.get(connectionKey);
    if (!connection) return;

    this.logger.log(`Removing Email SMTP connection for ${connectionKey}`);

    try {
      // Close SMTP connection pool
      connection.transporter.close();
      this.logger.debug(
        `Email SMTP connection closed for ${connectionKey}`,
      );
    } catch (error) {
      this.logger.error(
        `Error closing Email SMTP connection for ${connectionKey}: ${error.message}`,
      );
    } finally {
      this.connections.delete(connectionKey);
      this.logger.debug(
        `Connection removed from registry for ${connectionKey}`,
      );
    }
  }

  async isHealthy(): Promise<boolean> {
    // Check if we have any active connections
    for (const connection of this.connections.values()) {
      if (connection.isConnected) {
        return true;
      }
    }
    return true; // Provider is healthy even without connections
  }

  getConnectionStats() {
    return {
      totalConnections: this.connections.size,
      connections: Array.from(this.connections.entries()).map(
        ([connectionKey, conn]) => ({
          connectionKey,
          fromEmail: conn.fromEmail,
          isConnected: conn.isConnected,
          lastActivity: conn.lastActivity,
        }),
      ),
    };
  }

  // PlatformAdapter interface methods
  async start(): Promise<void> {
    this.logger.log('Email provider/adapter started');
  }

  toEnvelope(msg: any, projectId: string): MessageEnvelopeV1 {
    // Email doesn't receive messages in SMTP-only mode
    // This would be used if we add IMAP support later
    return makeEnvelope({
      channel: PlatformType.EMAIL,
      projectId,
      threadId: msg.from || 'unknown',
      user: {
        providerUserId: msg.from || 'unknown',
        display: msg.fromName || msg.from || 'Email User',
      },
      message: {
        text: msg.text || msg.subject || '',
      },
      provider: {
        eventId: msg.messageId || `email-${Date.now()}`,
        raw: msg,
      },
    });
  }

  async sendMessage(
    env: MessageEnvelopeV1,
    reply: {
      subject?: string;
      text?: string;
      markdown?: string;
      html?: string;
      attachments?: any[];
      buttons?: any[];
      embeds?: any[];
      threadId?: string;
      replyTo?: string;
      silent?: boolean;
      platformOptions?: {
        email?: EmailPlatformOptions;
      };
    },
  ): Promise<{ providerMessageId: string }> {
    const platformId = (env.provider?.raw as any)?.platformId;
    if (!platformId) {
      this.logger.error('No platformId in envelope, cannot route message');
      throw new Error('No platformId in envelope, cannot route message');
    }

    const connectionKey = `${env.projectId}:${platformId}`;
    const connection = this.connections.get(connectionKey);

    if (!connection || !connection.isConnected) {
      throw new Error(
        `Email SMTP not connected for ${connectionKey}, cannot send message`,
      );
    }

    try {
      const toEmail = reply.threadId ?? env.threadId;
      if (!toEmail || !this.isValidEmail(toEmail)) {
        throw new Error(`Invalid recipient email address: ${toEmail}`);
      }

      // VALIDATION: Email requires subject
      if (!reply.subject) {
        throw new Error('Email platform requires content.subject field');
      }

      // Extract platform-specific options
      const emailOptions = reply.platformOptions?.email as EmailPlatformOptions;

      // Prefer HTML, fallback to markdown (basic conversion), fallback to text
      let bodyHtml: string | undefined;
      let bodyText: string;

      if (reply.html) {
        bodyHtml = reply.html;
        bodyText = reply.text || reply.subject;
      } else if (reply.markdown) {
        // Basic markdown to HTML conversion (wrap in pre for now)
        bodyHtml = `<pre>${this.escapeHtml(reply.markdown)}</pre>`;
        bodyText = reply.markdown;
      } else {
        bodyText = reply.text || reply.subject;
      }

      // Process attachments
      const attachments = await this.processEmailAttachments(
        reply.attachments || [],
      );

      const platformLogger = this.createPlatformLogger(
        env.projectId,
        platformId,
      );

      // Build mail options
      const mailOptions = {
        from: connection.fromName
          ? `${connection.fromName} <${connection.fromEmail}>`
          : connection.fromEmail,
        to: toEmail,
        cc: emailOptions?.cc,
        bcc: emailOptions?.bcc,
        replyTo: emailOptions?.replyTo,
        subject: reply.subject,
        text: bodyText,
        html: bodyHtml,
        attachments,
        headers: emailOptions?.headers,
      };

      const result = await connection.transporter.sendMail(mailOptions);
      connection.lastActivity = new Date();

      platformLogger.logMessage(`Email sent successfully to ${toEmail}`, {
        messageId: result.messageId,
        to: toEmail,
        cc: emailOptions?.cc,
        bcc: emailOptions?.bcc,
        subject: reply.subject,
        attachmentCount: attachments.length,
      });

      this.logger.log(
        `Email sent successfully to ${toEmail}: ${result.messageId}`,
      );

      return { providerMessageId: result.messageId };
    } catch (error) {
      const platformLogger = this.createPlatformLogger(
        env.projectId,
        platformId,
      );
      platformLogger.errorMessage(
        `Failed to send email to ${reply.threadId ?? env.threadId}`,
        error,
        {
          to: reply.threadId ?? env.threadId,
          messageText: reply.text?.substring(0, 100),
        },
      );

      this.logger.error('Failed to send email:', error.message);
      throw error;
    }
  }

  /**
   * Validate SMTP credentials
   */
  private validateSmtpCredentials(credentials: any): void {
    const required = [
      'smtpHost',
      'smtpPort',
      'smtpUser',
      'smtpPassword',
      'fromEmail',
    ];

    for (const field of required) {
      if (!credentials[field]) {
        throw new Error(`Missing required SMTP credential: ${field}`);
      }
    }

    // Validate email format
    if (!this.isValidEmail(credentials.fromEmail)) {
      throw new Error(`Invalid fromEmail address: ${credentials.fromEmail}`);
    }

    // Validate port
    if (
      typeof credentials.smtpPort !== 'number' ||
      credentials.smtpPort < 1 ||
      credentials.smtpPort > 65535
    ) {
      throw new Error(`Invalid SMTP port: ${credentials.smtpPort}`);
    }

    // Ensure smtpSecure is boolean
    if (credentials.smtpSecure === undefined) {
      credentials.smtpSecure = credentials.smtpPort === 465;
    }
  }

  /**
   * Validate email address format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Process email attachments
   */
  private async processEmailAttachments(
    attachments: AttachmentDto[],
  ): Promise<any[]> {
    const emailAttachments: any[] = [];

    for (const attachment of attachments) {
      try {
        let content: string | Buffer;
        let filename: string;

        // Handle URL-based attachments
        if (attachment.url) {
          await AttachmentUtil.validateAttachmentUrl(attachment.url);
          // Nodemailer can handle URLs directly
          content = attachment.url;
          filename =
            attachment.filename ||
            AttachmentUtil.getFilenameFromUrl(attachment.url);
        }
        // Handle base64 data attachments
        else if (attachment.data) {
          AttachmentUtil.validateBase64Data(attachment.data);
          content = AttachmentUtil.base64ToBuffer(attachment.data);
          filename = attachment.filename || 'file';
        } else {
          this.logger.warn('Attachment has no url or data, skipping');
          continue;
        }

        emailAttachments.push({
          filename,
          content,
          contentType: attachment.mimeType,
        });
      } catch (error) {
        this.logger.error(`Failed to process attachment: ${error.message}`);
        // Continue with other attachments
      }
    }

    return emailAttachments;
  }
}
