# WhatsApp-Evo Provider Documentation

## Overview

The WhatsApp-Evo provider integrates GateKit with WhatsApp through the Evolution API, enabling robust WhatsApp messaging capabilities via the Baileys library.

## Features

### ✅ **Core Capabilities**

- **QR Code Authentication** - Secure WhatsApp connection setup
- **Real-time Messaging** - Bi-directional message processing
- **Webhook Integration** - Evolution API webhook handling
- **Multi-format Support** - Handles various Evolution API payload structures
- **Auto-Connection Management** - Dynamic connection creation and cleanup
- **Message Persistence** - Complete message storage with raw data

### ✅ **Enterprise Features**

- **Project Isolation** - Each project gets dedicated Evolution API webhook
- **UUID Security** - Webhook endpoints secured with UUID tokens
- **Error Recovery** - Graceful handling of Evolution API failures
- **Edge Case Handling** - Comprehensive error scenarios covered
- **Test Coverage** - 57 tests with 100% pass rate

## Architecture

### **Provider Structure**

```typescript
@PlatformProviderDecorator('whatsapp-evo')
export class WhatsAppProvider implements PlatformProvider, PlatformAdapter {
  readonly name = 'whatsapp-evo';
  readonly connectionType = 'webhook';
  readonly channel = 'whatsapp-evo';
}
```

### **Connection Management**

- **Connection Key**: `${projectId}:${platformId}` for isolation
- **Instance Strategy**: Uses existing "gatekit" Evolution API instance
- **Webhook Setup**: Automatic registration with Evolution API
- **State Tracking**: Connection state and QR code management

### **Message Flow**

```
WhatsApp → Evolution API → Webhook → GateKit → Database → Event Bus
```

## Manual WhatsApp Connection Setup

### **Option 1: Evolution Manager (Recommended for Testing)**

Since our QR code API flow is still being refined, you can manually set up WhatsApp connections using Evolution Manager:

#### **Step 1: Access Evolution Manager**

1. Open Evolution Manager in your browser: `http://your-evolution-api-domain/manager`
2. Login with your Evolution API credentials

#### **Step 2: Create/Manage Instance**

1. **Find existing instance** named "gatekit" (if available)
2. **OR create new instance**:
   - Instance Name: `gatekit` (or custom name)
   - Integration: `WHATSAPP-BAILEYS`
   - Enable webhook with your GateKit URL

#### **Step 3: QR Code Authentication**

1. In Evolution Manager, navigate to your instance
2. Click "Connect" or "Generate QR Code"
3. **Scan QR code with your WhatsApp mobile app**:
   - Open WhatsApp → Settings → Linked Devices
   - Tap "Link a Device"
   - Scan the QR code displayed in Evolution Manager
4. Wait for connection status to show "Connected" or "Open"

#### **Step 4: Configure Webhook**

In Evolution Manager, set webhook URL to:

```
https://your-ngrok-url.ngrok-free.app/api/v1/webhooks/whatsapp-evo/YOUR-WEBHOOK-TOKEN
```

**Get your webhook token from GateKit platform configuration:**

```bash
curl -X GET "/api/v1/projects/your-project/platforms" \
  -H "X-API-Key: your-api-key" | jq '.[] | select(.platform == "whatsapp-evo") | .webhookUrl'
```

#### **Step 5: Test Connection**

1. Send a test message to your WhatsApp number
2. Check GateKit received messages:

```bash
curl -X GET "/api/v1/projects/your-project/messages?platform=whatsapp-evo" \
  -H "X-API-Key: your-api-key"
```

### **Option 2: GateKit QR Code API (Under Development)**

Our automated QR code flow is available but may need manual Evolution Manager setup first:

```bash
# Get QR code (may return pending if instance not initialized)
curl -X GET "/api/v1/projects/project/platforms/{platform-id}/qr-code" \
  -H "X-API-Key: your-api-key"

# Response when ready:
{
  "message": "QR code retrieved successfully",
  "qrCode": "data:image/png;base64,iVBORw0KGgo...",
  "status": "ready"
}

# Response when pending:
{
  "message": "QR code not available yet. Please wait for the connection to initialize.",
  "qrCode": null,
  "status": "pending"
}
```

