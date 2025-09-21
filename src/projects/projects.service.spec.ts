import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    project: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    apiKey: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    prisma = module.get<PrismaService>(PrismaService);

    // Reset all mocks
    Object.values(mockPrismaService.project).forEach(mockFn => {
      (mockFn as jest.Mock).mockReset();
    });
    (mockPrismaService.apiKey.count as jest.Mock).mockReset();
  });

  describe('create', () => {
    it('should create a project with generated slug', async () => {
      const createDto = { name: 'Test Project' };
      const expectedSlug = 'test-project';
      const createdProject = {
        id: 'project-id',
        name: 'Test Project',
        slug: expectedSlug,
        environment: 'development',
        isDefault: false,
      };

      mockPrismaService.project.findUnique.mockResolvedValue(null);
      mockPrismaService.project.create.mockResolvedValue(createdProject);

      const result = await service.create(createDto);

      expect(mockPrismaService.project.findUnique).toHaveBeenCalledWith({
        where: { slug: expectedSlug },
      });
      expect(mockPrismaService.project.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Test Project',
          slug: expectedSlug,
        }),
      });
      expect(result).toEqual(createdProject);
    });

    it('should throw ConflictException when slug already exists', async () => {
      const createDto = { name: 'Test Project' };

      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'existing-id',
        slug: 'test-project',
      });

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });

    it('should set as default and unset other defaults when isDefault is true', async () => {
      const createDto = { name: 'Default Project', isDefault: true };

      mockPrismaService.project.findUnique.mockResolvedValue(null);
      mockPrismaService.project.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.project.create.mockResolvedValue({
        id: 'project-id',
        name: 'Default Project',
        slug: 'default-project',
        isDefault: true,
      });

      await service.create(createDto);

      expect(mockPrismaService.project.updateMany).toHaveBeenCalledWith({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    });
  });

  describe('findAll', () => {
    it('should return all projects with API key count', async () => {
      const projects = [
        { id: '1', name: 'Project 1', _count: { apiKeys: 5 } },
        { id: '2', name: 'Project 2', _count: { apiKeys: 3 } },
      ];

      mockPrismaService.project.findMany.mockResolvedValue(projects);

      const result = await service.findAll();

      expect(mockPrismaService.project.findMany).toHaveBeenCalledWith({
        include: {
          _count: {
            select: { apiKeys: true },
          },
        },
      });
      expect(result).toEqual(projects);
    });
  });

  describe('findOne', () => {
    it('should return project with active API keys', async () => {
      const project = {
        id: 'project-id',
        name: 'Test Project',
        slug: 'test-project',
        apiKeys: [],
        _count: { apiKeys: 2, projectPlatforms: 1 },
      };

      mockPrismaService.project.findUnique.mockResolvedValue(project);

      const result = await service.findOne('test-project');

      expect(mockPrismaService.project.findUnique).toHaveBeenCalledWith({
        where: { slug: 'test-project' },
        include: {
          apiKeys: {
            where: { revokedAt: null },
            select: expect.any(Object),
          },
          _count: {
            select: {
              apiKeys: true,
              projectPlatforms: true,
            },
          },
        },
      });
      expect(result).toEqual(project);
    });

    it('should throw NotFoundException when project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update project successfully', async () => {
      const updateDto = { name: 'Updated Name' };
      const existingProject = { id: 'project-id', slug: 'test-project' };
      const updatedProject = { ...existingProject, name: 'Updated Name' };

      mockPrismaService.project.findUnique.mockResolvedValue(existingProject);
      mockPrismaService.project.update.mockResolvedValue(updatedProject);

      const result = await service.update('test-project', updateDto);

      expect(result).toEqual(updatedProject);
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent', {})).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when updating to existing slug', async () => {
      const updateDto = { slug: 'existing-slug' };

      mockPrismaService.project.findUnique
        .mockResolvedValueOnce({ id: 'project-id', slug: 'test-project' })
        .mockResolvedValueOnce({ id: 'another-id', slug: 'existing-slug' });

      await expect(service.update('test-project', updateDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should delete project with no active API keys', async () => {
      const project = {
        id: 'project-id',
        slug: 'test-project',
        _count: { apiKeys: 0 },
      };

      mockPrismaService.project.findUnique.mockResolvedValue(project);
      mockPrismaService.project.delete.mockResolvedValue(project);

      const result = await service.remove('test-project');

      expect(mockPrismaService.project.delete).toHaveBeenCalledWith({
        where: { slug: 'test-project' },
      });
      expect(result).toEqual(project);
    });

    it('should throw ConflictException when project has active API keys', async () => {
      const project = {
        id: 'project-id',
        slug: 'test-project',
        _count: { apiKeys: 2 },
      };

      mockPrismaService.project.findUnique.mockResolvedValue(project);
      mockPrismaService.apiKey.count.mockResolvedValue(1);

      await expect(service.remove('test-project')).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});