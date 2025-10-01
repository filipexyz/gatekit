import { ProjectRole } from '../../common/types/enums';

export class AddMemberDto {
  email: string;
  role: ProjectRole;
}
