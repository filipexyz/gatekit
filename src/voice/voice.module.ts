import { Module } from '@nestjs/common';
import { TranscriptionService } from './services/transcription.service';
import { WhisperProvider } from './providers/whisper.provider';

@Module({
  providers: [TranscriptionService, WhisperProvider],
  exports: [TranscriptionService],
})
export class VoiceModule {}
