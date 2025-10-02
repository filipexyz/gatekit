// Re-export Prisma enums for SDK generation
// This allows the contract extractor to find these types

export enum ProjectRole {
  owner = 'owner',
  admin = 'admin',
  member = 'member',
  viewer = 'viewer',
}

export enum ProjectEnvironment {
  development = 'development',
  staging = 'staging',
  production = 'production',
}

// Re-export other common enums for SDK generation
export { PlatformType } from '../enums/platform-type.enum';
export { ApiScope } from '../enums/api-scopes.enum';
