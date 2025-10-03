# Contributing to GateKit

## Development Workflow

### Adding New Features

1. **Add @SdkContract decorators** to new endpoints in backend controllers
2. **Commit and push** to feature branch
3. **Create PR** - validation workflow runs automatically
4. **Review generated packages** in workflow artifacts (7-day retention)
5. **Merge to main**
6. **Bump version**: `npm run version:minor` (or patch/major)
7. **Push with tags**: `git push origin main --tags`
8. **Trigger publish workflow** manually in GitHub Actions

### Release Process

```bash
# 1. Ensure all changes merged to main
git checkout main && git pull

# 2. Bump version (auto-generates packages)
npm run version:patch   # Bug fixes
npm run version:minor   # New features
npm run version:major   # Breaking changes

# 3. Verify coordination
npm run version:check

# 4. Push with tags
git push origin main --tags

# 5. Go to Actions → Multi-Repo Package Publishing
# 6. Select packages to publish (SDK, CLI, n8n)
# 7. Review and merge PRs in package repos
# 8. Packages auto-publish to npm
```

**See:** [VERSIONING.md](./VERSIONING.md) for complete versioning guide.

## Architecture Benefits

### 🚀 **Automated Excellence**

- **Perfect sync** - Backend version = all packages version
- **Quality gates** - No broken packages ever reach npm
- **Version coordination** - Single source of truth (backend package.json)
- **AI-powered changelogs** - Claude Code generates release notes
- **Multi-repo automation** - PRs created across repositories

### 📦 **Published Package Quality**

```bash
# What gets published to npm:
@gatekit/sdk/
├── dist/index.js        # Clean compiled JavaScript
├── dist/index.d.ts      # Perfect TypeScript definitions
├── dist/client.js       # Beautiful gk.projects.create() API
├── dist/types.js        # All 59 auto-extracted types
└── package.json         # v1.2.1 (matches backend)

@gatekit/cli/
├── dist/index.js        # Executable CLI entry point
├── dist/commands/       # All 51 generated commands
├── dist/lib/utils.js    # Config and error handling
└── package.json         # v1.2.1, depends on @gatekit/sdk@^1.2.1

n8n-nodes-gatekit/
├── dist/nodes/          # n8n node definitions
├── dist/credentials/    # Credential types
└── package.json         # v1.2.1 (matches backend)
```

### 🎯 **Revolutionary Features**

- **Contract-driven** - Single source of truth generates everything
- **Type-safe** - Zero `any` types throughout
- **Permission-aware** - CLI adapts to user capabilities
- **Source-protected** - Backend code never exposed
- **Coordinated versioning** - All packages synchronized
- **Enterprise-ready** - Complete CI/CD with quality gates

## Template System

Generators use template-based system for static files:

**Location:** `tools/generators/templates/{sdk,cli,n8n}/`

**Placeholders:**

- `{{CATEGORY_EXAMPLES}}` - SDK examples by category
- `{{COMMAND_LIST}}` - CLI commands list
- `{{OPERATIONS_LIST}}` - n8n operations list

**Benefits:**

- Consistent package structure
- Easy updates to common files
- Separation of static config vs generated code

## Troubleshooting

### Version Mismatch

If packages have different versions:

```bash
npm run generate:all
npm run version:check
```

### Failed Workflow

Check:

1. All contracts valid (`npm run validate:contracts:types`)
2. Backend compiles (`npm run build`)
3. Tests passing (`npm test`)

### Publishing Issues

Verify:

- NPM_TOKEN secret configured in GitHub
- Version bumped in backend package.json
- All packages regenerated (`npm run generate:all`)

### Workflow Not Triggering

Check:

- File changes match path filters (controllers, decorators, tools)
- Branch is `main` for automatic workflows
- Manual workflows require repository permissions

## Security & Source Protection

### 🔒 **Source Protection Validation**

Workflows automatically verify:

- ❌ No backend controllers in published packages
- ❌ No NestJS imports in compiled code
- ❌ No Prisma references in generated files
- ❌ No database schemas in published packages

### 🛡️ **Required GitHub Secrets**

- `NPM_TOKEN` - For npm publishing (`npm token create --access=publish`)
- `PERSONAL_ACCESS_TOKEN` - For multi-repo access (Settings → Developer settings → Personal access tokens)
- `CLAUDE_CODE_OAUTH_TOKEN` - For AI changelog generation

## Code Quality

### ESLint & Pre-commit Hooks

- **All ESLint errors must be fixed** - Zero tolerance for lint errors
- **Husky + lint-staged** - Automatically format and lint on commit
- **CI/CD validation** - GitHub Actions validates code quality on every PR

### Testing Requirements

See [test/CLAUDE.md](./test/CLAUDE.md) for complete testing guidelines.

**Quick Commands:**

```bash
npm test         # Run all tests
npm test:e2e     # Run integration tests
npm test -- webhook  # Run specific test suites
```

## Links

- [CLAUDE.md](./CLAUDE.md) - Complete technical overview and architecture
- [VERSIONING.md](./VERSIONING.md) - Synchronized versioning system
- [SEMANTIC_PLAYBOOK.md](./SEMANTIC_PLAYBOOK.md) - Development conventions and patterns
- [test/CLAUDE.md](./test/CLAUDE.md) - Testing guidelines
- [.github/workflows/README.md](./.github/workflows/README.md) - GitHub Actions workflows

This revolutionary architecture ensures that GateKit maintains the most advanced API tooling in the messaging space with zero maintenance overhead!
