/**
 * API Scopes Enum
 *
 * Defines all available API scopes for authorization.
 * Used in @RequireScopes decorator and API key generation.
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
  MESSAGES_WRITE = 'messages:write',
  MESSAGES_SEND = 'messages:send',

  // Webhooks
  WEBHOOKS_READ = 'webhooks:read',
  WEBHOOKS_WRITE = 'webhooks:write',

  // API Keys
  KEYS_READ = 'keys:read',
  KEYS_MANAGE = 'keys:manage',

  // Members
  MEMBERS_READ = 'members:read',
  MEMBERS_WRITE = 'members:write',
}
