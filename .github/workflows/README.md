# GitHub Actions for Contract-Driven Architecture

This directory contains automated workflows for the revolutionary contract-driven SDK and CLI generation system.

## Workflows

### 1. `publish-packages.yml` - Production Deployment
**Manual trigger workflow** for publishing packages to npm.

**Features:**
- ✅ **Selective publishing** - Choose SDK, CLI, or both
- ✅ **Version management** - Automatic version bumping (patch/minor/major)
- ✅ **Dependency sync** - CLI automatically uses latest SDK version
- ✅ **GitHub releases** - Creates tagged releases with changelog
- ✅ **Complete validation** - Full generation and compilation before publish

**Usage:**
1. Go to **Actions** tab in GitHub
2. Select **"Publish GateKit SDK and CLI"**
3. Click **"Run workflow"**
4. Choose options:
   - Publish SDK: ✅/❌
   - Publish CLI: ✅/❌
   - Version bump: patch/minor/major

### 2. `validate-generation.yml` - Quality Assurance
**Automatic trigger** on every push/PR affecting contract system.

**Validation Steps:**
- ✅ **Contract extraction** - Validates @SdkContract decorators
- ✅ **Package generation** - Tests SDK and CLI generation
- ✅ **Compilation verification** - Ensures generated packages compile
- ✅ **Source protection** - Verifies no backend code leaked
- ✅ **End-to-end testing** - Tests real API functionality
- ✅ **Artifact storage** - Saves generated packages for review

## Security & Source Protection

### 🛡️ **NPM Token Security**
Add `NPM_TOKEN` secret to repository settings:
1. **Generate npm token**: `npm token create --access=publish`
2. **Add to GitHub**: Settings → Secrets → Actions → `NPM_TOKEN`

### 🔒 **Source Protection Validation**
The workflows automatically verify:
- ❌ **No backend controllers** in published packages
- ❌ **No NestJS imports** in compiled code
- ❌ **No Prisma references** in generated files
- ❌ **No database schemas** in published packages

## Architecture Benefits

### 🚀 **Automated Excellence**
- **Perfect sync** - Backend changes automatically trigger package updates
- **Quality gates** - No broken packages ever reach npm
- **Version management** - Consistent versioning across SDK and CLI
- **Release automation** - Tagged releases with complete changelogs

### 📦 **Published Package Quality**
```bash
# What gets published to npm:
@gatekit/sdk/
├── dist/index.js        # Clean compiled JavaScript
├── dist/index.d.ts      # Perfect TypeScript definitions
├── dist/client.js       # Beautiful gk.projects.create() API
├── dist/types.js        # All 22 auto-extracted types
└── package.json         # Professional package metadata

@gatekit/cli/
├── dist/index.js        # Executable CLI entry point
├── dist/commands/       # All 14 generated commands
├── dist/lib/utils.js    # Config and error handling
└── package.json         # CLI binary configuration
```

### 🎯 **Revolutionary Features**
- **Contract-driven** - Single source of truth generates everything
- **Type-safe** - Zero `any` types throughout
- **Permission-aware** - CLI adapts to user capabilities
- **Source-protected** - Backend code never exposed
- **Enterprise-ready** - Complete CI/CD with quality gates

## Usage Examples

### Publishing Both Packages
```bash
# Triggers both SDK and CLI publish with minor version bump
# Creates GitHub release with changelog
# Updates CLI to use latest SDK version
```

### Publishing SDK Only
```bash
# Updates SDK with patch version
# Useful for SDK-only improvements
# CLI remains on previous SDK version
```

### Development Workflow
1. **Add @SdkContract decorators** to new endpoints
2. **Push to main branch** - validation runs automatically
3. **Review generated packages** in workflow artifacts
4. **Manually trigger publish** when ready for release

This revolutionary architecture ensures that GateKit maintains the most advanced API tooling in the messaging space with zero maintenance overhead!