import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { SeedService } from './seed.service';

@Global()
@Module({
  providers: [PrismaService, SeedService],
  exports: [PrismaService],
})
export class PrismaModule {}
