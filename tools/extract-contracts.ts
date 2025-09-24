#!/usr/bin/env ts-node

import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs/promises';

// Import all the modules that contain controllers with @SdkContract decorators
import { ProjectsModule } from '../src/projects/projects.module';
import { ApiKeysModule } from '../src/api-keys/api-keys.module';
import { PlatformsModule } from '../src/platforms/platforms.module';
import { AuthModule } from '../src/auth/auth.module';
import { HealthModule } from '../src/health/health.module';

// Import the extractor service
import { ContractExtractorService } from './extractors/contract-extractor.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DiscoveryModule,
    ProjectsModule,
    ApiKeysModule,
    PlatformsModule,
    AuthModule,
    HealthModule,
  ],
  providers: [ContractExtractorService],
})
class ExtractionModule {}

async function extractContracts() {
  console.log('🔍 Extracting SDK contracts from backend controllers...');

  try {
    // Create a NestJS application context for dependency injection
    const app = await NestFactory.createApplicationContext(ExtractionModule, {
      logger: false, // Disable logs during extraction
    });

    // Get the contract extractor service
    const extractor = app.get(ContractExtractorService);

    // Extract all contracts
    const contracts = await extractor.extractContracts();

    console.log(`✅ Found ${contracts.length} contracts with @SdkContract decorators`);

    // Create output directory
    const outputDir = path.join(__dirname, '../generated/contracts');
    await fs.mkdir(outputDir, { recursive: true });

    // Write contracts to JSON file
    const contractsFile = path.join(outputDir, 'contracts.json');
    await fs.writeFile(contractsFile, JSON.stringify(contracts, null, 2));

    console.log(`📄 Contracts written to: ${contractsFile}`);

    // Create a summary report
    const summary = {
      extractedAt: new Date().toISOString(),
      totalContracts: contracts.length,
      contractsByController: contracts.reduce((acc, contract) => {
        acc[contract.controller] = (acc[contract.controller] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      contractsByCategory: contracts.reduce((acc, contract) => {
        const category = contract.contractMetadata.category || 'Uncategorized';
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    const summaryFile = path.join(outputDir, 'extraction-summary.json');
    await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2));

    console.log(`📊 Extraction summary:`);
    console.log(`   Total contracts: ${summary.totalContracts}`);
    console.log(`   Controllers: ${Object.keys(summary.contractsByController).join(', ')}`);
    console.log(`   Categories: ${Object.keys(summary.contractsByCategory).join(', ')}`);

    // Close the application context
    await app.close();

    console.log('🎉 Contract extraction completed successfully!');

  } catch (error) {
    console.error('❌ Contract extraction failed:', error);
    process.exit(1);
  }
}

// Run the extraction if this file is executed directly
if (require.main === module) {
  extractContracts();
}