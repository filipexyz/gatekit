# 🧠 GateKit - Conversational Infrastructure for AI Agents

> **⚡ The messaging backbone that any AI agent can plug into**
> Built by AI, for AI. Store conversations, send messages, integrate with any agentic workflow.

[![Discord Community](https://img.shields.io/badge/Discord-Join%20Community-7289da?style=flat&logo=discord)](https://discord.gg/bQPsvycW)
[![Telegram](https://img.shields.io/badge/Telegram-Ready-0088cc?style=flat&logo=telegram)](https://github.com/filipexyz/gatekit)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-Evolution%20API-25d366?style=flat&logo=whatsapp)](https://github.com/filipexyz/gatekit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![AI Generated](https://img.shields.io/badge/100%25-AI%20Generated-blueviolet?style=flat)](https://github.com/filipexyz/gatekit)

---

## 🤖 **AI-ASSISTED DEVELOPMENT**

**⚠️ This project is AI-generated code under human supervision.**

- 🧠 **AI-authored** - Code written by Claude AI with human guidance
- 👨‍💻 **Human-supervised** - Directed and validated by experienced developers
- ⚡ **Rapid development** - AI accelerates feature development significantly
- 🌊 **Fast iteration** - Quick feature additions and improvements
- 🧪 **Experimental approach** - Pushing boundaries of AI-assisted development

**High development velocity with human oversight. Use with appropriate testing.**

---

## 🎯 **What GateKit Actually Is**

**GateKit is conversational infrastructure that any AI agent can plug into.**

### **📨 What We Store:**

- **Received Messages** - Every incoming message from Discord, Telegram, WhatsApp, etc.
- **Sent Messages** - Complete delivery tracking with success/failure status
- **Platform Logs** - All messaging activity with rich debugging metadata
- **User Conversations** - Unified message history across all platforms

### **🔌 What We Provide:**

- **Universal Send API** - Send to Discord, Telegram, WhatsApp with identical code
- **Conversation History** - Query user conversations across platforms
- **Platform Management** - Configure bots, update tokens, monitor health
- **User & Project Management** - Multi-tenant with role-based access
- **Auto-Generated Clients** - SDK, CLI, and API docs from single source

### **🤖 Perfect for AI Agents:**

```typescript
// Any AI agent can easily integrate
class YourAIAgent {
  constructor() {
    this.gatekit = new GateKit({ apiKey: 'your-key' });
  }

  async handleUserMessage(userId: string, message: string, platform: string) {
    // 1. Get conversation history (what we HAVE)
    const history = await this.gatekit.messages.list('project', { userId });

    // 2. Process with your AI
    const response = await yourAI.process(history, message);

    // 3. Respond with text, attachments, embeds, and buttons (what we HAVE)
    await this.gatekit.messages.send('project', {
      targets: [{ platformId: platform, type: 'user', id: userId }],
      content: {
        text: response,
        buttons: [
          { text: 'Confirm', value: 'confirm', style: 'success' },
          {
            text: 'Learn More',
            url: 'https://docs.example.com',
            style: 'link',
          },
        ],
      },
    });
  }
}
```

## 🏗️ **Current Infrastructure (What Actually Works)**

### **✅ Core Systems Built:**

- **User-Linked Projects** - Multi-tenant with `owner`/`admin`/`member`/`viewer` roles
- **Platform Providers** - Discord (WebSocket), Telegram (Webhook), WhatsApp (Evolution API) production-ready
- **Message Queue** - BullMQ with Redis for reliable cross-platform delivery
- **Attachment Support** - URL and base64 media across all platforms (Discord, Telegram, WhatsApp)
- **Enhanced Logging** - Platform activity monitoring with structured metadata
- **Credential Validation** - Platform-specific format validation (bot tokens, etc.)
- **Auto-Generated Clients** - Contract-driven SDK/CLI generation

### **📡 Production APIs Available:**

```bash
# Project Management
GET    /api/v1/projects                    # List projects
POST   /api/v1/projects                    # Create project
PATCH  /api/v1/projects/:slug              # Update project

# Team Management
GET    /api/v1/projects/:slug/members      # List team members
POST   /api/v1/projects/:slug/members      # Add member
PATCH  /api/v1/projects/:slug/members/:id  # Update role

# Platform Configuration
GET    /api/v1/projects/:slug/platforms         # List configured bots
POST   /api/v1/projects/:slug/platforms         # Add bot integration
PATCH  /api/v1/projects/:slug/platforms/:id     # Update bot tokens

# Conversation History (Ready for Agents)
GET    /api/v1/projects/:slug/messages          # Query received messages
GET    /api/v1/projects/:slug/messages/sent     # Query sent messages

# Webhook Notifications (Event Subscriptions)
POST   /api/v1/projects/:slug/webhooks          # Subscribe to events
GET    /api/v1/projects/:slug/webhooks          # List webhooks
GET    /api/v1/projects/:slug/webhooks/:id/deliveries  # Delivery history

# Platform Activity Monitoring
GET    /api/v1/projects/:slug/platforms/logs         # All platform activity
GET    /api/v1/projects/:slug/platforms/logs/stats   # Activity dashboard
```

### **🎮 Platform Capabilities Matrix**

Query capabilities programmatically via: `GET /api/v1/platforms/health`

| Platform        | Connection | Send | Receive | Attachments | Embeds | Buttons | Reactions | Edit | Delete | Threads |
| --------------- | ---------- | ---- | ------- | ----------- | ------ | ------- | --------- | ---- | ------ | ------- |
| 💬 **Discord**  | WebSocket  | ✅   | ✅      | ✅          | ✅     | ✅      | ✅        | 🔜   | 🔜     | 🔜      |
| 📱 **Telegram** | Webhook    | ✅   | ✅      | ✅          | ✅     | ✅      | ✅        | 🔜   | 🔜     | 🔜      |
| 💚 **WhatsApp** | Webhook    | ✅   | ✅      | ✅          | ✅     | ❌      | ✅        | 🔜   | 🔜     | 🔜      |

**Legend:** ✅ Available | 🔜 Planned | ❌ Not Supported by Platform

**Current Capabilities:**

- **Send** - Send messages to users/channels
- **Receive** - Receive incoming messages
- **Attachments** - Send/receive media files (images, videos, documents)
- **Embeds** - Rich embedded content with graceful cross-platform degradation
- **Buttons** - Interactive buttons with webhook callbacks (Discord & Telegram)
- **Reactions** - Send and receive emoji reactions with webhook events (All platforms)

**Embed Features:**

- **Discord** - Full native embed support (author, title, description, fields, footer, images, timestamp)
- **Telegram** - Graceful degradation to HTML-formatted text with inline fields
- **WhatsApp** - Graceful degradation to Markdown-formatted text with inline fields
- **Platform Limits** - Discord: 10 embeds/message, 25 fields/embed; Telegram/WhatsApp: first image only

**Button Features:**

- **Discord** - Interactive buttons with 5 styles (primary, secondary, success, danger, link)
- **Telegram** - Inline keyboard buttons with callback data or URLs
- **Webhook Events** - Dedicated `button.clicked` event delivered to subscribed webhooks
- **Platform Limits** - Discord: 25 buttons max (5×5 grid); Telegram: ~100 buttons (2 per row recommended)

**Reaction Features:**

- **Discord** - Send/receive Unicode and custom emojis in DMs, channels, and threads
- **Telegram** - Send in DMs and groups; receive only in groups/channels where bot is admin (Telegram API limitation)
- **WhatsApp** - Send/receive Unicode emojis in DMs and groups
- **Webhook Events** - `reaction.added` and `reaction.removed` events delivered to subscribed webhooks
- **Security** - SSRF protection on all button URLs (HTTPS only)

**Planned Capabilities:**

- **Edit** - Edit previously sent messages
- **Delete** - Delete sent messages
- **Reactions** - Message reactions/emojis
- **Threads** - Threaded conversations

### **💚 WhatsApp Integration (Evolution API)**

GateKit integrates with WhatsApp through the [Evolution API](https://evolution-api.com/), providing robust WhatsApp messaging capabilities.

**Features:**

- ✅ Text & media messages (images, videos, audio, documents)
- ✅ URL and base64 attachments support
- ✅ Auto-webhook configuration
- ✅ Message persistence with full metadata
- ✅ Evolution Manager integration for connection management

📚 **[Complete WhatsApp Guide](WHATSAPP_EVO.md)** - Detailed setup, troubleshooting, and API reference

> **Note:** All platforms (Discord, Telegram, WhatsApp) support media attachments via URL or base64 data when sending messages.

## 🔮 **Future: Native Agentic Layer**

### **🎯 Planned Agent Integration:**

- **Memory System** - Native agent memory with MCP protocol support
- **Event Querying** - Internal event system with queryable metrics APIs
- **Subconscious Conversations** - Background conversation processing
- **Agent Orchestration** - Multi-agent coordination across platforms

### **🧬 Why This Architecture Works:**

1. **Message Storage** - We already store all received/sent messages
2. **Platform Abstraction** - Universal interface works with any platform
3. **User Tracking** - We track users across platforms
4. **Activity Logs** - Rich metadata for agent decision-making
5. **Queue System** - Reliable message delivery infrastructure

## 🛠️ **Get Started (Agent Developers)**

### **1. Basic Setup**

```bash
git clone https://github.com/filipexyz/gatekit.git
cd gatekit && docker compose up -d postgres redis
npm install && npm run start:dev
```

### **2. Install AI-Generated CLI**

```bash
npm install -g @gatekit/cli
export GATEKIT_API_KEY=your-generated-key

# Set up your agent's project
gatekit projects create --name "MyAIAgent"
gatekit platforms create --platform telegram --credentials '{"token":"BOT_TOKEN"}'
```

### **3. Integrate with Your Agent**

```typescript
import { GateKit } from '@gatekit/sdk';

const gk = new GateKit({
  apiUrl: 'http://localhost:3000',
  apiKey: process.env.GATEKIT_API_KEY,
});

// Your agent now has conversational infrastructure
const messages = await gk.messages.list('project', { limit: 100 });
const platforms = await gk.platforms.list('project');
const logs = await gk.platformLogs.list('project', { category: 'message' });
```

## 📊 **Production Stats**

- **✅ 544 tests passing** - Full coverage including webhooks
- **✅ 35 API endpoints** - Auto-generated SDK/CLI/n8n
- **✅ 3 platform providers** - Discord, Telegram, WhatsApp-Evo
- **✅ Webhook notifications** - Event subscriptions with HMAC signatures
- **✅ Message storage** - Complete conversation history
- **✅ Activity monitoring** - Rich platform logs

## ⚠️ **AI Development Disclaimers**

### **🧪 Experimental Technology**

- **High-velocity development** - APIs evolve rapidly
- **AI-driven architecture** - Unconventional patterns
- **Continuous improvement** - Features ship frequently
- **Bleeding edge** - Some concepts are experimental

### **🎯 Production Guidelines**

- **Pin exact versions** - Avoid breaking changes
- **Test thoroughly** - Validate in staging environments
- **Monitor platform logs** - Use built-in observability
- **Have backup plans** - Don't rely solely on GateKit

## 🔗 **Resources**

### **📚 Documentation**

- **[Architecture Guide](CLAUDE.md)** - Complete technical overview
- **[Contract System](CONTRACT_DRIVEN_DEVELOPMENT.md)** - Auto-generation pipeline
- **[Testing Guide](test/CLAUDE.md)** - Comprehensive testing approach

### **📦 Generated Packages**

- **[TypeScript SDK](https://github.com/filipexyz/gatekit-sdk)** - Auto-generated client
- **[CLI Tool](https://github.com/filipexyz/gatekit-cli)** - Command interface
- **[n8n Nodes](https://github.com/filipexyz/n8n-nodes-gatekit)** - Visual automation

---

## 🤖 **AI-Assisted Development for AI Agents**

_GateKit: Built with AI assistance under human supervision to provide conversational infrastructure for the next generation of AI agents._

**Perfect foundation for:**

- 🧠 **Memory-based agents** - Persistent conversation history
- 🔗 **Multi-platform bots** - Unified interface across platforms
- 📊 **Analytics agents** - Rich activity data for insights
- 🤖 **Autonomous systems** - Reliable message delivery infrastructure

---

## 💬 **Community & Support**

**Join our Discord community for:**

- 🛠️ **Developer Support** - Get help with integration and troubleshooting
- 🚀 **Feature Discussions** - Shape the future of GateKit
- 🧠 **AI Agent Builders** - Connect with other developers building AI agents
- 📢 **Updates & Announcements** - Stay informed about new features

[![Join Discord](https://img.shields.io/badge/Discord-Join%20Community-7289da?style=for-the-badge&logo=discord)](https://discord.gg/bQPsvycW)

---

**⭐ Star if you're building AI agents that need conversational infrastructure!**

[![GitHub Stars](https://img.shields.io/github/stars/filipexyz/gatekit?style=social)](https://github.com/filipexyz/gatekit)

---

**MIT Licensed - Build the agentic future freely! 🌟**
