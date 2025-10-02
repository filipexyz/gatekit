# n8n-nodes-gatekit

n8n community node for GateKit - Universal messaging gateway.

> **Auto-generated from backend contracts** - Do not edit manually

## Installation

### In n8n (Recommended)

Add to your n8n instance's `package.json`:

```json
{
  "dependencies": {
    "n8n-nodes-gatekit": "latest"
  }
}
```

### For Development

```bash
npm install n8n-nodes-gatekit
```

## Features

- ✅ **Visual automation** - Drag-and-drop workflow builder
- ✅ **Auto-generated** - Always synced with GateKit API
- ✅ **300k+ n8n users** - Massive automation community
- ✅ **All operations** - Complete API coverage in visual format
- ✅ **Type-safe** - Full TypeScript support

## Available Operations

{{OPERATIONS_LIST}}

## Configuration

### Credentials

The node requires GateKit API credentials:

1. **API URL**: Your GateKit API endpoint (e.g., `https://api.gatekit.dev`)
2. **API Key**: Your GateKit API key (starts with `gk_`)

### Setting up Credentials in n8n

1. Go to **Credentials** in n8n
2. Click **New Credential**
3. Search for "GateKit"
4. Fill in:
   - **API URL**: `https://api.gatekit.dev`
   - **API Key**: Your API key from GateKit dashboard

## Usage Examples

### Send Message Workflow

1. Add **GateKit** node
2. Select **Messages** resource
3. Select **Send** operation
4. Configure:
   - **Project ID**: Your project identifier
   - **Targets**: Platform users to message
   - **Content**: Message text and attachments

### Platform Management

1. Add **GateKit** node
2. Select **Platforms** resource
3. Choose operation (Create, List, Update, Delete)
4. Configure platform-specific credentials

## Why n8n + GateKit?

- **No-code automation** - Build workflows without programming
- **Multi-platform messaging** - Discord, Telegram, WhatsApp in one node
- **Event-driven** - Trigger messages from any n8n event
- **Scale easily** - Handle thousands of messages with queues

## Links

- [n8n Community Nodes](https://www.npmjs.com/package/n8n-nodes-gatekit)
- [GateKit Documentation](https://docs.gatekit.dev)
- [GitHub](https://github.com/filipexyz/n8n-nodes-gatekit)
- [Discord Community](https://discord.gg/bQPsvycW)

## License

MIT
