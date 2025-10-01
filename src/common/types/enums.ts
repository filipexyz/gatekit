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
