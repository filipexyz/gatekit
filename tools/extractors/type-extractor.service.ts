import * as path from 'path';
import {
  ArrayTypeNode,
  ClassDeclaration,
  Node,
  Project,
  SyntaxKind,
  TypeReferenceNode,
} from 'ts-morph';

export interface ExtractedType {
  name: string;
  definition: string;
}

export class TypeExtractorService {
  private project: Project | null = null;
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
        definition: this.cleanTypeDefinition(declaration.getText()),
      };
    }

    if (Node.isClassDeclaration(declaration)) {
      return {
        name: typeName,
        definition: this.convertClassToInterface(declaration, typeName),
      };
    }

    if (Node.isEnumDeclaration(declaration)) {
      return {
        name: typeName,
        definition: this.convertEnumToType(declaration, typeName),
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
      // Use process.cwd() which works in both dev and CI environments
      const tsConfigPath = path.join(process.cwd(), 'tsconfig.json');

      this.project = new Project({
        tsConfigFilePath: tsConfigPath,
        skipAddingFilesFromTsConfig: false,
      });
    }

    return this.project;
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
            Node.isClassDeclaration(declaration) ||
            Node.isEnumDeclaration(declaration),
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
      // For class declarations, explicitly visit properties (forEachChild doesn't include them)
      if (Node.isClassDeclaration(node)) {
        node.getProperties().forEach((prop) => {
          const typeNode = prop.getTypeNode();
          if (typeNode) {
            visit(typeNode);
          }
        });
      }

      // For interface/type alias declarations, forEachChild works fine
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
    const properties: string[] = [];

    classDeclaration.getProperties().forEach((prop) => {
      // Skip private/protected properties
      if (
        prop.hasModifier(SyntaxKind.PrivateKeyword) ||
        prop.hasModifier(SyntaxKind.ProtectedKeyword)
      ) {
        return;
      }

      const name = prop.getName();
      const typeNode = prop.getTypeNode();
      const optional = prop.hasQuestionToken() ? '?' : '';

      if (typeNode) {
        const typeText = this.cleanTypeText(typeNode.getText());
        properties.push(`  ${name}${optional}: ${typeText};`);
      }
    });

    return `export interface ${interfaceName} {\n${properties.join('\n')}\n}`;
  }

  private convertEnumToType(enumDeclaration: Node, typeName: string): string {
    if (!Node.isEnumDeclaration(enumDeclaration)) {
      return `export type ${typeName} = string;`;
    }

    const members = enumDeclaration
      .getMembers()
      .map((member) => {
        const value = member.getValue();
        return typeof value === 'string' ? `'${value}'` : value;
      })
      .join(' | ');

    return `export type ${typeName} = ${members};`;
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

  private cleanTypeText(typeText: string): string {
    // Remove Prisma import paths and replace with clean enum types
    return typeText
      .replace(
        /import\("[^"]*\.prisma[^"]*"\)\.\$Enums\.ProjectRole/g,
        'ProjectRole',
      )
      .replace(
        /import\("[^"]*\.prisma[^"]*"\)\.\$Enums\.ProjectEnvironment/g,
        'ProjectEnvironment',
      )
      .replace(/import\("[^"]*\.prisma[^"]*"\)\.\$Enums\.(\w+)/g, '$1');
  }

  private cleanTypeDefinition(definition: string): string {
    // Remove Prisma imports from type definitions
    return definition
      .replace(
        /import\("[^"]*\.prisma[^"]*"\)\.\$Enums\.ProjectRole/g,
        'ProjectRole',
      )
      .replace(
        /import\("[^"]*\.prisma[^"]*"\)\.\$Enums\.ProjectEnvironment/g,
        'ProjectEnvironment',
      )
      .replace(/import\("[^"]*\.prisma[^"]*"\)\.\$Enums\.(\w+)/g, '$1');
  }
}
