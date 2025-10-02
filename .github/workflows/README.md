# GitHub Actions Workflows

This directory contains automated workflows for the contract-driven SDK, CLI, and n8n generation system.

## Workflows

### `multi-repo-publish.yml`

**Manual trigger** - Publishing packages across multiple repositories.

**Triggers:**

- Manual workflow dispatch from GitHub Actions UI

**Usage:**

1. Bump version locally: `npm run version:patch`
2. Push to main: `git push origin main --tags`
3. Go to GitHub Actions → "Multi-Repo Package Publishing"
4. Click "Run workflow"
5. Select packages to publish (SDK, CLI, n8n)

**What it does:**

- Generates all packages from backend contracts
- Verifies version coordination (all packages match backend)
- Creates PRs in package repositories with AI-generated changelogs
- After PR merge → packages publish to npm automatically

### `validate-generation.yml`

**Automatic trigger** - Quality assurance for contract system.

**Triggers:**

- Push to `main` affecting `src/*/controllers/`, `src/*/decorators/`, `tools/`
- Pull requests to `main` affecting same paths

**Validation steps:**

- Contract extraction and validation
- Package generation (SDK, CLI, n8n)
- Compilation verification
- Source protection checks
- E2E testing
- Artifact storage (7 days)

### `test-generation.yml`

**Manual trigger** - Testing package generation.

**Usage:**

- Test compilation of generated packages
- Validate package structure
- Performance benchmarks

### `ci.yml`

**Automatic trigger** - Main CI/CD pipeline.

**Triggers:**

- All pushes and pull requests

**Runs:**

- Unit tests
- E2E tests
- Linting
- Build verification

## Version Management

**Coordinated Versioning:**

All packages share the same version from backend `package.json`:

```
Backend v1.2.1 → @gatekit/sdk@1.2.1
                 @gatekit/cli@1.2.1
                 n8n-nodes-gatekit@1.2.1
```

**Commands:**

```bash
npm run version:patch   # 1.2.1 → 1.2.2
npm run version:minor   # 1.2.1 → 1.3.0
npm run version:major   # 1.2.1 → 2.0.0
npm run version:check   # Verify coordination
```

See [VERSIONING.md](../VERSIONING.md) for complete guide.

## Required GitHub Secrets

- `NPM_TOKEN` - npm publishing (`npm token create --access=publish`)
- `PERSONAL_ACCESS_TOKEN` - Multi-repo access (GitHub Settings → Developer settings)
- `CLAUDE_CODE_OAUTH_TOKEN` - AI changelog generation

## Links

- [CONTRIBUTING.md](../CONTRIBUTING.md) - Development workflow and troubleshooting
- [VERSIONING.md](../VERSIONING.md) - Complete versioning guide
- [CONTRACT_DRIVEN_DEVELOPMENT.md](../CONTRACT_DRIVEN_DEVELOPMENT.md) - Contract system documentation
