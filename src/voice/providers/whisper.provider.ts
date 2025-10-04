import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import {
  TranscriptionProvider,
  TranscriptionResult,
  TranscriptionOptions,
} from '../interfaces/transcription-provider.interface';
import { Readable } from 'stream';
import { RateLimiterMemory } from 'rate-limiter-flexible';

@Injectable()
export class WhisperProvider implements TranscriptionProvider {
  private readonly logger = new Logger(WhisperProvider.name);
  private readonly client: OpenAI;
  readonly name = 'whisper';
  private readonly TRANSCRIPTION_TIMEOUT = 60000; // 60 seconds

  // Rate limiter: configurable requests per minute per project
  private readonly rateLimiter = new RateLimiterMemory({
    points: parseInt(process.env.WHISPER_RATE_LIMIT || '10', 10),
    duration: 60,
    keyPrefix: 'whisper-transcription',
  });

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      this.logger.warn(
        'OPENAI_API_KEY not configured - Whisper transcription will fail',
      );
    }

    this.logger.log(
      `Whisper rate limit: ${this.rateLimiter.points} requests/min per project`,
    );

    this.client = new OpenAI({
      apiKey: apiKey || 'not-configured',
    });
  }

  async transcribe(
    audioBuffer: Buffer,
    options?: TranscriptionOptions,
  ): Promise<TranscriptionResult> {
    try {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error(
          'Whisper transcription unavailable: OPENAI_API_KEY not configured',
        );
      }

      // Rate limit by projectId if provided
      if (options?.projectId) {
        try {
          await this.rateLimiter.consume(options.projectId);
        } catch (rateLimitError) {
          this.logger.warn(
            `Rate limit exceeded for project ${options.projectId}`,
          );
          throw new Error(
            'Transcription rate limit exceeded. Please try again later.',
          );
        }
      }

      this.logger.log(
        `Transcribing audio (${audioBuffer.length} bytes) with Whisper...`,
      );

      // Convert buffer to File object (required by OpenAI SDK)
      const audioFile = this.bufferToFile(
        audioBuffer,
        options?.format || 'mp3',
      );

      // Call Whisper API with timeout protection
      const transcriptionPromise = this.client.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: options?.language, // Optional language hint
        prompt: options?.prompt, // Optional context for better accuracy
        response_format: 'verbose_json', // Get detailed response with timestamps
      });

      const response = await Promise.race([
        transcriptionPromise,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Transcription timeout after 60s')),
            this.TRANSCRIPTION_TIMEOUT,
          ),
        ),
      ]);

      this.logger.log(
        `Whisper transcription successful: "${response.text.substring(0, 50)}..."`,
      );

      return {
        text: response.text,
        language: response.language,
        duration: response.duration,
        provider: this.name,
      };
    } catch (error) {
      // Categorize errors for better monitoring
      if (error.code === 'insufficient_quota') {
        this.logger.error('OpenAI quota exceeded - transcription unavailable');
        throw new Error(
          'Transcription service temporarily unavailable (quota exceeded)',
        );
      } else if (error.code === 'invalid_request_error') {
        this.logger.error(`Invalid audio format: ${error.message}`);
        throw new Error('Unsupported audio format');
      } else if (error.status === 429) {
        this.logger.error('OpenAI rate limit hit');
        throw new Error('Transcription service busy, please retry');
      }

      this.logger.error(
        `Whisper transcription failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Check if API key is configured
      if (!process.env.OPENAI_API_KEY) {
        return false;
      }

      // Optional: Could do a test API call here
      // For now, just verify configuration
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Convert Buffer to File object for OpenAI API
   */
  private bufferToFile(buffer: Buffer, format: string): File {
    // Convert Buffer to Uint8Array for browser compatibility
    const uint8Array = new Uint8Array(buffer);
    const blob = new Blob([uint8Array], {
      type: this.getMimeType(format),
    });
    return new File([blob], `audio.${format}`, {
      type: this.getMimeType(format),
    });
  }

  /**
   * Get MIME type from audio format
   */
  private getMimeType(format: string): string {
    const mimeTypes: Record<string, string> = {
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      opus: 'audio/opus',
      webm: 'audio/webm',
      m4a: 'audio/m4a',
      flac: 'audio/flac',
    };

    return mimeTypes[format.toLowerCase()] || 'audio/mpeg';
  }
}
