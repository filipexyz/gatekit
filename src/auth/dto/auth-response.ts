export class AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name?: string;
    isAdmin: boolean;
  };
}
