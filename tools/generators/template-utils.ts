import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Template processing utility for generators
 * Copies static files from templates/ and replaces placeholders
 */
export class TemplateUtils {
  /**
   * Copy all files from template directory to output directory
   * Processes .template.md files by replacing placeholders and removing .template extension
   */
  static async copyTemplateFiles(
    templateName: 'sdk' | 'cli' | 'n8n',
    outputDir: string,
    placeholders?: Record<string, string>,
  ): Promise<void> {
    const templateDir = path.join(__dirname, 'templates', templateName);

    try {
      await fs.access(templateDir);
    } catch {
      throw new Error(`Template directory not found: ${templateDir}`);
    }

    try {
      await this.copyDirectory(templateDir, outputDir, placeholders);
    } catch (error) {
      throw new Error(
        `Failed to copy template files: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Recursively copy directory contents (parallelized for performance)
   */
  private static async copyDirectory(
    source: string,
    destination: string,
    placeholders?: Record<string, string>,
  ): Promise<void> {
    await fs.mkdir(destination, { recursive: true });

    const entries = await fs.readdir(source, { withFileTypes: true });

    // Parallelize file/directory operations for better performance
    await Promise.all(
      entries.map(async (entry) => {
        const sourcePath = path.join(source, entry.name);
        const destPath = path.join(destination, entry.name);

        if (entry.isDirectory()) {
          await this.copyDirectory(sourcePath, destPath, placeholders);
        } else {
          await this.copyFile(sourcePath, destPath, placeholders);
        }
      }),
    );
  }

  /**
   * Copy a single file, processing templates if needed
   */
  private static async copyFile(
    source: string,
    destination: string,
    placeholders?: Record<string, string>,
  ): Promise<void> {
    // Check if this is a template file
    const isMdTemplate = source.endsWith('.template.md');
    const isJsTemplate = source.endsWith('.template.js');

    if (isMdTemplate) {
      // Remove .template from destination filename
      destination = destination.replace('.template.md', '.md');
    } else if (isJsTemplate) {
      destination = destination.replace('.template.js', '.js');
    }

    // Detect binary files by extension
    const binaryExtensions = [
      '.png',
      '.jpg',
      '.jpeg',
      '.gif',
      '.svg',
      '.ico',
      '.woff',
      '.woff2',
      '.ttf',
      '.eot',
    ];
    const isBinary = binaryExtensions.some((ext) =>
      source.toLowerCase().endsWith(ext),
    );

    if (isBinary) {
      // Copy binary files directly without text processing
      const content = await fs.readFile(source);
      await fs.writeFile(destination, content);
    } else {
      // Read text file content
      let content = await fs.readFile(source, 'utf-8');

      // Replace placeholders if provided
      if (placeholders) {
        content = this.replacePlaceholders(content, placeholders);
      }

      // Write to destination
      await fs.writeFile(destination, content);
    }
  }

  /**
   * Replace {{PLACEHOLDER}} with actual values
   */
  private static replacePlaceholders(
    content: string,
    placeholders: Record<string, string>,
  ): string {
    let result = content;

    // Replace all provided placeholders
    for (const [key, value] of Object.entries(placeholders)) {
      const placeholder = `{{${key}}}`;
      result = result.replaceAll(placeholder, value);
    }

    // Validate: check for remaining unreplaced placeholders
    const remainingPlaceholders = result.match(/\{\{([A-Z_]+)\}\}/g);
    if (remainingPlaceholders && remainingPlaceholders.length > 0) {
      const missing = remainingPlaceholders
        .map((p) => p.slice(2, -2))
        .join(', ');
      console.warn(`⚠️  Warning: Unreplaced placeholders found: ${missing}`);
    }

    return result;
  }

  /**
   * Check if template directory exists
   */
  static async templateExists(
    templateName: 'sdk' | 'cli' | 'n8n',
  ): Promise<boolean> {
    const templateDir = path.join(__dirname, 'templates', templateName);

    try {
      await fs.access(templateDir);
      return true;
    } catch {
      return false;
    }
  }
}
