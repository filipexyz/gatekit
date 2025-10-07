# ⚠️ DEPRECATED - This repository has moved

## GateKit is now MsgCore

This repository is no longer maintained. All development has moved to the new organization and repository.

### 🔗 New Repository

**Main Repository:** [https://github.com/msgcore/msgcore](https://github.com/msgcore/msgcore)

### 📦 New Packages

- **SDK:** [@msgcore/sdk](https://www.npmjs.com/package/@msgcore/sdk) - [GitHub](https://github.com/msgcore/msgcore-sdk)
- **CLI:** [@msgcore/cli](https://www.npmjs.com/package/@msgcore/cli) - [GitHub](https://github.com/msgcore/msgcore-cli)
- **n8n:** [n8n-nodes-msgcore](https://www.npmjs.com/package/n8n-nodes-msgcore) - [GitHub](https://github.com/msgcore/n8n-nodes-msgcore)

### 🚀 What Changed

- **Organization:** `filipexyz` → `msgcore`
- **Name:** GateKit → MsgCore
- **Version:** Fresh start at v1.0.0
- **Code:** Complete rebrand with clean git history

### 📚 Migration

If you're using the old `@gatekit/*` packages, please update to `@msgcore/*`:

```bash
# Uninstall old packages
npm uninstall @gatekit/sdk @gatekit/cli

# Install new packages
npm install @msgcore/sdk @msgcore/cli
```

```typescript
// Update imports
import { MsgCore } from '@msgcore/sdk'; // was: import { GateKit } from '@gatekit/sdk'
```

### 💬 Community

Join our Discord: [https://discord.gg/bQPsvycW](https://discord.gg/bQPsvycW)

---

**Apache 2.0 Licensed**
