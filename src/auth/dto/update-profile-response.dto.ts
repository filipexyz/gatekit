export class UpdateProfileResponse {
  message: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}
