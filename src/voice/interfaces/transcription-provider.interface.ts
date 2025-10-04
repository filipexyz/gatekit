export interface TranscriptionResult {
  text: string;
  confidence?: number;
  language?: string;
  duration?: number;
  provider: string;
}

export interface TranscriptionProvider {
  readonly name: string;
  transcribe(
    audioBuffer: Buffer,
    options?: TranscriptionOptions,
  ): Promise<TranscriptionResult>;
  isHealthy(): Promise<boolean>;
}

export interface TranscriptionOptions {
  language?: string;
  format?: string; // mp3, ogg, wav, opus, webm
  prompt?: string; // Context hint for better accuracy
  projectId?: string; // For rate limiting
}
