#!/usr/bin/env ts-node

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { TypeExtractorService } from './extractors/type-extractor.service';
import { DecoratorMetadataParser } from './extractors/decorator-metadata-parser';

// Contract extraction without NestJS context
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
  platformMetadata?: Record<string, any>;
}

async function extractContracts() {
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

    // Extract platform metadata
    const platformMetadata = await extractPlatformMetadata();

    // Add type definitions and platform metadata to first contract
    if (allContracts.length > 0) {
      allContracts[0].typeDefinitions = typeDefinitions;
      allContracts[0].platformMetadata = platformMetadata;
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
        // Extract method info - pass decorator start (for HTTP method) and end (for method name)
        const decoratorStartIndex = match.index;
        const decoratorEndIndex = match.index + match[0].length;
        const methodInfo = extractMethodInfo(
          content,
          decoratorStartIndex,
          decoratorEndIndex,
        );

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
  decoratorStartIndex: number,
  decoratorEndIndex: number,
): { name: string; httpMethod: string; path: string } {
  // Search BOTH before and after @SdkContract for HTTP method decorator
  // (decorator order can vary between @Patch then @SdkContract or vice versa)
  const beforeDecorator = content.substring(
    Math.max(0, decoratorStartIndex - 200),
    decoratorStartIndex,
  );
  const afterDecorator = content.substring(decoratorEndIndex);
  const afterSearchWindow = afterDecorator.substring(0, 200);

  let httpMethod = 'GET';
  let methodPath = '';

  // Try to find HTTP method decorator BEFORE @SdkContract first
  let httpMethodMatch = beforeDecorator.match(
    /@(Get|Post|Put|Patch|Delete)\s*\(\s*['"`]?([^'"`)]*)['"`]?\s*\)/i,
  );

  if (!httpMethodMatch) {
    // If not found before, try AFTER @SdkContract
    httpMethodMatch = afterSearchWindow.match(
      /@(Get|Post|Put|Patch|Delete)\s*\(\s*['"`]?([^'"`)]*)['"`]?\s*\)/i,
    );
  }

  if (httpMethodMatch) {
    httpMethod = httpMethodMatch[1].toUpperCase();
    methodPath = httpMethodMatch[2] || '';
  } else {
    // Try without parentheses in both locations
    let simpleHttpMatch = beforeDecorator.match(
      /@(Get|Post|Put|Patch|Delete)(?!\w)/i,
    );
    if (!simpleHttpMatch) {
      simpleHttpMatch = afterSearchWindow.match(
        /@(Get|Post|Put|Patch|Delete)(?!\w)/i,
      );
    }
    if (simpleHttpMatch) {
      httpMethod = simpleHttpMatch[1].toUpperCase();
    }
  }

  // Search AFTER @SdkContract for method name
  const methodSearchWindow = afterDecorator.substring(0, 300);

  // Extract method name - look for method definition after decorators
  // Pattern: async methodName( or methodName(
  const methodNameMatch = methodSearchWindow.match(/(?:async\s+)?(\w+)\s*\(/);
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
  // Sort by type name for deterministic output
  extractedTypes
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((type) => {
      typeDefinitions[type.name] = type.definition;
    });

  console.log(
    `📝 Extracted ${Object.keys(typeDefinitions).length} TypeScript types`,
  );

  return typeDefinitions;
}

async function extractPlatformMetadata(): Promise<Record<string, any>> {
  console.log('🔍 Extracting platform metadata...');

  const platformMetadata: Record<string, any> = {};

  // Find all platform provider files
  const providerFiles = await glob('src/platforms/providers/*.provider.ts');

  for (const file of providerFiles) {
    const content = await fs.readFile(file, 'utf-8');

    // Extract platform name from PlatformType enum usage
    const platformTypeMatch = content.match(/PlatformType\.(\w+)/);
    if (!platformTypeMatch) continue;

    const platformName = platformTypeMatch[1].toLowerCase();

    // Extract display name from provider class
    const displayNameMatch = content.match(
      /displayName\s*=\s*['"`]([^'"`]+)['"`]/,
    );

    // Extract connection type
    const connectionTypeMatch = content.match(
      /connectionType\s*=\s*['"`]([^'"`]+)['"`]/,
    );

    // Extract capabilities from @PlatformProviderDecorator
    const capabilitiesMatch = content.match(
      /@PlatformProviderDecorator\([^,]+,\s*\[([\s\S]*?)\]\)/,
    );
    const capabilities: any[] = [];
    if (capabilitiesMatch) {
      const capabilitiesText = capabilitiesMatch[1];
      // Extract capability objects
      const capabilityMatches = capabilitiesText.matchAll(
        /\{\s*capability:\s*PlatformCapability\.(\w+)(?:,\s*limitations:\s*['"`]([^'"`]+)['"`])?\s*\}/g,
      );
      for (const match of capabilityMatches) {
        const cap: any = {
          capability: match[1].toLowerCase().replace(/_/g, '-'),
        };
        if (match[2]) cap.limitations = match[2];
        capabilities.push(cap);
      }
    }

    // Extract platform options schema class name from @PlatformOptionsDecorator
    const optionsMatch = content.match(/@PlatformOptionsDecorator\((\w+)\)/);
    let optionsSchema = null;
    if (optionsMatch) {
      const optionsClassName = optionsMatch[1];
      // Find the options file
      const optionsFiles = await glob(
        `src/platforms/providers/*-platform-options.dto.ts`,
      );
      for (const optionsFile of optionsFiles) {
        const optionsContent = await fs.readFile(optionsFile, 'utf-8');
        if (optionsContent.includes(`export class ${optionsClassName}`)) {
          // Extract class-validator decorators and properties
          optionsSchema = await extractOptionsSchema(
            optionsContent,
            optionsClassName,
          );
          break;
        }
      }
    }

    platformMetadata[platformName] = {
      name: platformName,
      displayName: displayNameMatch ? displayNameMatch[1] : platformName,
      connectionType: connectionTypeMatch ? connectionTypeMatch[1] : 'unknown',
      capabilities,
      optionsSchema,
    };
  }

  console.log(
    `📝 Extracted metadata for ${Object.keys(platformMetadata).length} platforms`,
  );

  return platformMetadata;
}

async function extractOptionsSchema(
  content: string,
  className: string,
): Promise<any> {
  const schema: any = {
    type: 'object',
    properties: {},
    className,
  };

  // Find the class body - match from class declaration to end of file
  const classStartMatch = content.match(
    new RegExp(`export class ${className}\\s*\\{`),
  );
  if (!classStartMatch) return schema;

  const classStart = classStartMatch.index! + classStartMatch[0].length;
  // Find the matching closing brace (last one before end of file usually)
  const remainingContent = content.substring(classStart);
  const lastBrace = remainingContent.lastIndexOf('}');
  const classBody = remainingContent.substring(0, lastBrace);

  // Extract properties with their decorators and comments
  // Match: optional JSDoc comment + @IsOptional + any decorators + property declaration
  const propertyRegex =
    /(\/\*\*[\s\S]*?\*\/)?\s*@IsOptional\(\)\s*(?:@\w+\([^)]*\)\s*)*(\w+)\?:\s*([^;]+);/g;
  let match;

  while ((match = propertyRegex.exec(classBody)) !== null) {
    const jsdocComment = match[1];
    const propertyName = match[2];
    const propertyType = match[3].trim();

    // Find decorators ONLY between @IsOptional and property name (not from previous properties)
    // Look backwards from property name to @IsOptional
    const propertyStart = match.index;
    const fullMatch = match[0];
    const optionalIndex = fullMatch.indexOf('@IsOptional');
    const propertyNameIndex = fullMatch.indexOf(propertyName + '?:');
    const decoratorsSection = fullMatch.substring(
      optionalIndex,
      propertyNameIndex,
    );

    const isEmailMatch = decoratorsSection.match(/@IsEmail\(/);
    const isArrayMatch = decoratorsSection.match(/@IsArray\(/);
    const isStringMatch = decoratorsSection.match(/@IsString\(/);

    const property: any = {
      type: mapTypeScriptTypeToJsonSchema(propertyType),
      description: extractPropertyDescriptionFromJSDoc(jsdocComment),
    };

    // Handle array types (priority over other validators)
    if (isArrayMatch && propertyType.includes('[]')) {
      property.type = 'array';
      const itemType = propertyType.replace('[]', '').trim();
      property.items = { type: mapTypeScriptTypeToJsonSchema(itemType) };

      // Add email format to array items if validator is Email
      if (isEmailMatch) {
        property.items.format = 'email';
      }
    }
    // Handle email validation for non-array types
    else if (isEmailMatch && !propertyType.includes('[]')) {
      property.format = 'email';
    }

    schema.properties[propertyName] = property;
  }

  return schema;
}

function mapTypeScriptTypeToJsonSchema(tsType: string): string {
  if (tsType.includes('Record<')) return 'object';
  if (tsType.includes('[]')) return 'array';
  if (tsType.includes('string')) return 'string';
  if (tsType.includes('number')) return 'number';
  if (tsType.includes('boolean')) return 'boolean';
  return 'string';
}

function extractPropertyDescriptionFromJSDoc(
  jsdocComment: string | undefined,
): string {
  if (!jsdocComment) return '';

  // Extract all lines from JSDoc, removing asterisks and whitespace
  const lines = jsdocComment
    .split('\n')
    .map((line) => line.replace(/^\s*\*\/?/, '').trim()) // Remove * and optional trailing /
    .filter(
      (line) =>
        line &&
        !line.startsWith('@') &&
        !line.includes('/**') &&
        !line.includes('*/'),
    );

  return lines.join(' ').trim();
}

// Run extraction
if (require.main === module) {
  extractContracts();
}
