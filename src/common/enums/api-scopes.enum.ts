/**
 * API Scopes Enum
 *
 * Defines all available API scopes for authorization.
 * Used in @RequireScopes decorator and API key generation.
 *
 * All resources follow a consistent read/write pattern:
 * - read: List, get, query operations
 * - write: Create, update, delete, send operations
 */
export enum ApiScope {
  // Identities
  IDENTITIES_READ = 'identities:read',
  IDENTITIES_WRITE = 'identities:write',

  // Projects
  PROJECTS_READ = 'projects:read',
  PROJECTS_WRITE = 'projects:write',

  // Platforms
  PLATFORMS_READ = 'platforms:read',
  PLATFORMS_WRITE = 'platforms:write',

  // Messages
  MESSAGES_READ = 'messages:read',
  MESSAGES_WRITE = 'messages:write', // Includes send, delete, react/unreact

  // Webhooks
  WEBHOOKS_READ = 'webhooks:read',
  WEBHOOKS_WRITE = 'webhooks:write',

  // API Keys
  KEYS_READ = 'keys:read',
  KEYS_WRITE = 'keys:write', // Includes create, revoke, roll

  // Members
  MEMBERS_READ = 'members:read',
  MEMBERS_WRITE = 'members:write',
}
