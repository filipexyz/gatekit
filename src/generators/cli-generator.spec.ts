import { CLIGenerator } from '../../tools/generators/cli-generator';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ExtractedContract } from '../../tools/extractors/contract-extractor.service';

describe('CLIGenerator', () => {
  let generator: CLIGenerator;
  const testOutputDir = path.join(__dirname, '../../test-output/cli');

  beforeEach(() => {
    generator = new CLIGenerator();
  });

  afterEach(async () => {
    // Clean up test output
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('duplicate options prevention', () => {
    it('should not add duplicate options when path param exists in contract options', async () => {
      const contracts: ExtractedContract[] = [
        {
          path: '/api/v1/projects/:project/keys/:keyId/revoke',
          method: 'delete',
          contractMetadata: {
            category: 'API Keys',
            command: 'api-keys revoke',
            description: 'Revoke an API key',
            options: {
              keyId: {
                type: 'string',
                description: 'API key ID to revoke',
                required: true,
              },
            },
            requiredScopes: ['keys:manage'],
          },
          inputType: undefined,
          outputType: 'RevokeKeyResponseDto',
          extractedTypes: {},
        },
      ];

      // Write test contracts
      const contractsPath = path.join(testOutputDir, 'contracts.json');
      await fs.mkdir(testOutputDir, { recursive: true });
      await fs.writeFile(contractsPath, JSON.stringify(contracts, null, 2));

      // Generate CLI
      await generator.generateFromContracts(contractsPath, testOutputDir);

      // Read generated command file
      const commandFile = await fs.readFile(
        path.join(testOutputDir, 'src/commands/api-keys.ts'),
        'utf-8',
      );

      // Count occurrences of --keyId option
      const keyIdMatches = commandFile.match(/--keyId/g);
      expect(keyIdMatches).toBeDefined();
      expect(keyIdMatches!.length).toBe(1); // Should appear exactly once

      // Verify it doesn't contain duplicate option lines
      expect(commandFile).not.toContain("'keyId parameter'");
    });

    it('should add path param as option when NOT in contract options', async () => {
      const contracts: ExtractedContract[] = [
        {
          path: '/api/v1/projects/:project/platforms/:platformId',
          method: 'get',
          contractMetadata: {
            category: 'Platforms',
            command: 'platforms get',
            description: 'Get platform details',
            options: {
              // platformId NOT in options, only in path
            },
          },
          inputType: undefined,
          outputType: 'PlatformDto',
          extractedTypes: {},
        },
      ];

      const contractsPath = path.join(testOutputDir, 'contracts.json');
      await fs.mkdir(testOutputDir, { recursive: true });
      await fs.writeFile(contractsPath, JSON.stringify(contracts, null, 2));

      await generator.generateFromContracts(contractsPath, testOutputDir);

      const commandFile = await fs.readFile(
        path.join(testOutputDir, 'src/commands/platforms.ts'),
        'utf-8',
      );

      // Should have platformId option since it's not in contract options
      expect(commandFile).toContain('--platformId');
    });

    it('should handle project param correctly with env var default', async () => {
      const contracts: ExtractedContract[] = [
        {
          path: '/api/v1/projects/:project/keys',
          method: 'post',
          contractMetadata: {
            category: 'API Keys',
            command: 'api-keys create',
            description: 'Create API key',
            options: {
              name: {
                type: 'string',
                description: 'Key name',
                required: true,
              },
            },
          },
          inputType: 'CreateKeyDto',
          outputType: 'CreateKeyResponseDto',
          extractedTypes: {},
        },
      ];

      const contractsPath = path.join(testOutputDir, 'contracts.json');
      await fs.mkdir(testOutputDir, { recursive: true });
      await fs.writeFile(contractsPath, JSON.stringify(contracts, null, 2));

      await generator.generateFromContracts(contractsPath, testOutputDir);

      const commandFile = await fs.readFile(
        path.join(testOutputDir, 'src/commands/api-keys.ts'),
        'utf-8',
      );

      // Should have project option with GATEKIT_DEFAULT_PROJECT message
      expect(commandFile).toContain('--project <value>');
      expect(commandFile).toContain('GATEKIT_DEFAULT_PROJECT');
    });
  });

  describe('command generation', () => {
    it('should generate valid package.json with correct dependencies', async () => {
      const contracts: ExtractedContract[] = [
        {
          path: '/api/v1/projects',
          method: 'get',
          contractMetadata: {
            category: 'Projects',
            command: 'projects list',
            description: 'List projects',
            options: {},
          },
          inputType: undefined,
          outputType: 'ProjectDto[]',
          extractedTypes: {},
        },
      ];

      const contractsPath = path.join(testOutputDir, 'contracts.json');
      await fs.mkdir(testOutputDir, { recursive: true });
      await fs.writeFile(contractsPath, JSON.stringify(contracts, null, 2));

      await generator.generateFromContracts(contractsPath, testOutputDir);

      const packageJson = JSON.parse(
        await fs.readFile(path.join(testOutputDir, 'package.json'), 'utf-8'),
      );

      expect(packageJson.name).toBe('@gatekit/cli');
      expect(packageJson.dependencies).toHaveProperty('@gatekit/sdk');
      expect(packageJson.dependencies).toHaveProperty('commander');
      expect(packageJson.dependencies).toHaveProperty('axios');
      expect(packageJson.devDependencies).toHaveProperty('@types/node');
      expect(packageJson.devDependencies).toHaveProperty('typescript');
    });

    it('should generate commands grouped by category', async () => {
      const contracts: ExtractedContract[] = [
        {
          path: '/api/v1/projects',
          method: 'get',
          contractMetadata: {
            category: 'Projects',
            command: 'projects list',
            description: 'List projects',
            options: {},
          },
          inputType: undefined,
          outputType: 'ProjectDto[]',
          extractedTypes: {},
        },
        {
          path: '/api/v1/projects/:project/keys',
          method: 'get',
          contractMetadata: {
            category: 'API Keys',
            command: 'api-keys list',
            description: 'List API keys',
            options: {},
          },
          inputType: undefined,
          outputType: 'ApiKeyDto[]',
          extractedTypes: {},
        },
      ];

      const contractsPath = path.join(testOutputDir, 'contracts.json');
      await fs.mkdir(testOutputDir, { recursive: true });
      await fs.writeFile(contractsPath, JSON.stringify(contracts, null, 2));

      await generator.generateFromContracts(contractsPath, testOutputDir);

      // Should create separate command files
      const projectsFile = await fs.readFile(
        path.join(testOutputDir, 'src/commands/projects.ts'),
        'utf-8',
      );
      const apiKeysFile = await fs.readFile(
        path.join(testOutputDir, 'src/commands/api-keys.ts'),
        'utf-8',
      );

      expect(projectsFile).toContain('createProjectsCommand');
      expect(projectsFile).toContain(".command('list')");
      expect(apiKeysFile).toContain('createApiKeysCommand');
      expect(apiKeysFile).toContain(".command('list')");
    });

    it('should include permission checks when required', async () => {
      const contracts: ExtractedContract[] = [
        {
          path: '/api/v1/projects/:project/keys',
          method: 'post',
          contractMetadata: {
            category: 'API Keys',
            command: 'api-keys create',
            description: 'Create API key',
            options: {},
            requiredScopes: ['keys:manage'],
          },
          inputType: 'CreateKeyDto',
          outputType: 'CreateKeyResponseDto',
          extractedTypes: {},
        },
      ];

      const contractsPath = path.join(testOutputDir, 'contracts.json');
      await fs.mkdir(testOutputDir, { recursive: true });
      await fs.writeFile(contractsPath, JSON.stringify(contracts, null, 2));

      await generator.generateFromContracts(contractsPath, testOutputDir);

      const commandFile = await fs.readFile(
        path.join(testOutputDir, 'src/commands/api-keys.ts'),
        'utf-8',
      );

      expect(commandFile).toContain('checkPermissions');
      expect(commandFile).toContain('keys:manage');
      expect(commandFile).toContain('Insufficient permissions');
    });

    it('should omit permission checks when not required', async () => {
      const contracts: ExtractedContract[] = [
        {
          path: '/api/v1/projects',
          method: 'get',
          contractMetadata: {
            category: 'Projects',
            command: 'projects list',
            description: 'List projects',
            options: {},
            // No requiredScopes
          },
          inputType: undefined,
          outputType: 'ProjectDto[]',
          extractedTypes: {},
        },
      ];

      const contractsPath = path.join(testOutputDir, 'contracts.json');
      await fs.mkdir(testOutputDir, { recursive: true });
      await fs.writeFile(contractsPath, JSON.stringify(contracts, null, 2));

      await generator.generateFromContracts(contractsPath, testOutputDir);

      const commandFile = await fs.readFile(
        path.join(testOutputDir, 'src/commands/projects.ts'),
        'utf-8',
      );

      expect(commandFile).toContain('No permissions required');
      // checkPermissions helper is always defined in file, but not called
      expect(commandFile).not.toContain(
        'const hasPermission = await checkPermissions',
      );
    });
  });

  describe('option types handling', () => {
    it('should include options in generated commands', async () => {
      const contracts: ExtractedContract[] = [
        {
          path: '/api/v1/test',
          method: 'post',
          contractMetadata: {
            category: 'Test',
            command: 'test create',
            description: 'Test with options',
            options: {
              enabled: {
                type: 'boolean',
                description: 'Enable feature',
              },
              count: {
                type: 'number',
                description: 'Item count',
              },
            },
          },
          inputType: 'TestDto',
          outputType: 'TestDto',
          extractedTypes: {},
        },
      ];

      const contractsPath = path.join(testOutputDir, 'contracts.json');
      await fs.mkdir(testOutputDir, { recursive: true });
      await fs.writeFile(contractsPath, JSON.stringify(contracts, null, 2));

      await generator.generateFromContracts(contractsPath, testOutputDir);

      const commandFile = await fs.readFile(
        path.join(testOutputDir, 'src/commands/test.ts'),
        'utf-8',
      );

      // Should have both options defined
      expect(commandFile).toContain('--enabled');
      expect(commandFile).toContain('--count');
      expect(commandFile).toContain('Enable feature');
      expect(commandFile).toContain('Item count');
    });

    it('should handle object options with JSON parsing', async () => {
      const contracts: ExtractedContract[] = [
        {
          path: '/api/v1/test',
          method: 'post',
          contractMetadata: {
            category: 'Test',
            command: 'test create',
            description: 'Test object',
            options: {
              config: {
                type: 'object',
                description: 'Configuration object',
              },
            },
          },
          inputType: 'TestDto',
          outputType: 'TestDto',
          extractedTypes: {},
        },
      ];

      const contractsPath = path.join(testOutputDir, 'contracts.json');
      await fs.mkdir(testOutputDir, { recursive: true });
      await fs.writeFile(contractsPath, JSON.stringify(contracts, null, 2));

      await generator.generateFromContracts(contractsPath, testOutputDir);

      const commandFile = await fs.readFile(
        path.join(testOutputDir, 'src/commands/test.ts'),
        'utf-8',
      );

      // Should have JSON.parse with try-catch
      expect(commandFile).toContain('JSON.parse');
      expect(commandFile).toContain('try');
      expect(commandFile).toContain('catch');
    });
  });
});
