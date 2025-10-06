import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { McpController } from './mcp.controller';
import { McpToolRegistryService } from './services/mcp-tool-registry.service';
import { McpExecutorService } from './services/mcp-executor.service';
import { ContractExtractorService } from '../../tools/extractors/contract-extractor.service';
import { DiscoveryModule } from '@nestjs/core';
import { PlatformRegistry } from '../platforms/services/platform-registry.service';

@Module({
  imports: [HttpModule, DiscoveryModule],
  controllers: [McpController],
  providers: [
    McpToolRegistryService,
    McpExecutorService,
    ContractExtractorService,
    PlatformRegistry,
  ],
  exports: [McpToolRegistryService],
})
export class McpModule {}
