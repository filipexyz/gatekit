import { Injectable, Logger } from '@nestjs/common';
import { WhisperProvider } from '../providers/whisper.provider';
import {
  TranscriptionProvider,
  TranscriptionResult,
  TranscriptionOptions,
} from '../interfaces/transcription-provider.interface';
import axios from 'axios';

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);
  private readonly providers: TranscriptionProvider[];
  private readonly MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB Whisper limit
  private readonly WARN_FILE_SIZE = 10 * 1024 * 1024; // 10MB warning threshold

  // Metrics tracking
  private transcriptionCount = 0;
  private totalAudioSize = 0;
  private totalDuration = 0;

  constructor(private readonly whisperProvider: WhisperProvider) {
    // Initialize provider chain (currently only Whisper, can add more later)
    this.providers = [whisperProvider];
  }

  /**
   * Transcribe audio from URL or buffer with fallback chain
   */
  async transcribe(
    audioSource: string | Buffer,
    options?: TranscriptionOptions,
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();
    let audioSize = 0;

    try {
      // If audioSource is URL, download it first
      let audioBuffer: Buffer;

      if (typeof audioSource === 'string') {
        this.logger.log(
          `Downloading audio from URL: ${audioSource.substring(0, 100)}...`,
        );
        audioBuffer = await this.downloadAudio(audioSource);
      } else {
        audioBuffer = audioSource;
      }

      audioSize = audioBuffer.length;

      // Validate file size BEFORE sending to API
      if (audioBuffer.length > this.MAX_FILE_SIZE) {
        throw new Error(
          `Audio file too large (${(audioBuffer.length / 1024 / 1024).toFixed(2)}MB). Maximum: 25MB`,
        );
      }

      if (audioBuffer.length > this.WARN_FILE_SIZE) {
        this.logger.warn(
          `Large audio file detected: ${(audioBuffer.length / 1024 / 1024).toFixed(2)}MB - this will consume significant API credits`,
        );
      }

      // Try providers in order until one succeeds
      for (const provider of this.providers) {
        try {
          if (await provider.isHealthy()) {
            this.logger.log(
              `Attempting transcription with ${provider.name}...`,
            );
            const result = await provider.transcribe(audioBuffer, options);

            // Track metrics
            this.transcriptionCount++;
            this.totalAudioSize += audioSize;
            this.totalDuration += result.duration || 0;

            const processingTime = Date.now() - startTime;
            this.logger.log(
              `Transcription successful with ${provider.name}: "${result.text.substring(0, 100)}..." ` +
                `(${processingTime}ms, ${(audioSize / 1024).toFixed(1)}KB)`,
            );
            this.logger.debug(
              `Total metrics: count=${this.transcriptionCount}, ` +
                `size=${(this.totalAudioSize / 1024 / 1024).toFixed(2)}MB, ` +
                `duration=${this.totalDuration.toFixed(1)}s`,
            );

            return result;
          } else {
            this.logger.warn(
              `Provider ${provider.name} is not healthy, skipping...`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Provider ${provider.name} failed: ${error.message}, trying next...`,
          );
          continue;
        }
      }

      throw new Error('All transcription providers failed');
    } catch (error) {
      this.logger.error(`Transcription failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Download audio file from URL
   */
  private async downloadAudio(url: string): Promise<Buffer> {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30 second timeout
        maxContentLength: this.MAX_FILE_SIZE,
        maxBodyLength: this.MAX_FILE_SIZE,
      });

      const buffer = Buffer.from(response.data);

      // Clear response data from memory immediately
      response.data = null;

      return buffer;
    } catch (error) {
      if (error.code === 'ERR_FR_MAX_BODY_LENGTH_EXCEEDED') {
        throw new Error('Audio file exceeds maximum size (25MB)');
      }
      this.logger.error(`Failed to download audio: ${error.message}`);
      throw new Error(`Audio download failed: ${error.message}`);
    }
  }

  /**
   * Transcribe from base64 encoded audio
   */
  async transcribeBase64(
    base64Data: string,
    options?: TranscriptionOptions,
  ): Promise<TranscriptionResult> {
    try {
      // Decode base64 to buffer
      const audioBuffer = Buffer.from(base64Data, 'base64');
      return this.transcribe(audioBuffer, options);
    } catch (error) {
      this.logger.error(`Base64 transcription failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if transcription service is available
   */
  async isAvailable(): Promise<boolean> {
    for (const provider of this.providers) {
      if (await provider.isHealthy()) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get list of healthy providers
   */
  async getHealthyProviders(): Promise<string[]> {
    const healthy: string[] = [];

    for (const provider of this.providers) {
      if (await provider.isHealthy()) {
        healthy.push(provider.name);
      }
    }

    return healthy;
  }
}