## Configuration

### **Required Credentials**

```json
{
  "evolutionApiUrl": "https://evo.example.com",
  "evolutionApiKey": "your-evolution-api-key"
}
```

### **Optional Fields**

- `instanceName` - Custom Evolution API instance name
- `webhookEvents` - Specific events to subscribe to
- `qrCodeTimeout` - QR code expiration timeout (30-300 seconds)

### **Example Setup**

```bash
# Create WhatsApp-Evo platform
curl -X POST "/api/v1/projects/my-project/platforms" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-gatekit-api-key" \
  -d '{
    "platform": "whatsapp-evo",
    "credentials": {
      "evolutionApiUrl": "https://evo.example.com",
      "evolutionApiKey": "your-evolution-api-key"
    },
    "isActive": true
  }'

# Get QR code for authentication
curl -X GET "/api/v1/projects/my-project/platforms/{platform-id}/qr-code" \
  -H "X-API-Key: your-gatekit-api-key"

# Send message
curl -X POST "/api/v1/projects/my-project/messages/send" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-gatekit-api-key" \
  -d '{
    "targets": [{
      "platformId": "platform-id",
      "type": "user",
      "id": "5511999999999@s.whatsapp.net"
    }],
    "content": {
      "text": "Hello from GateKit!"
    }
  }'
```

## Implementation Details

### **Evolution API Integration**

- **Webhook Endpoint**: `/webhook/set/{instanceName}` for configuration
- **Message Endpoint**: `/message/sendText/{instanceName}` for sending
- **Payload Format**: Handles both nested and flat message structures
- **Authentication**: Uses `apikey` header for Evolution API requests

### **Message Processing**

```typescript
// Supports multiple Evolution API payload formats:
1. body.data.messages[]     // Standard format
2. body.messages[]          // Alternative format
3. body.data (single)       // Single message in data
4. body (direct)           // Direct message format
5. body.remoteJid + sender  // Flat format
```

### **Error Handling**

- **Network Failures**: Graceful degradation with retry mechanisms
- **Invalid Payloads**: Safe parsing with fallback values
- **Connection Issues**: Auto-reconnection and state management
- **Database Errors**: Duplicate handling and error recovery

## Testing

### **Test Suites**

- **Provider Tests** (28 tests): Connection management, webhook processing, message flow
- **Validator Tests** (29 tests): Credential validation, edge cases, security

### **Edge Cases Covered**

- Evolution API connectivity issues
- Malformed webhook payloads
- Database constraint violations
- Concurrent connection operations
- Resource limit scenarios
- QR code flow variations

### **Running Tests**

```bash
# Run all WhatsApp-Evo tests
npm test -- --testPathPatterns="whatsapp.*spec.ts"

# Run specific test suites
npm test -- --testNamePattern="WhatsAppProvider"
npm test -- --testNamePattern="WhatsAppCredentialsValidator"
```

## Troubleshooting

### **QR Code Flow Issues**

1. **"QR code not available yet" Error**

   ```bash
   # Check if Evolution API instance exists
   curl -X GET "https://your-evolution-api-domain/instance/fetchInstances" \
     -H "apikey: your-evolution-api-key"

   # If no "gatekit" instance, create manually in Evolution Manager
   # If instance exists, check connection state
   ```

2. **QR Code Scan Fails**
   - Ensure your phone has internet connection
   - Try refreshing QR code in Evolution Manager
   - Verify QR code hasn't expired (typically 30-60 seconds)
   - Clear WhatsApp cache if persistent issues

3. **Evolution Manager Access Issues**
   - Verify Evolution API URL is accessible: `http://your-evolution-api-domain/manager`
   - Check API key permissions for instance management
   - Ensure Evolution API server is running

### **Webhook Integration Issues**

