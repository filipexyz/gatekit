import * as ts from 'typescript';
import * as path from 'path';

/**
 * Parses decorator metadata using TypeScript AST
 * Dynamically resolves enum values by analyzing imports
 */
export class DecoratorMetadataParser {
  private enumRegistry: Map<string, any> = new Map();

  constructor(
    private sourceFilePath: string,
    private fileContent: string,
  ) {
    this.discoverEnums();
  }

  /**
   * Discover all enum imports in the source file
   */
  private discoverEnums() {
    const sourceFile = ts.createSourceFile(
      this.sourceFilePath,
      this.fileContent,
      ts.ScriptTarget.Latest,
      true,
    );

    // Visit all import declarations
    ts.forEachChild(sourceFile, (node) => {
      if (ts.isImportDeclaration(node)) {
        this.processImport(node);
      }
    });
  }

  /**
   * Process an import declaration and load enums
   */
  private processImport(node: ts.ImportDeclaration) {
    const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;
    const importClause = node.importClause;

    if (!importClause) return;

    // Handle named imports: import { ApiScope, PlatformType } from '...'
    if (
      importClause.namedBindings &&
      ts.isNamedImports(importClause.namedBindings)
    ) {
      const namedImports = importClause.namedBindings.elements;

      for (const importSpecifier of namedImports) {
        const importedName = importSpecifier.name.text;

        // Try to load the module and check if it's an enum
        try {
          const resolvedPath = this.resolveModulePath(moduleSpecifier);
          const importedModule = require(resolvedPath);

          // Check if the imported symbol is an enum (object with string values)
          const symbol = importedModule[importedName];
          if (symbol && typeof symbol === 'object') {
            // Register the enum for later resolution
            this.enumRegistry.set(importedName, symbol);
          }
        } catch (error) {
          // Module not found or not loadable, skip
        }
      }
    }
  }

  /**
   * Resolve module path relative to source file
   */
  private resolveModulePath(moduleSpecifier: string): string {
    if (moduleSpecifier.startsWith('.')) {
      // Relative import
      const sourceDir = path.dirname(this.sourceFilePath);
      return path.resolve(sourceDir, moduleSpecifier);
    }
    // Absolute or node_modules import
    return moduleSpecifier;
  }

  /**
   * Parse object expression from decorator metadata
   * Resolves enum member access to actual string values
   */
  parseObjectLiteral(objectText: string): any {
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      `const x = ${objectText}`,
      ts.ScriptTarget.Latest,
      true,
    );

    const statement = sourceFile.statements[0] as ts.VariableStatement;
    const declaration = statement.declarationList.declarations[0];
    const initializer = declaration.initializer;

    if (!initializer) {
      return null;
    }

    return this.evaluateNode(initializer);
  }

  private evaluateNode(node: ts.Node): any {
    if (ts.isObjectLiteralExpression(node)) {
      return this.evaluateObjectLiteral(node);
    }

    if (ts.isArrayLiteralExpression(node)) {
      return node.elements.map((el) => this.evaluateNode(el));
    }

    if (ts.isStringLiteral(node)) {
      return node.text;
    }

    if (ts.isNumericLiteral(node)) {
      return Number(node.text);
    }

    if (node.kind === ts.SyntaxKind.TrueKeyword) {
      return true;
    }

    if (node.kind === ts.SyntaxKind.FalseKeyword) {
      return false;
    }

    if (node.kind === ts.SyntaxKind.NullKeyword) {
      return null;
    }

    if (node.kind === ts.SyntaxKind.UndefinedKeyword) {
      return undefined;
    }

    if (ts.isPropertyAccessExpression(node)) {
      return this.evaluatePropertyAccess(node);
    }

    return null;
  }

  private evaluateObjectLiteral(node: ts.ObjectLiteralExpression): any {
    const result: any = {};

    for (const prop of node.properties) {
      if (ts.isPropertyAssignment(prop)) {
        const name = prop.name.getText();
        const value = this.evaluateNode(prop.initializer);
        result[name] = value;
      }
    }

    return result;
  }

  private evaluatePropertyAccess(node: ts.PropertyAccessExpression): any {
    const objectName = node.expression.getText();
    const propertyName = node.name.text;

    // Look up in our dynamically discovered enum registry
    const enumObject = this.enumRegistry.get(objectName);
    if (enumObject) {
      const value = enumObject[propertyName];
      return value !== undefined ? value : null;
    }

    return null;
  }
}
