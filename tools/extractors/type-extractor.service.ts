import * as path from 'path';
import {
  ArrayTypeNode,
  ClassDeclaration,
  Node,
  Project,
  Symbol,
  Type,
  TypeChecker,
  TypeReferenceNode,
} from 'ts-morph';

export interface ExtractedType {
  name: string;
  definition: string;
}

export class TypeExtractorService {
  private project: Project | null = null;
  private typeChecker: TypeChecker | null = null;
  private exportMap: Map<string, Node> | null = null;

  async extractTypes(typeNames: string[]): Promise<ExtractedType[]> {
    console.log(`🔍 Extracting backend types: ${typeNames.join(', ')}`);

    const extractedTypes = new Map<string, ExtractedType>();
    const seedTypes = typeNames
      .map((name) => this.getCanonicalTypeName(name))
      .filter((name) => name && !this.isPrimitiveType(name));
    const typesToProcess = new Set(seedTypes);
    const processedTypes = new Set<string>();

    // Recursive type extraction - automatically find dependencies
    while (typesToProcess.size > 0) {
      const typeName = typesToProcess.values().next().value;
      typesToProcess.delete(typeName);

      if (processedTypes.has(typeName)) continue;
      processedTypes.add(typeName);

      const extracted = this.findAndExtractType(typeName);
      if (extracted) {
        if (!extractedTypes.has(extracted.name)) {
          extractedTypes.set(extracted.name, extracted);
          console.log(`✅ Found type: ${typeName}`);
        }

        // Auto-discover nested type references
        const declaration = this.getDeclaration(typeName);
        const nestedTypes = declaration
          ? this.findReferencedTypesFromDeclaration(declaration)
          : [];
        nestedTypes.forEach((nestedType) => {
          if (!processedTypes.has(nestedType)) {
            typesToProcess.add(nestedType);
            console.log(`🔗 Auto-discovered dependency: ${nestedType}`);
          }
        });
      } else {
        console.error(`❌ CRITICAL: Type not found: ${typeName}`);
        throw new Error(
          `Required type '${typeName}' not found in backend source. Check type definitions.`,
        );
      }
    }

    return Array.from(extractedTypes.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  private findAndExtractType(typeName: string): ExtractedType | null {
    const declaration = this.getDeclaration(typeName);

    if (!declaration) {
      return null;
    }

    if (
      Node.isInterfaceDeclaration(declaration) ||
      Node.isTypeAliasDeclaration(declaration)
    ) {
      return {
        name: typeName,
        definition: declaration.getText(),
      };
    }

    if (Node.isClassDeclaration(declaration)) {
      return {
        name: typeName,
        definition: this.convertClassToInterface(declaration, typeName),
      };
    }

    return null;
  }

  private getDeclaration(typeName: string) {
    const project = this.getProject();
    this.populateExportMap();
    const canonicalName = this.getCanonicalTypeName(typeName);

    return this.exportMap?.get(canonicalName) || null;
  }

  private getProject(): Project {
    if (!this.project) {
      this.project = new Project({
        tsConfigFilePath: path.join(__dirname, '../../tsconfig.json'),
        skipAddingFilesFromTsConfig: false,
      });
    }

    return this.project;
  }

  private getTypeChecker(): TypeChecker {
    if (!this.typeChecker) {
      this.typeChecker = this.getProject().getTypeChecker();
    }
    return this.typeChecker;
  }

  private populateExportMap(): void {
    if (this.exportMap) return;

    const map = new Map<string, Node>();
    for (const sourceFile of this.getProject().getSourceFiles('src/**/*.ts')) {
      const exported = sourceFile.getExportedDeclarations();
      exported.forEach((declarations, name) => {
        if (map.has(name)) {
          return;
        }
        const matching = declarations.find(
          (declaration) =>
            Node.isInterfaceDeclaration(declaration) ||
            Node.isTypeAliasDeclaration(declaration) ||
            Node.isClassDeclaration(declaration),
        );
        if (matching) {
          map.set(name, matching);
        }
      });
    }
    this.exportMap = map;
  }

  private findReferencedTypesFromDeclaration(declaration: Node): string[] {
    const references = new Set<string>();

    const visit = (node: Node): void => {
      if (Node.isTypeReference(node)) {
        this.collectFromTypeReferenceNode(node, references);
      } else if (Node.isArrayTypeNode(node)) {
        const elementType = node.getElementTypeNode();
        visit(elementType);
      } else if (
        Node.isUnionTypeNode(node) ||
        Node.isIntersectionTypeNode(node)
      ) {
        node.getTypeNodes().forEach(visit);
      }

      node.forEachChild(visit);
    };

    visit(declaration);

    return Array.from(references);
  }

  private isPrimitiveType(typeName: string): boolean {
    const primitives = [
      'string',
      'number',
      'boolean',
      'Date',
      'any',
      'unknown',
      'object',
      'Array',
      'Record',
      'Promise',
      'Function',
      'Error',
      'Partial',
      'Pick',
      'Omit',
      'Readonly',
      'Set',
      'Map',
    ];
    return primitives.includes(typeName);
  }

  private convertClassToInterface(
    classDeclaration: ClassDeclaration,
    interfaceName: string,
  ): string {
    const type = classDeclaration.getType();
    const properties = this.printPropertiesFromType(type, classDeclaration);
    return `export interface ${interfaceName} {\n${properties}\n}`;
  }

  private collectFromTypeReferenceNode(
    node: TypeReferenceNode,
    accumulator: Set<string>,
  ): void {
    const typeName = node.getTypeName().getText();
    this.addReference(typeName, accumulator);

    node.getTypeArguments().forEach((arg) => {
      if (Node.isTypeReference(arg)) {
        this.collectFromTypeReferenceNode(arg, accumulator);
      } else if (Node.isArrayTypeNode(arg)) {
        this.collectFromArrayTypeNode(arg, accumulator);
      } else {
        this.addReference(arg.getText(), accumulator);
      }
    });
  }

  private collectFromArrayTypeNode(
    node: ArrayTypeNode,
    accumulator: Set<string>,
  ): void {
    const elementType = node.getElementTypeNode();
    if (Node.isTypeReference(elementType)) {
      this.collectFromTypeReferenceNode(elementType, accumulator);
    } else {
      this.addReference(elementType.getText(), accumulator);
    }
  }

  private addReference(rawName: string, accumulator: Set<string>): void {
    const withoutQuotes = rawName.replace(/^['"`]|['"`]$/g, '');
    const cleaned = this.getCanonicalTypeName(withoutQuotes);
    if (
      !cleaned ||
      this.isPrimitiveType(cleaned) ||
      cleaned === 'Array' ||
      !/^[A-Z_]/.test(cleaned)
    ) {
      return;
    }

    accumulator.add(cleaned);
  }

  private getCanonicalTypeName(typeName: string): string {
    const noGenerics = typeName.split('<')[0];
    const noArray = noGenerics.replace(/\[\]$/, '');
    const segment = noArray.split('.').pop();
    return segment ? segment.trim() : noArray.trim();
  }

  generateTypesFile(extractedTypes: ExtractedType[]): string {
    const typeDefinitions = extractedTypes
      .map((t) => t.definition)
      .filter((def) => def && !def.includes('=> ')) // Filter out malformed definitions
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

  private printPropertiesFromType(
    type: Type,
    context: ClassDeclaration,
  ): string {
    const checker = this.getTypeChecker();
    const lines: string[] = [];

    type.getProperties().forEach((symbol: Symbol) => {
      const name = symbol.getName();
      if (name.startsWith('__')) {
        return;
      }

      const declaration =
        symbol.getValueDeclaration() || symbol.getDeclarations()?.[0];
      const symbolType = declaration
        ? symbol.getTypeAtLocation(declaration)
        : checker.getTypeOfSymbolAtLocation(symbol, context);
      const typeText = symbolType.getText(declaration ?? context);
      const optional = symbol.isOptional();
      lines.push(`  ${name}${optional ? '?' : ''}: ${typeText};`);
    });

    return lines.join('\n');
  }
}
