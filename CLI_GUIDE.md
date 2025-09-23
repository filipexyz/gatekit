# GateKit CLI Guide

Complete guide for using the GateKit CLI to interact with the GateKit API.

## Table of Contents

1. [Installation](#installation)
2. [Authentication Setup](#authentication-setup)
3. [Project Management](#project-management)
4. [Platform Configuration](#platform-configuration)
5. [API Key Management](#api-key-management)
6. [Message Operations](#message-operations)
7. [Quick Commands for AI Agents](#quick-commands-for-ai-agents)
8. [Configuration](#configuration)
9. [Error Handling](#error-handling)
10. [Development Testing](#development-testing)

## Installation

### From NPM (Production)
```bash
npm install -g @gatekit/cli
```

### From Source (Development)
```bash
git clone https://github.com/gatekit/cli.git
cd cli
npm install
npm run build
npm link
```

## Authentication Setup

The CLI supports two authentication methods:

### 1. API Key Authentication (Recommended for AI Agents)

**Interactive Setup:**
```bash
gatekit auth login
# Select "API Key" and enter your key
```

**Direct Setup:**
```bash
gatekit auth login --api-key gk_live_your_api_key_here
```

**Environment Variable:**
```bash
export GATEKIT_API_KEY="gk_live_your_api_key_here"
export GATEKIT_BASE_URL="https://api.gatekit.dev"  # Optional: defaults to production
```

### 2. JWT Token Authentication

```bash
gatekit auth login --jwt-token your_jwt_token_here
```

### Authentication Status

```bash
# Check current authentication status
gatekit auth status

# Show configuration
gatekit config

# Remove saved credentials
gatekit auth logout
```

## Project Management

### List Projects

```bash
# Table format
gatekit projects list

# JSON format (for AI agents)
gatekit projects list --json
```

### Create Project

```bash
# Interactive creation
gatekit projects create

# Direct creation
gatekit projects create \
  --name "My Bot Project" \
  --slug "my-bot-project" \
  --environment development \
  --default
```

### Project Details

```bash
# Show project information
gatekit projects show my-project

# JSON format
gatekit projects show my-project --json
```

### Update Project

```bash
# Update project properties
gatekit projects update my-project --name "Updated Name"
gatekit projects update my-project --environment production
gatekit projects update my-project --default
```

### Delete Project

```bash
# With confirmation
gatekit projects delete my-project

# Skip confirmation
gatekit projects delete my-project --force
```

### Set Default Project

```bash
gatekit projects default my-project
```

## Platform Configuration

### List Configured Platforms

```bash
# List platforms for specific project
gatekit platforms list --project my-project

# List platforms for default project
gatekit platforms list
```

### Configure Discord

```bash
# Interactive setup
gatekit platforms discord --project my-project

# Direct setup
gatekit platforms discord \
  --project my-project \
  --token YOUR_DISCORD_BOT_TOKEN \
  --active \
  --test-mode
```

### Configure Telegram

```bash
# Interactive setup
gatekit platforms telegram --project my-project

# Direct setup
gatekit platforms telegram \
  --project my-project \
  --token YOUR_TELEGRAM_BOT_TOKEN \
  --active
```

### Platform Management

```bash
# Show platform details
gatekit platforms show PLATFORM_ID --project my-project

# Update platform settings
gatekit platforms update PLATFORM_ID --active --project my-project
gatekit platforms update PLATFORM_ID --inactive --test-mode --project my-project

# Delete platform
gatekit platforms delete PLATFORM_ID --project my-project --force

# Get webhook URL
gatekit platforms webhook PLATFORM_ID --project my-project
```

### Platform Health & Support

```bash
# Check platform health status
gatekit platforms health

# List supported platforms
gatekit platforms supported
```

## API Key Management

### List API Keys

```bash
gatekit keys list --project my-project
```

### Create API Key

```bash
# Interactive creation
gatekit keys create --project my-project

# Direct creation with specific scopes
gatekit keys create \
  --project my-project \
  --name "Production Bot Key" \
  --scopes "messages:send,messages:read,platforms:read" \
  --expires "2024-12-31"
```

### Manage API Keys

```bash
# Revoke (delete) an API key
gatekit keys revoke KEY_ID --project my-project

# Roll (regenerate) an API key
gatekit keys roll KEY_ID --project my-project

# Skip confirmation prompts
gatekit keys revoke KEY_ID --project my-project --force
```

## Message Operations

### Send Messages

**Interactive Sending:**
```bash
gatekit messages send --project my-project
# Follow the interactive prompts
```

**Direct Sending:**
```bash
gatekit messages send \
  --project my-project \
  --platform discord \
  --target-type channel \
  --target-id 123456789012345678 \
  --text "Hello from GateKit CLI!"
```

**Rich Messages with Embeds:**
```bash
gatekit messages send \
  --project my-project \
  --platform discord \
  --target-type channel \
  --target-id 123456789012345678 \
  --text "Check this out!" \
  --title "Important Update" \
  --description "New features are now available" \
  --color "#00ff00" \
  --image "https://example.com/image.png"
```

### Message Status Tracking

```bash
# Check message status
gatekit messages status JOB_ID --project my-project

# Watch for status changes (real-time)
gatekit messages status JOB_ID --project my-project --watch

# JSON format
gatekit messages status JOB_ID --project my-project --json
```

### Message Queue Management

```bash
# View queue metrics
gatekit messages queue --project my-project

# Retry failed message
gatekit messages retry JOB_ID --project my-project
```

## Quick Commands for AI Agents

### Quick Send (AI-Optimized)

```bash
# Minimal required parameters
gatekit send \
  --project my-project \
  --platform discord \
  --target 123456789012345678 \
  --text "Status update: Task completed successfully"

# With additional options
gatekit send \
  --project my-project \
  --platform discord \
  --target 123456789012345678 \
  --target-type channel \
  --text "Error detected in system" \
  --priority high \
  --tracking-id "error-001" \
  --wait
```

**Parameters:**
- `--wait`: Wait for delivery completion before returning
- `--target-type`: `channel`, `user`, or `group` (default: `channel`)
- `--priority`: `low`, `normal`, or `high` (default: `normal`)
- `--tracking-id`: Custom identifier for tracking
- `--silent`: Send without notifications

### JSON Output for Automation

All commands support `--json` flag for machine-readable output:

```bash
gatekit projects list --json
gatekit messages status JOB_ID --project my-project --json
gatekit platforms list --project my-project --json
gatekit messages queue --project my-project --json
```

## Configuration

### Configuration File Location

```bash
# Show config file path
gatekit config --path
# Output: /home/user/.gatekit/config.yaml
```

### Configuration Structure

```yaml
apiUrl: https://api.gatekit.dev
apiKey: gk_live_your_api_key_here
defaultProject: my-project
```

### Environment Variables

The CLI respects these environment variables:

```bash
GATEKIT_BASE_URL=https://api.gatekit.dev  # API endpoint
GATEKIT_API_KEY=gk_live_your_key_here     # API key
```

Environment variables take precedence over config file values.

## Error Handling

### Common Exit Codes

- `0`: Success
- `1`: Error (authentication, API, validation, etc.)

### Common Error Messages

**Authentication Errors:**
```bash
❌ Authentication failed. Please check your API key or JWT token.
```
*Solution: Verify your API key with `gatekit auth status`*

**Project Not Found:**
```bash
❌ No project specified. Use --project or set a default project.
```
*Solution: Set default project with `gatekit projects default PROJECT_SLUG`*

**Rate Limiting:**
```bash
❌ Rate limit exceeded. Please try again later.
```
*Solution: Wait and retry, or check your rate limits*

### Debug Mode

For detailed error information, check the CLI source or API response:

```bash
# Check API health
gatekit health

# Test connection
gatekit auth status
```

## Development Testing

### Local Development Setup

1. **Start GateKit Backend:**
```bash
cd /path/to/gatekit/dev/backend
npm run start:dev
```

2. **Generate Test API Key:**
```bash
node trigger-seed.js
# Copy the generated API key
```

3. **Configure CLI for Local Testing:**
```bash
# Create .env file in CLI directory
echo "GATEKIT_BASE_URL=http://localhost:3000" > .env
echo "GATEKIT_API_KEY=gk_test_your_generated_key" >> .env
```

4. **Test CLI Commands:**
```bash
# Test health
gatekit health

# Test projects
gatekit projects list

# Test platforms
gatekit platforms supported
```

### Testing Workflow

```bash
# 1. Check health
gatekit health

# 2. List projects
gatekit projects list

# 3. Set default project
gatekit projects default default

# 4. Configure a platform
gatekit platforms discord --token DISCORD_BOT_TOKEN

# 5. Send test message
gatekit send \
  --project default \
  --platform discord \
  --target YOUR_CHANNEL_ID \
  --text "CLI test message"

# 6. Check message status
gatekit messages status JOB_ID

# 7. View queue metrics
gatekit messages queue
```

## Advanced Usage

### Batch Operations

Use shell scripting for batch operations:

```bash
#!/bin/bash
# Send status update to multiple channels
CHANNELS=("123456789" "987654321" "456789123")
PROJECT="my-project"
MESSAGE="Daily status: All systems operational"

for channel in "${CHANNELS[@]}"; do
  echo "Sending to channel: $channel"
  gatekit send \
    --project "$PROJECT" \
    --platform discord \
    --target "$channel" \
    --text "$MESSAGE"
done
```

### Monitoring Scripts

```bash
#!/bin/bash
# Monitor queue metrics
while true; do
  echo "$(date): Queue status:"
  gatekit messages queue --project my-project --json | jq '.failed'
  sleep 60
done
```

### Integration with CI/CD

```yaml
# GitHub Actions example
- name: Send deployment notification
  run: |
    gatekit send \
      --project production \
      --platform discord \
      --target ${{ secrets.DISCORD_CHANNEL }} \
      --text "✅ Deployment completed successfully" \
      --priority high
  env:
    GATEKIT_API_KEY: ${{ secrets.GATEKIT_API_KEY }}
```

## Support and Troubleshooting

### Health Checks

```bash
# API health
gatekit health

# Platform health
gatekit platforms health

# Authentication status
gatekit auth status
```

### Getting Help

```bash
# General help
gatekit --help

# Command-specific help
gatekit projects --help
gatekit messages send --help
```

### Common Issues

1. **"Command not found"**
   - Ensure CLI is installed: `npm list -g @gatekit/cli`
   - Check PATH: `which gatekit`

2. **"Authentication failed"**
   - Verify API key: `gatekit auth status`
   - Check API key scopes: `gatekit keys list --project PROJECT`

3. **"No project specified"**
   - Set default project: `gatekit projects default PROJECT_SLUG`
   - Or use `--project` flag with commands

4. **"Platform not configured"**
   - Configure platform: `gatekit platforms discord/telegram`
   - Check platform status: `gatekit platforms list`

---

For additional support:
- 📖 Documentation: [docs.gatekit.dev](https://docs.gatekit.dev)
- 🐛 Issues: [GitHub Issues](https://github.com/gatekit/cli/issues)
- 💬 Community: [Discord Server](https://discord.gg/gatekit)