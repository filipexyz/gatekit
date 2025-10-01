/**
 * Identity response DTO for API contracts
 * Represents a unified user identity across multiple platforms
 */
export class IdentityResponse {
  id: string;
  projectId: string;
  displayName: string | null;
  email: string | null;
  metadata: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
  aliases: IdentityAliasResponse[];
}

/**
 * Identity alias response DTO for API contracts
 * Represents a platform-specific user identifier linked to an identity
 */
export class IdentityAliasResponse {
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
