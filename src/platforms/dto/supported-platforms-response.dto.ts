export class SupportedPlatformsResponse {
  platforms: Array<{
    name: string;
    displayName: string;
    connectionType: string;
    features: {
      supportsWebhooks: boolean;
      supportsPolling: boolean;
      supportsWebSocket: boolean;
    };
    credentials: {
      required: string[];
      optional: string[];
      example: Record<string, any>;
    } | null;
  }>;
}
