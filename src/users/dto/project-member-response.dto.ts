import { ProjectRole } from '../../common/types/enums';

export class ProjectMemberResponse {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    name?: string;
  };
}
