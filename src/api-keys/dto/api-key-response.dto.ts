export class ApiKeyResponse {
  id: string;
  key: string;
  name: string;
  prefix: string;
  scopes: string[];
  expiresAt: Date | null;
  createdAt: Date;
}

export class ApiKeyListResponse {
  id: string;
  name: string;
  maskedKey: string;
  scopes: string[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export class ApiKeyRollResponse {
  id: string;
  key: string;
  name: string;
  prefix: string;
  scopes: string[];
  expiresAt: Date | null;
  createdAt: Date;
  oldKeyRevokedAt: Date;
}
