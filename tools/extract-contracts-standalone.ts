#!/usr/bin/env ts-node

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { TypeExtractorService } from './extractors/type-extractor.service';
import { DecoratorMetadataParser } from './extractors/decorator-metadata-parser';

// Standalone contract extraction without NestJS context
// This avoids database dependencies in CI/CD environments

interface ContractMetadata {
  command: string;
  description: string;
  category?: string;
  requiredScopes?: string[];
  inputType?: string;
  outputType?: string;
  options?: Record<string, any>;
  examples?: Array<{
    description: string;
    command: string;
  }>;
}

interface ExtractedContract {
  controller: string;
  method: string;
  httpMethod: string;
  path: string;
  contractMetadata: ContractMetadata;
  typeDefinitions?: Record<string, string>;
}

async function extractContractsStandalone() {
  console.log('🔍 Extracting SDK contracts from backend controllers...');

  try {
    // Find all controller files
    const controllerFiles = await glob('src/**/*.controller.ts');

    const allContracts: ExtractedContract[] = [];

    for (const file of controllerFiles) {
      const content = await fs.readFile(file, 'utf-8');
      const contracts = extractContractsFromFile(content, file);
      allContracts.push(...contracts);
    }

    console.log(
      `✅ Found ${allContracts.length} contracts with @SdkContract decorators`,
    );

    // Extract type definitions
    const typeDefinitions = await extractTypeDefinitions(allContracts);

    // Add type definitions to first contract
    if (allContracts.length > 0) {
      allContracts[0].typeDefinitions = typeDefinitions;
    }

    // Create output directory
    const outputDir = path.join(__dirname, '../generated/contracts');
    await fs.mkdir(outputDir, { recursive: true });

    // Write contracts to JSON file
    const contractsFile = path.join(outputDir, 'contracts.json');
    await fs.writeFile(contractsFile, JSON.stringify(allContracts, null, 2));

    console.log(`📄 Contracts written to: ${contractsFile}`);

    // Create summary
    const summary = {
      extractedAt: new Date().toISOString(),
      totalContracts: allContracts.length,
      contractsByController: allContracts.reduce(
        (acc, contract) => {
          acc[contract.controller] = (acc[contract.controller] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
      contractsByCategory: allContracts.reduce(
        (acc, contract) => {
          const category =
            contract.contractMetadata.category || 'Uncategorized';
          acc[category] = (acc[category] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };

    const summaryFile = path.join(outputDir, 'extraction-summary.json');
    await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2));

    console.log(`📊 Extraction summary:`);
    console.log(`   Total contracts: ${summary.totalContracts}`);
    console.log(
      `   Controllers: ${Object.keys(summary.contractsByController).join(', ')}`,
    );
    console.log(`🎉 Contract extraction completed successfully!`);
  } catch (error) {
    console.error('❌ Contract extraction failed:', error);
    process.exit(1);
  }
}

function extractContractsFromFile(
  content: string,
  filePath: string,
): ExtractedContract[] {
  const contracts: ExtractedContract[] = [];

  // Create parser instance for this file (discovers enums from imports)
  const parser = new DecoratorMetadataParser(filePath, content);

  // Extract proper controller class name
  const controllerClassMatch = content.match(/export class (\w+Controller)/);
  const controllerName = controllerClassMatch
    ? controllerClassMatch[1]
    : path.basename(filePath, '.ts');

  // Extract controller path
  const controllerPathMatch = content.match(
    /@Controller\(['"`]([^'"`]+)['"`]\)/,
  );
  const controllerPath = controllerPathMatch ? controllerPathMatch[1] : '';

  // Find all @SdkContract decorators
  const contractRegex = /@SdkContract\(\{[\s\S]*?\}\)/g;
  let match;

  while ((match = contractRegex.exec(content)) !== null) {
    try {
      // Extract the contract metadata object
      const decoratorText = match[0];
      const metadataText = decoratorText
        .replace('@SdkContract(', '')
        .slice(0, -1);

      // Parse the metadata using AST parser with enum resolution
      const metadata = parser.parseObjectLiteral(metadataText);

      if (metadata) {
        // Extract method info - pass the END of the decorator
        const decoratorEndIndex = match.index + match[0].length;
        const methodInfo = extractMethodInfo(content, decoratorEndIndex);

        contracts.push({
          controller: controllerName,
          method: methodInfo.name,
          httpMethod: methodInfo.httpMethod,
          path: combinePaths(controllerPath, methodInfo.path),
          contractMetadata: metadata,
        });
      }
    } catch (error) {
      console.warn(`⚠️ Failed to parse contract in ${filePath}:`, error);
    }
  }

  return contracts;
}

function extractMethodInfo(
  content: string,
  decoratorEndIndex: number,
): { name: string; httpMethod: string; path: string } {
  // Search in the text AFTER the @SdkContract decorator
  const afterDecorator = content.substring(decoratorEndIndex);
  const searchWindow = afterDecorator.substring(0, 500);

  // Extract HTTP method decorator
  const httpMethodMatch = searchWindow.match(
    /@(Get|Post|Put|Patch|Delete)\s*\(\s*['"`]?([^'"`)]*)['"`]?\s*\)/i,
  );
  let httpMethod = 'GET';
  let methodPath = '';

  if (httpMethodMatch) {
    httpMethod = httpMethodMatch[1].toUpperCase();
    methodPath = httpMethodMatch[2] || '';
  } else {
    // Try without parentheses
    const simpleHttpMatch = searchWindow.match(
      /@(Get|Post|Put|Patch|Delete)(?!\w)/i,
    );
    if (simpleHttpMatch) {
      httpMethod = simpleHttpMatch[1].toUpperCase();
    }
  }

  // Extract method name - look for method definition after decorators
  // Pattern: async methodName( or methodName(
  const methodNameMatch = searchWindow.match(/(?:async\s+)?(\w+)\s*\(/);
  const methodName = methodNameMatch ? methodNameMatch[1] : 'unknown';

  // Fallback HTTP method detection from method name
  if (httpMethod === 'GET' && methodName !== 'unknown') {
    const name = methodName.toLowerCase();
    if (
      name.includes('create') ||
      name.includes('add') ||
      name.includes('send') ||
      name.includes('retry')
    ) {
      httpMethod = 'POST';
    } else if (name.includes('update') || name.includes('edit')) {
      httpMethod = 'PATCH';
    } else if (
      name.includes('delete') ||
      name.includes('remove') ||
      name.includes('revoke')
    ) {
      httpMethod = 'DELETE';
    }
  }

  return {
    name: methodName,
    httpMethod,
    path: methodPath,
  };
}

function combinePaths(controllerPath: string, methodPath: string): string {
  let fullPath = controllerPath;
  if (methodPath) {
    if (!controllerPath.endsWith('/') && !methodPath.startsWith('/')) {
      fullPath += '/';
    }
    fullPath += methodPath;
  }
  fullPath = fullPath.replace(/\/+/g, '/');
  return fullPath.startsWith('/') ? fullPath : `/${fullPath}`;
}

async function extractTypeDefinitions(
  contracts: ExtractedContract[],
): Promise<Record<string, string>> {
  console.log('🔍 Extracting types for contracts...');

  const typeNames = new Set<string>();
  contracts.forEach((contract) => {
    if (contract.contractMetadata.inputType) {
      typeNames.add(contract.contractMetadata.inputType);
    }
    if (contract.contractMetadata.outputType) {
      const outputType = contract.contractMetadata.outputType;
      typeNames.add(outputType);
      if (outputType.endsWith('[]')) {
        typeNames.add(outputType.slice(0, -2));
      }
    }
  });

  const extractor = new TypeExtractorService();
  const extractedTypes = await extractor.extractTypes(Array.from(typeNames));

  const typeDefinitions: Record<string, string> = {};
  extractedTypes.forEach((type) => {
    typeDefinitions[type.name] = type.definition;
  });

  console.log(
    `📝 Extracted ${Object.keys(typeDefinitions).length} TypeScript types`,
  );

  return typeDefinitions;
}

// Run extraction
if (require.main === module) {
  extractContractsStandalone();
}
