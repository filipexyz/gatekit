import { z } from 'zod';

const GATEKIT_API_URL = import.meta.env.VITE_GATEKIT_API_URL || 'https://api.gatekit.dev';

export const MessageTargetSchema = z.object({
  platformId: z.string(),
  type: z.enum(['user', 'channel', 'group']),
  id: z.string(),
});

export const MessageSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  targets: z.array(MessageTargetSchema),
  content: z.string(),
  status: z.enum(['pending', 'sent', 'delivered', 'failed']),
  metadata: z.record(z.any()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const PlatformSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  type: z.string(),
  name: z.string(),
  status: z.enum(['active', 'inactive', 'error']),
  createdAt: z.string(),
  metadata: z.record(z.any()),
});

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  scopes: z.array(z.string()),
  createdAt: z.string(),
});

export const ApiKeySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  key: z.string().optional(),
  scopes: z.array(z.string()),
  lastUsedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const WhoAmISchema = z.object({
  projectId: z.string(),
  keyId: z.string(),
  scopes: z.array(z.string()),
});

export const MessageStatsSchema = z.object({
  total: z.number(),
  sent: z.number(),
  delivered: z.number(),
  failed: z.number(),
  pending: z.number(),
  byPlatform: z.record(z.number()),
  byDate: z.array(
    z.object({
      date: z.string(),
      count: z.number(),
    })
  ),
});

export type MessageTarget = z.infer<typeof MessageTargetSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type Platform = z.infer<typeof PlatformSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type ApiKey = z.infer<typeof ApiKeySchema>;
export type WhoAmI = z.infer<typeof WhoAmISchema>;
export type MessageStats = z.infer<typeof MessageStatsSchema>;

export class GateKitClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = GATEKIT_API_URL) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    schema?: z.ZodSchema<T>
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
      throw new Error(error.message || `Erro na requisição: ${response.status}`);
    }

    const data = await response.json();

    if (schema) {
      return schema.parse(data);
    }

    return data as T;
  }

  async whoami(): Promise<WhoAmI> {
    return this.request('/v1/auth/whoami', {}, WhoAmISchema);
  }

  async getProject(projectId: string): Promise<Project> {
    return this.request(`/v1/projects/${projectId}`, {}, ProjectSchema);
  }

  async listProjects(): Promise<Project[]> {
    return this.request('/v1/projects', {}, z.array(ProjectSchema));
  }

  async createProject(name: string, slug: string): Promise<Project> {
    return this.request(
      '/v1/projects',
      {
        method: 'POST',
        body: JSON.stringify({ name, slug }),
      },
      ProjectSchema
    );
  }

  async sendMessage(
    projectId: string,
    targets: MessageTarget[],
    content: string,
    metadata?: Record<string, any>
  ): Promise<Message> {
    return this.request(
      `/v1/projects/${projectId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({ targets, content, metadata }),
      },
      MessageSchema
    );
  }

  async listMessages(
    projectId: string,
    filters?: {
      status?: string;
      platformId?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<Message[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.platformId) params.append('platformId', filters.platformId);
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.offset) params.append('offset', String(filters.offset));

    const query = params.toString();
    const endpoint = `/v1/projects/${projectId}/messages${query ? `?${query}` : ''}`;

    return this.request(endpoint, {}, z.array(MessageSchema));
  }

  async getMessage(projectId: string, messageId: string): Promise<Message> {
    return this.request(
      `/v1/projects/${projectId}/messages/${messageId}`,
      {},
      MessageSchema
    );
  }

  async getMessageStats(
    projectId: string,
    period?: { start: string; end: string }
  ): Promise<MessageStats> {
    const params = new URLSearchParams();
    if (period?.start) params.append('start', period.start);
    if (period?.end) params.append('end', period.end);

    const query = params.toString();
    const endpoint = `/v1/projects/${projectId}/messages/stats${query ? `?${query}` : ''}`;

    return this.request(endpoint, {}, MessageStatsSchema);
  }

  async listPlatforms(projectId: string): Promise<Platform[]> {
    return this.request(
      `/v1/projects/${projectId}/platforms`,
      {},
      z.array(PlatformSchema)
    );
  }

  async getPlatform(projectId: string, platformId: string): Promise<Platform> {
    return this.request(
      `/v1/projects/${projectId}/platforms/${platformId}`,
      {},
      PlatformSchema
    );
  }

  async createPlatform(
    projectId: string,
    type: string,
    name: string,
    credentials: Record<string, any>
  ): Promise<Platform> {
    return this.request(
      `/v1/projects/${projectId}/platforms`,
      {
        method: 'POST',
        body: JSON.stringify({ type, name, credentials }),
      },
      PlatformSchema
    );
  }

  async updatePlatform(
    projectId: string,
    platformId: string,
    updates: { name?: string; credentials?: Record<string, any> }
  ): Promise<Platform> {
    return this.request(
      `/v1/projects/${projectId}/platforms/${platformId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      },
      PlatformSchema
    );
  }

  async deletePlatform(projectId: string, platformId: string): Promise<void> {
    await this.request(`/v1/projects/${projectId}/platforms/${platformId}`, {
      method: 'DELETE',
    });
  }

  async listApiKeys(projectId: string): Promise<ApiKey[]> {
    return this.request(
      `/v1/projects/${projectId}/keys`,
      {},
      z.array(ApiKeySchema)
    );
  }

  async createApiKey(
    projectId: string,
    name: string,
    scopes: string[]
  ): Promise<ApiKey> {
    return this.request(
      `/v1/projects/${projectId}/keys`,
      {
        method: 'POST',
        body: JSON.stringify({ name, scopes }),
      },
      ApiKeySchema
    );
  }

  async revokeApiKey(projectId: string, keyId: string): Promise<void> {
    await this.request(`/v1/projects/${projectId}/keys/${keyId}`, {
      method: 'DELETE',
    });
  }

  async getPlatformLogs(
    projectId: string,
    platformId: string,
    filters?: {
      level?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<any[]> {
    const params = new URLSearchParams();
    if (filters?.level) params.append('level', filters.level);
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.offset) params.append('offset', String(filters.offset));

    const query = params.toString();
    const endpoint = `/v1/projects/${projectId}/platforms/${platformId}/logs${query ? `?${query}` : ''}`;

    return this.request(endpoint, {}, z.array(z.any()));
  }
}

export const AVAILABLE_SCOPES = [
  'projects:read',
  'projects:write',
  'messages:send',
  'messages:read',
  'platforms:read',
  'platforms:write',
  'keys:read',
  'keys:write',
  'members:read',
  'members:write',
  'logs:read',
  'stats:read',
] as const;

export type Scope = typeof AVAILABLE_SCOPES[number];

export function hasScope(userScopes: string[], requiredScope: Scope): boolean {
  return userScopes.includes(requiredScope) || userScopes.includes('*');
}

export function hasAnyScope(userScopes: string[], requiredScopes: Scope[]): boolean {
  return requiredScopes.some(scope => hasScope(userScopes, scope));
}

export function hasAllScopes(userScopes: string[], requiredScopes: Scope[]): boolean {
  return requiredScopes.every(scope => hasScope(userScopes, scope));
}
