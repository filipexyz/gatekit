# @gatekit/cli

Permission-aware CLI for GateKit - Universal messaging gateway.

> **Auto-generated from backend contracts** - Do not edit manually

## Installation

```bash
npm install -g @gatekit/cli
```

## Quick Start

```bash
# Configure CLI
gatekit config set apiUrl https://api.gatekit.dev
gatekit config set apiKey gk_live_your_api_key_here
gatekit config set defaultProject my-project

# Send a message
gatekit messages send \
  --target "platform-id:user:123" \
  --text "Hello from GateKit CLI!"

# List projects
gatekit projects list --json

# Create a platform configuration
gatekit platforms create \
  --platform discord \
  --credentials '{"token":"bot-token"}'
```

## Features

- ✅ **Permission-aware** - Only shows commands you have access to
- ✅ **Auto-generated** - Always synced with backend API
- ✅ **Type-safe** - Built on @gatekit/sdk with full type safety
- ✅ **Interactive** - Helpful prompts and error messages
- ✅ **JSON output** - Perfect for scripting and automation

## Commands

{{COMMAND_LIST}}

## Configuration

The CLI stores configuration in `~/.gatekit/config.json`:

```json
{
  "apiUrl": "https://api.gatekit.dev",
  "apiKey": "gk_live_your_api_key_here",
  "defaultProject": "my-project"
}
```

### Environment Variables

You can override configuration with environment variables:

- `GATEKIT_API_URL` - API URL
- `GATEKIT_API_KEY` - API key for authentication
- `GATEKIT_JWT_TOKEN` - JWT token (alternative to API key)
- `GATEKIT_DEFAULT_PROJECT` - Default project ID

## Authentication

### API Key (Recommended)

```bash
gatekit config set apiKey gk_live_your_api_key_here
```

### JWT Token

```bash
export GATEKIT_JWT_TOKEN="your-jwt-token"
gatekit projects list
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
