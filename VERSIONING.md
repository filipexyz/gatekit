# GateKit Versioning Strategy

## Coordinated Versioning System

All GateKit packages (backend, SDK, CLI, n8n) use **synchronized versions** from the backend `package.json`.

**Current Architecture:**

- 📦 Backend version → Single source of truth
- 🔄 All generators import backend `package.json` version
- ✅ CLI automatically references matching SDK version (`^x.y.z`)
- 🎯 Version represents GateKit API contract version

## Version Bump Process

### 1. Bump Backend Version

Use npm's built-in version commands:

```bash
# Patch release (bug fixes): 1.2.1 → 1.2.2
npm run version:patch

# Minor release (new features): 1.2.1 → 1.3.0
npm run version:minor

# Major release (breaking changes): 1.2.1 → 2.0.0
npm run version:major
```

**What happens:**

- ✅ Backend `package.json` version updated
- ✅ All packages regenerated with new version
- ✅ Git commit created automatically
- ✅ Ready to push and publish

### 2. Verify Coordinated Versions

Check all packages have the same version:

```bash
npm run version:check
```

**Expected Output:**

```
Backend: 1.2.2
SDK: 1.2.2
CLI: 1.2.2
n8n: 1.2.2
```

### 3. Commit and Push

```bash
# The version:* scripts already create a commit
git push origin main --tags
```

### 4. Publish Packages

#### **Option A: Manual Publish**

```bash
# Publish SDK
cd generated/sdk
npm publish

# Publish CLI
cd ../cli
npm publish

# Publish n8n
cd ../n8n
npm publish
```

#### **Option B: Automated Multi-Repo Publish**

1. Go to GitHub Actions
2. Run **Multi-Repo Package Publishing** workflow
3. Select which packages to publish (SDK, CLI, n8n)
4. Workflow automatically:
   - Creates PRs in each package repository
   - Uses Claude Code to generate changelogs
   - Publishes to npm after PR merge

## Semantic Versioning Rules

### Patch (1.2.1 → 1.2.2)

**When to use:**

- Bug fixes
- Performance improvements
- Documentation updates
- No API changes

**Examples:**

```bash
# Fixed Discord message delivery bug
npm run version:patch
```

### Minor (1.2.1 → 1.3.0)

**When to use:**

- New features (backward compatible)
- New platform support
- New API endpoints
- Enhanced functionality

**Examples:**

```bash
# Added WhatsApp platform support
npm run version:minor
```

### Major (1.2.1 → 2.0.0)

**When to use:**

- Breaking API changes
- Removed endpoints
- Changed request/response formats
- Architecture changes

**Examples:**

```bash
# Redesigned message queue system
npm run version:major
```

## Version Workflow Best Practices

### Development Workflow

```bash
# 1. Create feature branch
git checkout -b feat/new-platform

# 2. Implement feature
git commit -m "feat: add Slack platform support"

# 3. Merge to main
git checkout main
git merge feat/new-platform

# 4. Bump version (minor for new feature)
npm run version:minor

# 5. Push with tags
git push origin main --tags

# 6. Trigger publish workflow
```

### Pre-Release Versions

For beta/alpha releases:

```bash
# Create pre-release version
npm version 1.3.0-beta.1 --no-git-tag-version
npm run generate:all

# Commit manually
git add .
git commit -m "chore: prepare v1.3.0-beta.1"
git tag v1.3.0-beta.1
git push origin main --tags
```

### Hotfix Workflow

```bash
# 1. Create hotfix branch from tag
git checkout -b hotfix/critical-bug v1.2.1

# 2. Fix bug
git commit -m "fix: resolve critical message delivery bug"

# 3. Bump patch version
npm run version:patch

# 4. Push and publish
git push origin hotfix/critical-bug --tags
```

## Version Verification

### Check Current Versions

```bash
# Backend version
node -p "require('./package.json').version"

# All generated versions
npm run version:check
```

### Verify Version Sync

```bash
# Ensure all packages match backend
npm run generate:all
npm run version:check
```

## Troubleshooting

### Version Mismatch Detected

**Problem:** Generated packages have different versions than backend.

**Solution:**

```bash
# Regenerate all packages
npm run generate:all

# Verify versions match
npm run version:check
```

### Accidental Version Bump

**Problem:** Bumped version by mistake.

**Solution:**

```bash
# Undo last commit (version bump)
git reset --hard HEAD~1

# Restore correct version
npm version 1.2.1 --no-git-tag-version
npm run generate:all
```

### Need to Skip Generation

**Problem:** Want to bump version without regenerating packages.

**Solution:**

```bash
# Manual version bump
npm version patch --no-git-tag-version

# Regenerate later
npm run generate:all
```

## Release Checklist

- [ ] All tests passing (`npm test`)
- [ ] All contracts validated (`npm run validate:contracts:types`)
- [ ] Version bumped appropriately (patch/minor/major)
- [ ] All packages regenerated (`npm run generate:all`)
- [ ] Versions verified (`npm run version:check`)
- [ ] CHANGELOG updated (if maintained manually)
- [ ] Committed and pushed with tags
- [ ] Multi-repo publish workflow triggered
- [ ] Package PRs reviewed and merged
- [ ] Published to npm
- [ ] GitHub releases created

## Version History

| Version | Date       | Type  | Description                           |
| ------- | ---------- | ----- | ------------------------------------- |
| 1.2.1   | 2024-10-02 | Minor | Coordinated versioning implementation |
| 1.2.0   | 2024-09-XX | Minor | Template-based generator system       |
| 1.1.0   | 2024-09-XX | Minor | n8n node generator added              |
| 1.0.0   | 2024-08-XX | Major | Initial contract-driven architecture  |

## Links

- [CLAUDE.md](./CLAUDE.md) - Complete technical architecture and contract system
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Development workflow and release process
- [SEMANTIC_PLAYBOOK.md](./SEMANTIC_PLAYBOOK.md) - Development conventions
- [.github/workflows/multi-repo-publish.yml](./.github/workflows/multi-repo-publish.yml) - Automated publish workflow
