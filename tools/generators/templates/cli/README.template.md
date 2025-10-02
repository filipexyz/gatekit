# @gatekit/cli

Permission-aware CLI for GateKit - Universal messaging gateway.

> **Auto-generated from backend contracts** - Do not edit manually

## Installation

```bash
npm install -g @gatekit/cli
```

## Quick Start

### Option 1: Using Config File (Recommended for local development)

```bash
# Configure CLI (stores in ~/.gatekit/config.json with secure permissions)
gatekit config set apiUrl https://api.gatekit.dev
gatekit config set apiKey gk_live_your_api_key_here
gatekit config set defaultProject my-project

# Verify configuration
gatekit config list

# Use CLI
gatekit messages send --target "platform-id:user:123" --text "Hello!"
```

### Option 2: Using Environment Variables (Recommended for CI/CD)

```bash
# Set environment variables (override config file)
export GATEKIT_API_URL="https://api.gatekit.dev"
export GATEKIT_API_KEY="gk_live_your_api_key_here"
export GATEKIT_DEFAULT_PROJECT="my-project"

# Use CLI
gatekit projects list --json
```

### Configuration Priority

1. **Environment variables** (highest priority)
2. **Config file** (~/.gatekit/config.json)
3. **Defaults**

This allows you to:

- Use config file for daily work
- Override with env vars for CI/CD or testing
- Keep sensitive keys secure (file has 600 permissions)

## Features

- ✅ **Permission-aware** - Only shows commands you have access to
- ✅ **Auto-generated** - Always synced with backend API
- ✅ **Type-safe** - Built on @gatekit/sdk with full type safety
- ✅ **Interactive** - Helpful prompts and error messages
- ✅ **JSON output** - Perfect for scripting and automation

## Commands

{{COMMAND_LIST}}

## Configuration Management

### Config Commands

```bash
# Set configuration values
gatekit config set apiUrl https://api.gatekit.dev
gatekit config set apiKey gk_live_your_api_key_here
gatekit config set defaultProject my-project
gatekit config set outputFormat json

# Get a specific value
gatekit config get apiKey
# Output: apiKey = ***

# List all configuration
gatekit config list
# Output:
#   apiUrl = https://api.gatekit.dev
#   apiKey = ***
#   defaultProject = my-project
```

### Configuration File

Stored in `~/.gatekit/config.json` with **secure permissions (600)**:

```json
{
  "apiUrl": "https://api.gatekit.dev",
  "apiKey": "gk_live_your_api_key_here",
  "defaultProject": "my-project",
  "outputFormat": "table"
}
```

**Security:**

- File permissions: `600` (owner read/write only)
- Directory permissions: `700`
- API keys are never logged or displayed in full
- Safe to use on shared systems

### Environment Variables (Override Config File)

Environment variables have **highest priority**:

```bash
export GATEKIT_API_URL="https://api.gatekit.dev"
export GATEKIT_API_KEY="gk_live_your_api_key_here"
export GATEKIT_JWT_TOKEN="your-jwt-token"  # Alternative to API key
export GATEKIT_DEFAULT_PROJECT="my-project"
export GATEKIT_OUTPUT_FORMAT="json"        # or "table"
```

**Use cases:**

- CI/CD pipelines (GitHub Actions, GitLab CI)
- Docker containers
- Temporary overrides for testing
- Multiple environments

### Configuration Priority

```
┌─────────────────────────────────┐
│ 1. Environment Variables        │ ← Highest priority
├─────────────────────────────────┤
│ 2. Config File (~/.gatekit/)    │
├─────────────────────────────────┤
│ 3. Defaults                     │ ← Lowest priority
└─────────────────────────────────┘
```

## Scripting

The CLI supports `--json` flag for machine-readable output:

```bash
# Get projects as JSON
gatekit projects list --json | jq '.[] | .id'

# Send message and capture result
RESULT=$(gatekit messages send --target "id:user:123" --text "Hello" --json)
echo $RESULT | jq '.jobId'
```

## Links

- [Documentation](https://docs.gatekit.dev)
- [GitHub](https://github.com/filipexyz/gatekit-cli)
- [npm](https://www.npmjs.com/package/@gatekit/cli)
- [Discord Community](https://discord.gg/bQPsvycW)

## License

MIT
