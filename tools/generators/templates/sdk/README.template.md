# @gatekit/sdk

TypeScript SDK for GateKit - Universal messaging gateway API.

> **Auto-generated from backend contracts** - Do not edit manually

## Installation

```bash
npm install @gatekit/sdk
```

## Quick Start

```typescript
import { GateKit } from '@gatekit/sdk';

const gk = new GateKit({
  apiUrl: 'https://api.gatekit.dev',
  apiKey: 'gk_live_your_api_key_here',
});

// Send a message
const result = await gk.messages.send({
  targets: [{ platformId: 'platform-id', type: 'user', id: '123' }],
  content: { text: 'Hello from GateKit!' },
});
```

## Features

- ✅ **Full type safety** - TypeScript types auto-generated from backend
- ✅ **Perfect sync** - Always matches backend API contracts
- ✅ **Zero duplication** - Single source of truth from contracts
- ✅ **Error handling** - Built-in error types and authentication handling
- ✅ **Rate limiting** - Automatic rate limit detection

## API Reference

{{CATEGORY_EXAMPLES}}

## Authentication

### API Key (Recommended)

```typescript
const gk = new GateKit({
  apiUrl: 'https://api.gatekit.dev',
  apiKey: 'gk_live_your_api_key_here',
  defaultProject: 'my-project', // optional
});
```

### JWT Token

```typescript
const gk = new GateKit({
  apiUrl: 'https://api.gatekit.dev',
  jwtToken: 'your-jwt-token',
});
```

## Error Handling

```typescript
import { GateKitError, AuthenticationError, RateLimitError } from '@gatekit/sdk';

try {
  await gk.messages.send({ ... });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid credentials');
  } else if (error instanceof RateLimitError) {
    console.error('Rate limit exceeded');
  } else if (error instanceof GateKitError) {
    console.error(`API error: ${error.message}`);
  }
}
```

## Links

- [Documentation](https://docs.gatekit.dev)
- [GitHub](https://github.com/filipexyz/gatekit-sdk)
- [npm](https://www.npmjs.com/package/@gatekit/sdk)
- [Discord Community](https://discord.gg/bQPsvycW)

## License

MIT
