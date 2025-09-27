import { CaseConverter } from './case-converter';

describe('CaseConverter', () => {
  describe('toPascalCase', () => {
    const testCases = [
      ['project members', 'ProjectMembers'],
      ['api-keys', 'ApiKeys'],
      ['user_profile', 'UserProfile'],
      ['single', 'Single'],
      ['multi word input', 'MultiWordInput'],
      ['snake_case_input', 'SnakeCaseInput'],
      ['kebab-case-input', 'KebabCaseInput'],
      ['  spaced  input  ', 'SpacedInput'],
      ['', ''],
      ['a', 'A'],
      ['123test', '123test'],
      ['test123', 'Test123'],
    ];

    testCases.forEach(([input, expected]) => {
      it(`should convert "${input}" to "${expected}"`, () => {
        expect(CaseConverter.toPascalCase(input)).toBe(expected);
      });
    });
  });

  describe('toCamelCase', () => {
    const testCases = [
      ['project members', 'projectMembers'],
      ['api-keys', 'apiKeys'],
      ['user_profile', 'userProfile'],
      ['single', 'single'],
      ['Multi Word Input', 'multiWordInput'],
      ['Snake_Case_Input', 'snakeCaseInput'],
      ['Kebab-Case-Input', 'kebabCaseInput'],
      ['  Spaced  Input  ', 'spacedInput'],
      ['', ''],
      ['A', 'a'],
      ['123test', '123test'],
      ['Test123', 'test123'],
    ];

    testCases.forEach(([input, expected]) => {
      it(`should convert "${input}" to "${expected}"`, () => {
        expect(CaseConverter.toCamelCase(input)).toBe(expected);
      });
    });
  });

  describe('toKebabCase', () => {
    const testCases = [
      ['project members', 'project-members'],
      ['ProjectMembers', 'project-members'],
      ['apiKeys', 'api-keys'],
      ['user_profile', 'user-profile'],
      ['single', 'single'],
      ['Multi Word Input', 'multi-word-input'],
      ['Snake_Case_Input', 'snake-case-input'],
      ['  Spaced  Input  ', 'spaced-input'],
      ['', ''],
      ['A', 'a'],
      ['XMLHttpRequest', 'xmlhttp-request'],
      ['iPhone', 'i-phone'],
    ];

    testCases.forEach(([input, expected]) => {
      it(`should convert "${input}" to "${expected}"`, () => {
        expect(CaseConverter.toKebabCase(input)).toBe(expected);
      });
    });
  });

  describe('toSnakeCase', () => {
    const testCases = [
      ['project members', 'project_members'],
      ['ProjectMembers', 'project_members'],
      ['apiKeys', 'api_keys'],
      ['user-profile', 'user_profile'],
      ['single', 'single'],
      ['Multi Word Input', 'multi_word_input'],
      ['Kebab-Case-Input', 'kebab_case_input'],
      ['  Spaced  Input  ', 'spaced_input'],
      ['', ''],
      ['A', 'a'],
      ['XMLHttpRequest', 'xmlhttp_request'],
      ['iPhone', 'i_phone'],
    ];

    testCases.forEach(([input, expected]) => {
      it(`should convert "${input}" to "${expected}"`, () => {
        expect(CaseConverter.toSnakeCase(input)).toBe(expected);
      });
    });
  });

  describe('toScreamingSnakeCase', () => {
    const testCases = [
      ['project members', 'PROJECT_MEMBERS'],
      ['ProjectMembers', 'PROJECT_MEMBERS'],
      ['apiKeys', 'API_KEYS'],
      ['user-profile', 'USER_PROFILE'],
      ['single', 'SINGLE'],
      ['', ''],
    ];

    testCases.forEach(([input, expected]) => {
      it(`should convert "${input}" to "${expected}"`, () => {
        expect(CaseConverter.toScreamingSnakeCase(input)).toBe(expected);
      });
    });
  });

  describe('toLowerSpaced', () => {
    const testCases = [
      ['ProjectMembers', 'project members'],
      ['apiKeys', 'api keys'],
      ['user-profile', 'user profile'],
      ['user_profile', 'user profile'],
      ['single', 'single'],
      ['Multi Word Input', 'multi word input'],
      ['', ''],
      ['A', 'a'],
    ];

    testCases.forEach(([input, expected]) => {
      it(`should convert "${input}" to "${expected}"`, () => {
        expect(CaseConverter.toLowerSpaced(input)).toBe(expected);
      });
    });
  });

  describe('toValidPropertyName', () => {
    const testCases = [
      ['project members', 'projectMembers'],
      ['123test', '_123test'],
      ['class', 'class_'],
      ['function', 'function_'],
      ['return', 'return_'],
      ['normal name', 'normalName'],
      ['', ''],
      ['delete', 'delete_'],
      ['import', 'import_'],
    ];

    testCases.forEach(([input, expected]) => {
      it(`should convert "${input}" to valid property name "${expected}"`, () => {
        expect(CaseConverter.toValidPropertyName(input)).toBe(expected);
      });
    });
  });

  describe('toValidClassName', () => {
    const testCases = [
      ['project members', 'ProjectMembers'],
      ['123test', '_123test'],
      ['class', 'Class'],
      ['function', 'Function'],
      ['normal name', 'NormalName'],
      ['', ''],
      ['single', 'Single'],
    ];

    testCases.forEach(([input, expected]) => {
      it(`should convert "${input}" to valid class name "${expected}"`, () => {
        expect(CaseConverter.toValidClassName(input)).toBe(expected);
      });
    });
  });

  describe('toValidFilename', () => {
    const testCases = [
      ['project members', 'project-members'],
      ['Project Members!@#', 'project-members'],
      ['123test', '123test'],
      ['test---name', 'test-name'],
      ['---test---', 'test'],
      ['', ''],
      ['Test With Symbols!@#$%', 'test-with-symbols'],
      ['normal-name', 'normal-name'],
    ];

    testCases.forEach(([input, expected]) => {
      it(`should convert "${input}" to valid filename "${expected}"`, () => {
        expect(CaseConverter.toValidFilename(input)).toBe(expected);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle null and undefined inputs', () => {
      expect(CaseConverter.toPascalCase('')).toBe('');
      expect(CaseConverter.toCamelCase('')).toBe('');
      expect(CaseConverter.toKebabCase('')).toBe('');
      expect(CaseConverter.toSnakeCase('')).toBe('');
    });

    it('should handle single characters', () => {
      expect(CaseConverter.toPascalCase('a')).toBe('A');
      expect(CaseConverter.toCamelCase('A')).toBe('a');
      expect(CaseConverter.toKebabCase('A')).toBe('a');
    });

    it('should handle numbers and special characters', () => {
      expect(CaseConverter.toPascalCase('test123 name')).toBe('Test123Name');
      expect(CaseConverter.toCamelCase('123 test')).toBe('123Test');
      expect(CaseConverter.toKebabCase('Test123Name')).toBe('test123-name');
    });

    it('should handle consecutive separators', () => {
      expect(CaseConverter.toPascalCase('test---name___here')).toBe(
        'TestNameHere',
      );
      expect(CaseConverter.toCamelCase('test   name   here')).toBe(
        'testNameHere',
      );
      expect(CaseConverter.toKebabCase('test___name')).toBe('test-name');
    });
  });
});