1. **Webhook Not Receiving Messages**
   - **Check webhook URL accessibility**:
     ```bash
     # Test if Evolution API can reach your webhook
     curl -X POST "your-webhook-url" \
       -H "Content-Type: application/json" \
       -d '{"test": "connectivity"}'
     ```
   - **Verify webhook registration in Evolution Manager**:
     - Go to Instance → Settings → Webhook
     - Ensure URL matches GateKit webhook endpoint
     - Check events include: MESSAGES_UPSERT, CONNECTION_UPDATE

   - **Check GateKit webhook routes**:
     ```bash
     curl -X GET "/api/v1/platforms/webhook-routes" \
       -H "X-API-Key: your-api-key"
     ```

2. **Messages Not Stored in GateKit**
   - Check if webhook calls are reaching GateKit (check server logs)
   - Verify platform is active: `GET /api/v1/projects/:id/platforms`
   - Ensure messages aren't being filtered (fromMe: true)

3. **Evolution Manager Connection States**
   - **"close"** - Instance disconnected, need QR code scan
   - **"connecting"** - In process of connecting
   - **"open"** - Successfully connected and ready

### **Message Flow Issues**

1. **Message Send Failures**
   - **Check WhatsApp connection state**:
     ```bash
     curl -X GET "/api/v1/platforms/health" \
       -H "X-API-Key: key" | jq '.platforms[] | select(.name == "whatsapp-evo")'
     ```
   - **Verify Evolution API instance status in Manager**
   - **Validate phone number format**:
     - Correct: `5511999999999@s.whatsapp.net`
     - Incorrect: `5511999999999` (missing domain)

2. **Connection Not Established**
   - Manually check instance status in Evolution Manager
   - Re-scan QR code if connection dropped
   - Verify webhook URL is reachable from Evolution API server

### **Evolution API Server Issues**

1. **API Authentication Failures**
   - Verify API key has correct permissions
   - Check if API key supports instance management operations
   - Test basic connectivity: `GET https://your-evolution-api-domain/`

2. **Instance Management Problems**
   - Use Evolution Manager web interface for manual control
   - Check instance limits (some Evolution API servers limit instances)
   - Verify server capacity and resource availability

### **Common Issues**

1. **Webhook Not Receiving Messages**
   - Verify Evolution API can reach your webhook URL
   - Check webhook registration: `GET /api/v1/platforms/webhook-routes`
   - Ensure platform is active: `GET /api/v1/projects/:id/platforms`

2. **QR Code Not Available**
   - Use Evolution Manager for manual QR code generation
   - Check connection state via platform health endpoint
   - Verify Evolution API instance is properly configured

3. **Message Send Failures**
   - Verify WhatsApp connection state (`isConnected: true`)
   - Check Evolution API instance status in Manager
   - Validate phone number format (include @s.whatsapp.net for JID)

### **Debug Commands**

```bash
# Check platform health
curl -X GET "/api/v1/platforms/health" -H "X-API-Key: key"

# View webhook routes
curl -X GET "/api/v1/platforms/webhook-routes" -H "X-API-Key: key"

# Check message statistics
curl -X GET "/api/v1/projects/project/messages/stats" -H "X-API-Key: key"
```

## Evolution API Compatibility

### **Supported Versions**

- Evolution API v2.x
- Baileys-based WhatsApp Web integration
- Compatible with standard Evolution API deployments

### **Webhook Events**

- `QRCODE_UPDATED` - QR code for authentication
- `CONNECTION_UPDATE` - Connection state changes
- `MESSAGES_UPSERT` - Incoming messages
- `SEND_MESSAGE` - Outbound message confirmations

## Future Roadmap

### **Planned Enhancements**

- **Media Message Support** - Images, documents, audio files
- **Group Message Handling** - Group chat integration
- **Message Reactions** - Emoji reactions and interactions
- **Typing Indicators** - Real-time typing status

### **Integration Strategy**

The `whatsapp-evo` provider is designed to coexist with future WhatsApp integrations:

- `whatsapp` - Reserved for official WhatsApp Business API
- `whatsapp-evo` - Evolution API integration (current)
- `whatsapp-web` - Direct WhatsApp Web integration (future)

This allows developers to choose the most appropriate WhatsApp integration method for their needs.

## Support

For questions and support:

- **Discord Community**: https://discord.gg/bQPsvycW
- **Documentation**: Check `/docs` endpoints for API reference
- **Test Examples**: See `whatsapp.provider.spec.ts` for usage patterns
