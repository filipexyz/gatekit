import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AppModule } from '../../src/app.module';
import { ProjectRole, ProjectEnvironment } from '@prisma/client';
import { ProjectsService } from '../../src/projects/projects.service';
import { MembersService } from '../../src/members/members.service';

describe('User-Project System (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let testUser1: any;
  let testUser2: any;
  let adminUser: any;
  let testProject: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    await app.init();

    // Create test users
    testUser1 = await prisma.user.create({
      data: {
        auth0Id: 'auth0|testuser1',
        email: 'user1@test.com',
        name: 'Test User 1',
        isAdmin: false,
      },
    });

    testUser2 = await prisma.user.create({
      data: {
        auth0Id: 'auth0|testuser2',
        email: 'user2@test.com',
        name: 'Test User 2',
        isAdmin: false,
      },
    });

    adminUser = await prisma.user.create({
      data: {
        auth0Id: 'auth0|adminuser',
        email: 'admin@test.com',
        name: 'Admin User',
        isAdmin: true,
      },
    });

    // Create test project owned by user1
    testProject = await prisma.project.create({
      data: {
        name: 'Test Project',
        id: 'test-project-e2e',
        environment: ProjectEnvironment.development,
        ownerId: testUser1.id,
      },
    });
  });

  afterAll(async () => {
    // Clean up
    await prisma.projectMember.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  describe('User Project Ownership', () => {
    it('should create user from Auth0 payload', async () => {
      const auth0Payload = {
        sub: 'auth0|newuser',
        email: 'newuser@test.com',
        name: 'New User',
      };

      const membersService = app.get(MembersService);
      const user = await membersService.upsertFromAuth0(auth0Payload);

      expect(user.auth0Id).toBe(auth0Payload.sub);
      expect(user.email).toBe(auth0Payload.email);
      expect(user.name).toBe(auth0Payload.name);
      expect(user.isAdmin).toBe(false);

      // Clean up
      await prisma.user.delete({ where: { id: user.id } });
    });

    it('should create project with user ownership', async () => {
      const projectsService = app.get(ProjectsService);

      const createDto = {
        name: 'User Owned Project',
        environment: ProjectEnvironment.development,
      };

      const project = await projectsService.create(createDto, testUser1.id);

      expect(project.ownerId).toBe(testUser1.id);
      expect(project.owner.email).toBe(testUser1.email);
      expect(project.name).toBe(createDto.name);

      // Clean up
      await prisma.project.delete({ where: { id: project.id } });
    });

    it('should return only accessible projects for regular users', async () => {
      const projectsService = app.get(ProjectsService);

      // User1 should see their own project
      const user1Projects = await projectsService.findAllForUser(
        testUser1.id,
        false,
      );
      expect(user1Projects).toHaveLength(1);
      expect(user1Projects[0].id).toBe(testProject.id);

      // User2 should see no projects (not a member)
      const user2Projects = await projectsService.findAllForUser(
        testUser2.id,
        false,
      );
      expect(user2Projects).toHaveLength(0);
    });

    it('should return all projects for admin users', async () => {
      const projectsService = app.get(ProjectsService);

      const adminProjects = await projectsService.findAllForUser(
        adminUser.id,
        true,
      );
      expect(adminProjects.length).toBeGreaterThanOrEqual(1);
      expect(adminProjects.some((p) => p.id === testProject.id)).toBe(true);
    });
  });

  describe('Project Access Control', () => {
    it('should allow project owner full access', async () => {
      const projectsService = app.get(ProjectsService);

      const hasAccess = await projectsService.checkProjectAccess(
        testUser1.id,
        testProject.id,
        ProjectRole.admin,
        false,
      );

      expect(hasAccess).toBe(true);
    });

    it('should deny access to non-member users', async () => {
      const projectsService = app.get(ProjectsService);

      const hasAccess = await projectsService.checkProjectAccess(
        testUser2.id,
        testProject.id,
        ProjectRole.viewer,
        false,
      );

      expect(hasAccess).toBe(false);
    });

    it('should allow global admin access to any project', async () => {
      const projectsService = app.get(ProjectsService);

      const hasAccess = await projectsService.checkProjectAccess(
        adminUser.id,
        testProject.id,
        ProjectRole.admin,
        true,
      );

      expect(hasAccess).toBe(true);
    });

    it('should prevent non-owner from deleting project', async () => {
      const projectsService = app.get(ProjectsService);

      await expect(
        projectsService.remove(testProject.id, testUser2.id, false),
      ).rejects.toThrow(
        'Only project owners or global admins can delete projects',
      );
    });

    it('should allow admin to delete any project', async () => {
      // Create a temporary project for deletion test
      const tempProject = await prisma.project.create({
        data: {
          name: 'Temp Project',
          id: 'temp-project-delete',
          environment: ProjectEnvironment.development,
          ownerId: testUser2.id,
        },
      });

      const projectsService = app.get(ProjectsService);

      // Admin should be able to delete it
      const result = await projectsService.remove(
        tempProject.id,
        adminUser.id,
        true,
      );
      expect(result.id).toBe(tempProject.id);

      // Verify it's deleted
      const deletedProject = await prisma.project.findUnique({
        where: { id: tempProject.id },
      });
      expect(deletedProject).toBeNull();
    });
  });

  describe('Project Member Management', () => {
    let membershipTestProject: any;

    beforeAll(async () => {
      membershipTestProject = await prisma.project.create({
        data: {
          name: 'Membership Test Project',
          id: 'membership-test',
          environment: ProjectEnvironment.development,
          ownerId: testUser1.id,
        },
      });
    });

    afterAll(async () => {
      await prisma.projectMember.deleteMany({
        where: { projectId: membershipTestProject.id },
      });
      await prisma.project.delete({
        where: { id: membershipTestProject.id },
      });
    });

    it('should add member to project', async () => {
      const membersService = app.get(MembersService);

      const member = await membersService.addProjectMember(
        membershipTestProject.id,
        testUser2.email,
        ProjectRole.member,
        testUser1.id,
      );

      expect(member.userId).toBe(testUser2.id);
      expect(member.role).toBe(ProjectRole.member);
      expect(member.user.email).toBe(testUser2.email);
    });

    it('should update member role', async () => {
      const membersService = app.get(MembersService);

      const updatedMember = await membersService.updateProjectMemberRole(
        membershipTestProject.id,
        testUser2.id,
        ProjectRole.admin,
        testUser1.id,
      );

      expect(updatedMember.role).toBe(ProjectRole.admin);
    });

    it('should allow member access after being added', async () => {
      const projectsService = app.get(ProjectsService);

      const hasAccess = await projectsService.checkProjectAccess(
        testUser2.id,
        membershipTestProject.id,
        ProjectRole.member,
        false,
      );

      expect(hasAccess).toBe(true);
    });

    it('should include project in member accessible projects', async () => {
      const projectsService = app.get(ProjectsService);

      const user2Projects = await projectsService.findAllForUser(
        testUser2.id,
        false,
      );
      expect(user2Projects.some((p) => p.id === membershipTestProject.id)).toBe(
        true,
      );
    });

    it('should remove member from project', async () => {
      const membersService = app.get(MembersService);

      await membersService.removeProjectMember(
        membershipTestProject.id,
        testUser2.id,
        testUser1.id,
      );

      // Verify member was removed
      const projectsService = app.get(ProjectsService);
      const hasAccess = await projectsService.checkProjectAccess(
        testUser2.id,
        membershipTestProject.id,
        ProjectRole.viewer,
        false,
      );

      expect(hasAccess).toBe(false);
    });

    it('should prevent removing project owner as member', async () => {
      const membersService = app.get(MembersService);

      await expect(
        membersService.removeProjectMember(
          membershipTestProject.id,
          testUser1.id, // Project owner
          testUser1.id,
        ),
      ).rejects.toThrow('Cannot remove project owner from members');
    });

    it('should prevent changing project owner role', async () => {
      const membersService = app.get(MembersService);

      await expect(
        membersService.updateProjectMemberRole(
          membershipTestProject.id,
          testUser1.id, // Project owner
          ProjectRole.member,
          testUser1.id,
        ),
      ).rejects.toThrow('Cannot change role of project owner');
    });
  });

  describe('Role Hierarchy', () => {
    let hierarchyTestProject: any;
    let viewerUser: any;
    let memberUser: any;
    let adminUserMember: any;

    beforeAll(async () => {
      // Create users with different roles
      viewerUser = await prisma.user.create({
        data: {
          auth0Id: 'auth0|viewer',
          email: 'viewer@test.com',
          name: 'Viewer User',
        },
      });

      memberUser = await prisma.user.create({
        data: {
          auth0Id: 'auth0|member',
          email: 'member@test.com',
          name: 'Member User',
        },
      });

      adminUserMember = await prisma.user.create({
        data: {
          auth0Id: 'auth0|projectadmin',
          email: 'projectadmin@test.com',
          name: 'Project Admin User',
        },
      });

      hierarchyTestProject = await prisma.project.create({
        data: {
          name: 'Hierarchy Test Project',
          id: 'hierarchy-test',
          environment: ProjectEnvironment.development,
          ownerId: testUser1.id,
        },
      });

      // Add members with different roles
      await prisma.projectMember.createMany({
        data: [
          {
            projectId: hierarchyTestProject.id,
            userId: viewerUser.id,
            role: ProjectRole.viewer,
          },
          {
            projectId: hierarchyTestProject.id,
            userId: memberUser.id,
            role: ProjectRole.member,
          },
          {
            projectId: hierarchyTestProject.id,
            userId: adminUserMember.id,
            role: ProjectRole.admin,
          },
        ],
      });
    });

    afterAll(async () => {
      await prisma.projectMember.deleteMany({
        where: { projectId: hierarchyTestProject.id },
      });
      await prisma.project.delete({
        where: { id: hierarchyTestProject.id },
      });
      await prisma.user.deleteMany({
        where: {
          id: {
            in: [viewerUser.id, memberUser.id, adminUserMember.id],
          },
        },
      });
    });

    const accessTests = [
      // [userId, requiredRole, expected]
      ['owner', ProjectRole.viewer, true],
      ['owner', ProjectRole.member, true],
      ['owner', ProjectRole.admin, true],
      ['admin', ProjectRole.viewer, true],
      ['admin', ProjectRole.member, true],
      ['admin', ProjectRole.admin, true],
      ['member', ProjectRole.viewer, true],
      ['member', ProjectRole.member, true],
      ['member', ProjectRole.admin, false],
      ['viewer', ProjectRole.viewer, true],
      ['viewer', ProjectRole.member, false],
      ['viewer', ProjectRole.admin, false],
    ];

    accessTests.forEach(([userType, requiredRole, expected]) => {
      it(`should ${expected ? 'allow' : 'deny'} ${userType} access when ${requiredRole} required`, async () => {
        const projectsService = app.get(ProjectsService);

        let userId: string;
        switch (userType) {
          case 'owner':
            userId = testUser1.id;
            break;
          case 'admin':
            userId = adminUserMember.id;
            break;
          case 'member':
            userId = memberUser.id;
            break;
          case 'viewer':
            userId = viewerUser.id;
            break;
        }

        const hasAccess = await projectsService.checkProjectAccess(
          userId,
          hierarchyTestProject.id,
          requiredRole as ProjectRole,
          false,
        );

        expect(hasAccess).toBe(expected);
      });
    });
  });
});
