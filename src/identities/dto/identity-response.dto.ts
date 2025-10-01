/**
 * Identity response DTO for API contracts
 * Represents a unified user identity across multiple platforms
 */
export class Identity {
  id: string;
  projectId: string;
  displayName: string | null;
  email: string | null;
  metadata: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
  aliases: IdentityAlias[];
}

/**
 * Identity alias response DTO for API contracts
 * Represents a platform-specific user identifier linked to an identity
 */
export class IdentityAlias {
  id: string;
  identityId: string;
  projectId: string;
  platformId: string;
  platform: string;
  providerUserId: string;
  providerUserDisplay: string | null;
  linkedAt: Date;
  linkMethod: 'manual' | 'automatic';
}
