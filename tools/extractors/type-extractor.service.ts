import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';

export interface ExtractedType {
  name: string;
  definition: string;
}

export class TypeExtractorService {
  async extractTypes(typeNames: string[]): Promise<ExtractedType[]> {
    console.log(`🔍 Extracting backend types: ${typeNames.join(', ')}`);

    const extractedTypes: ExtractedType[] = [];
    const typesToProcess = new Set(typeNames);
    const processedTypes = new Set<string>();

    // Recursive type extraction - automatically find dependencies
    while (typesToProcess.size > 0) {
      const typeName = typesToProcess.values().next().value;
      typesToProcess.delete(typeName);

      if (processedTypes.has(typeName)) continue;
      processedTypes.add(typeName);

      const extracted = await this.findAndExtractType(typeName);
      if (extracted) {
        extractedTypes.push(extracted);
        console.log(`✅ Found type: ${typeName}`);

        // Auto-discover nested type references
        const nestedTypes = this.findReferencedTypes(extracted.definition);
        nestedTypes.forEach(nestedType => {
          if (!processedTypes.has(nestedType)) {
            typesToProcess.add(nestedType);
            console.log(`🔗 Auto-discovered dependency: ${nestedType}`);
          }
        });
      } else {
        console.error(`❌ CRITICAL: Type not found: ${typeName}`);
        throw new Error(`Required type '${typeName}' not found in backend source. Check type definitions.`);
      }
    }

    return extractedTypes;
  }

  private async findAndExtractType(typeName: string): Promise<ExtractedType | null> {
    // Handle array types
    const isArray = typeName.endsWith('[]');
    const baseTypeName = isArray ? typeName.slice(0, -2) : typeName;

    // Search for the type in backend source files - prioritize clean SDK models
    const searchPaths = [
      'src/**/sdk-models.ts',      // First priority: clean SDK model interfaces
      'src/**/api-responses.ts',   // Second priority: response types
      'src/**/*.dto.ts',           // Last resort: complex backend DTOs
      'src/**/*.entity.ts',
      'src/**/*.interface.ts',
      'src/**/*.types.ts'
    ];

    for (const pattern of searchPaths) {
      const files = await glob(pattern, { cwd: path.join(__dirname, '../../') });

      for (const file of files) {
        const filePath = path.join(__dirname, '../../', file);
        const content = await fs.readFile(filePath, 'utf-8');

        const typeDefinition = this.extractTypeFromFile(content, baseTypeName);
        if (typeDefinition) {
          return {
            name: typeName,
            definition: typeDefinition
          };
        }
      }
    }

    return null;
  }

  private extractTypeFromFile(content: string, typeName: string): string | null {
    // Extract class definitions (DTOs)
    const classRegex = new RegExp(`export class ${typeName}[\\s\\S]*?^}`, 'gm');
    const classMatch = content.match(classRegex);
    if (classMatch) {
      return this.convertClassToInterface(classMatch[0]);
    }

    // Extract interface definitions
    const interfaceRegex = new RegExp(`export interface ${typeName}[\\s\\S]*?^}`, 'gm');
    const interfaceMatch = content.match(interfaceRegex);
    if (interfaceMatch) {
      return interfaceMatch[0];
    }

    // Extract type aliases
    const typeRegex = new RegExp(`export type ${typeName}\\s*=\\s*[^;]+;`, 'gm');
    const typeMatch = content.match(typeRegex);
    if (typeMatch) {
      return typeMatch[0];
    }

    return null;
  }

  private findReferencedTypes(typeDefinition: string): string[] {
    const typeReferences: string[] = [];

    // Find property type references: "property: SomeType" or "property?: SomeType"
    const propertyRegex = /:\s*([A-Z][A-Za-z0-9]*)/g;
    let match;
    while ((match = propertyRegex.exec(typeDefinition)) !== null) {
      const typeName = match[1];
      if (!this.isPrimitiveType(typeName)) {
        typeReferences.push(typeName);
      }
    }

    // Find generic type parameters: "Array<SomeType>" or "Record<string, SomeType>"
    const genericRegex = /<([A-Z][A-Za-z0-9]*)/g;
    while ((match = genericRegex.exec(typeDefinition)) !== null) {
      const typeName = match[1];
      if (!this.isPrimitiveType(typeName)) {
        typeReferences.push(typeName);
      }
    }

    return [...new Set(typeReferences)];
  }

  private isPrimitiveType(typeName: string): boolean {
    const primitives = [
      'string', 'number', 'boolean', 'Date', 'any', 'unknown', 'object',
      'Array', 'Record', 'Promise', 'Function', 'Error'
    ];
    return primitives.includes(typeName);
  }

  private convertClassToInterface(classDefinition: string): string {
    // Convert DTO class to TypeScript interface - more sophisticated handling
    return classDefinition
      .replace(/export class/g, 'export interface')
      .replace(/@[A-Za-z][A-Za-z0-9]*(\([^)]*(\([^)]*\))*[^)]*\))?\s*/g, '') // Remove complex decorators
      .replace(/(private|public|protected)\s+/g, '')         // Remove access modifiers
      .replace(/\s*constructor\([^)]*\)\s*{[^}]*}/g, '')     // Remove constructors
      .replace(/\s*[a-zA-Z_][a-zA-Z0-9_]*\([^)]*\)\s*{[^}]*}/g, '') // Remove methods
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('//'))       // Remove empty lines and comments
      .join('\n')
      .trim();
  }

  generateTypesFile(extractedTypes: ExtractedType[]): string {
    const typeDefinitions = extractedTypes
      .map(t => t.definition)
      .filter(def => def && !def.includes('=> '))  // Filter out malformed definitions
      .join('\n\n');

    return `// Generated TypeScript types for GateKit SDK
// DO NOT EDIT - This file is auto-generated from backend DTOs

${typeDefinitions}

// Core model types (from Prisma schema)
export interface Project {
  id: string;
  name: string;
  slug: string;
  environment: 'development' | 'staging' | 'production';
  isDefault: boolean;
  settings?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// Message DTO types (simplified from complex backend DTOs)
export interface SendMessageDto {
  targets: Array<{
    platformId: string;
    type: 'user' | 'channel' | 'group';
    id: string;
  }>;
  content: {
    text?: string;
    attachments?: any[];
    buttons?: any[];
    embeds?: any[];
  };
  options?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface UpdatePlatformDto {
  isActive?: boolean;
  testMode?: boolean;
  credentials?: Record<string, unknown>;
}

// SDK configuration
export interface GateKitConfig {
  apiUrl: string;
  apiKey?: string;
  jwtToken?: string;
  timeout?: number;
  retries?: number;
}
`;
  }
}