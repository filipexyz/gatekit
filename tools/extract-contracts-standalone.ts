#!/usr/bin/env ts-node

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';

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

    console.log(`✅ Found ${allContracts.length} contracts with @SdkContract decorators`);

    // Extract type definitions
    const typeDefinitions = await extractAllTypes(allContracts);

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
      contractsByController: allContracts.reduce((acc, contract) => {
        acc[contract.controller] = (acc[contract.controller] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      contractsByCategory: allContracts.reduce((acc, contract) => {
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
    console.log(`🎉 Contract extraction completed successfully!`);

  } catch (error) {
    console.error('❌ Contract extraction failed:', error);
    process.exit(1);
  }
}

function extractContractsFromFile(content: string, filePath: string): ExtractedContract[] {
  const contracts: ExtractedContract[] = [];

  // Extract proper controller class name
  const controllerClassMatch = content.match(/export class (\w+Controller)/);
  const controllerName = controllerClassMatch ? controllerClassMatch[1] : path.basename(filePath, '.ts');

  // Extract controller path
  const controllerPathMatch = content.match(/@Controller\(['"`]([^'"`]+)['"`]\)/);
  const controllerPath = controllerPathMatch ? controllerPathMatch[1] : '';

  // Find all @SdkContract decorators
  const contractRegex = /@SdkContract\(\{[\s\S]*?\}\)/g;
  let match;

  while ((match = contractRegex.exec(content)) !== null) {
    try {
      // Extract the contract metadata object
      const decoratorText = match[0];
      const metadataText = decoratorText.replace('@SdkContract(', '').slice(0, -1);

      // Parse the metadata (simplified - in real implementation, use proper AST parsing)
      const metadata = parseContractMetadata(metadataText);

      if (metadata) {
        // Extract method info
        const methodInfo = extractMethodInfo(content, match.index!);

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

function parseContractMetadata(metadataText: string): ContractMetadata | null {
  try {
    // Simple JSON-like parsing (in production, use proper AST parser)
    const metadata = eval(`(${metadataText})`);
    return metadata;
  } catch {
    return null;
  }
}

function extractMethodInfo(content: string, contractIndex: number): { name: string; httpMethod: string; path: string } {
  // Look for method context around the @SdkContract decorator (before and after)
  const beforeContract = content.substring(Math.max(0, contractIndex - 200), contractIndex);
  const afterContract = content.substring(contractIndex);
  const methodSection = beforeContract + afterContract.substring(0, 300);

  // Extract HTTP method decorator - look more carefully
  const httpMethodMatch = methodSection.match(/@(Get|Post|Put|Patch|Delete)\s*\(\s*['"`]?([^'"`)]*)['"`]?\s*\)/i);
  let httpMethod = 'GET';
  let methodPath = '';

  if (httpMethodMatch) {
    httpMethod = httpMethodMatch[1].toUpperCase();
    methodPath = httpMethodMatch[2] || '';
  } else {
    // Try without parentheses
    const simpleHttpMatch = methodSection.match(/@(Get|Post|Put|Patch|Delete)(?!\w)/i);
    if (simpleHttpMatch) {
      httpMethod = simpleHttpMatch[1].toUpperCase();
    }
  }

  // Extract method name - look for method definition after decorators
  const methodNameMatch = methodSection.match(/(?:async\s+)?(\w+)\s*\([^)]*\)\s*[{:]/);
  const methodName = methodNameMatch ? methodNameMatch[1] : 'unknown';

  // Fallback HTTP method detection from method name
  if (httpMethod === 'GET' && methodName !== 'unknown') {
    const name = methodName.toLowerCase();
    if (name.includes('create') || name.includes('add') || name.includes('send') || name.includes('retry')) {
      httpMethod = 'POST';
    } else if (name.includes('update') || name.includes('edit')) {
      httpMethod = 'PATCH';
    } else if (name.includes('delete') || name.includes('remove') || name.includes('revoke')) {
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

async function extractAllTypes(contracts: ExtractedContract[]): Promise<Record<string, string>> {
  console.log('🔍 Extracting types for contracts...');

  const typeDefinitions: Record<string, string> = {};
  const typeNames = new Set<string>();

  // Collect all referenced types
  contracts.forEach(contract => {
    if (contract.contractMetadata.inputType) {
      typeNames.add(contract.contractMetadata.inputType);
    }
    if (contract.contractMetadata.outputType) {
      const outputType = contract.contractMetadata.outputType;
      typeNames.add(outputType);

      // Also add base type for arrays
      if (outputType.endsWith('[]')) {
        typeNames.add(outputType.slice(0, -2));
      }
    }
  });

  console.log(`🔍 Looking for types:`, Array.from(typeNames));

  // Extract type definitions from all sources
  const typeFiles = await glob('src/**/sdk-models.ts');
  const responseFiles = await glob('src/**/api-responses.ts');
  const dtoFiles = await glob('src/**/*.dto.ts');
  const allTypeFiles = [...typeFiles, ...responseFiles, ...dtoFiles];

  console.log(`🔍 Searching in ${allTypeFiles.length} type files:`, allTypeFiles);

  // Recursive type extraction - automatically find dependencies
  const typesToProcess = new Set(Array.from(typeNames).filter(name => !name.endsWith('[]')));
  const processedTypes = new Set<string>();

  while (typesToProcess.size > 0) {
    const typeName = typesToProcess.values().next().value;
    typesToProcess.delete(typeName);

    if (processedTypes.has(typeName)) continue;
    processedTypes.add(typeName);

    // Search in order of preference
    let found = false;
    for (const file of allTypeFiles) {
      const content = await fs.readFile(file, 'utf-8');
      const typeDefinition = extractTypeFromContent(content, typeName);

      if (typeDefinition) {
        typeDefinitions[typeName] = typeDefinition;
        console.log(`✅ Found type: ${typeName}`);

        // Auto-discover nested type references
        const nestedTypes = findReferencedTypes(typeDefinition);
        nestedTypes.forEach(nestedType => {
          if (!processedTypes.has(nestedType)) {
            typesToProcess.add(nestedType);
            console.log(`🔗 Auto-discovered dependency: ${nestedType}`);
          }
        });

        found = true;
        break;
      }
    }

    if (!found) {
      console.warn(`⚠️ Type not found: ${typeName}`);
    }
  }

  console.log(`📝 Extracted ${Object.keys(typeDefinitions).length} TypeScript types`);
  return typeDefinitions;
}

function extractTypeFromContent(content: string, typeName: string): string | null {
  // Extract interface definitions
  const interfaceRegex = new RegExp(`export interface ${typeName}[\\s\\S]*?^}`, 'gm');
  const interfaceMatch = content.match(interfaceRegex);
  if (interfaceMatch) {
    return interfaceMatch[0];
  }

  // Extract class definitions (DTOs) and convert to interfaces
  const classRegex = new RegExp(`export class ${typeName}[\\s\\S]*?^}`, 'gm');
  const classMatch = content.match(classRegex);
  if (classMatch) {
    return convertClassToInterface(classMatch[0]);
  }

  // Extract type aliases
  const typeRegex = new RegExp(`export type ${typeName}\\s*=\\s*[^;]+;`, 'gm');
  const typeMatch = content.match(typeRegex);
  if (typeMatch) {
    return typeMatch[0];
  }

  return null;
}

function convertClassToInterface(classDefinition: string): string {
  // Convert DTO class to TypeScript interface
  return classDefinition
    .replace(/export class/g, 'export interface')
    .replace(/@[A-Za-z][A-Za-z0-9]*(\([^)]*\))?\s*/g, '') // Remove decorators
    .replace(/(private|public|protected)\s+/g, '')         // Remove access modifiers
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('//'))       // Remove empty lines and comments
    .join('\n')
    .trim();
}

function findReferencedTypes(typeDefinition: string): string[] {
  const typeReferences: string[] = [];

  // Find property type references: "property: SomeType" or "property?: SomeType"
  const propertyRegex = /:\s*([A-Z][A-Za-z0-9]*)/g;
  let match;
  while ((match = propertyRegex.exec(typeDefinition)) !== null) {
    const typeName = match[1];
    if (!isPrimitiveType(typeName)) {
      typeReferences.push(typeName);
    }
  }

  // Find generic type parameters: "Array<SomeType>" or "Record<string, SomeType>"
  const genericRegex = /<([A-Z][A-Za-z0-9]*)/g;
  while ((match = genericRegex.exec(typeDefinition)) !== null) {
    const typeName = match[1];
    if (!isPrimitiveType(typeName)) {
      typeReferences.push(typeName);
    }
  }

  return [...new Set(typeReferences)];
}

function isPrimitiveType(typeName: string): boolean {
  const primitives = [
    'string', 'number', 'boolean', 'Date', 'any', 'unknown', 'object',
    'Array', 'Record', 'Promise', 'Function', 'Error'
  ];
  return primitives.includes(typeName);
}

// Run extraction
if (require.main === module) {
  extractContractsStandalone();
}