export class PermissionResponse {
  authType: 'api-key' | 'jwt';
  permissions: string[];
  project?: {
    id: string;
    name: string;
  };
  user?: {
    userId: string;
    email?: string;
    name?: string;
  };
  apiKey?: {
    id: string;
    name: string;
  };
}
