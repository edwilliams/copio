# Copio Relay — Self-Hostable Signaling & TURN Kit (CPO-092)

> Production-ready, zero-cloud self-hostable WebRTC signaling and STUN/TURN server kit for Copio's Phone-to-Desktop Scan Handoff (`<copio-handoff>`).

---

## Why Copio Relay?

Phone-to-desktop handoff establishes a peer-to-peer WebRTC connection between a mobile phone camera and a desktop browser session. While ~75–85% of connections succeed directly via STUN:
- **Mobile Cellular Networks (4G/5G)** frequently enforce **Symmetric NAT**, preventing direct peer connections.
- **Strict Enterprise Firewalls** and VPNs block direct UDP peer connections.

Copio Relay provides the missing link: a 1-command Docker kit combining an ultra-lightweight Node.js PeerJS signaling server with a hardened [Coturn](https://github.com/coturn/coturn) STUN/TURN media relay.

### Privacy Invariant (E2EE)
Even when WebRTC data channels traverse a TURN relay, **the relay operator cannot view document scans or metadata**. All payloads are encrypted end-to-end with ephemeral AES-GCM-256 keys negotiated optically via the QR code ECDH public key agreement (ADR 0002).

```
 ┌──────────────────────┐                     ┌──────────────────────┐
 │ Mobile Phone Camera  │                     │ Desktop Web Browser  │
 │  (<copio-scanner>)   │                     │   (<copio-handoff>)  │
 └──────────┬───────────┘                     └───────────┬──────────┘
            │                                             │
            │           1. Optical QR Handshake           │
            │  (ECDH Public Key in QR URL - zero server)  │
            ├─────────────────────────────────────────────┤
            │                                             │
            │          2. Signaling (HTTP/WS)             │
            ├───────────────┐             ┌───────────────┤
            │               │             │               │
            │         ┌─────▼─────────────▼─────┐         │
            │         │   Copio Relay Signaling │         │
            │         │      (Node.js :9000)    │         │
            │         └─────────────────────────┘         │
            │                                             │
            │     3. E2EE Document Stream (WebRTC)        │
            │           (Direct P2P or TURN)              │
            ├─────────────────────────────────────────────┤
            │         ┌─────────────────────────┐         │
            └────────►│   Coturn STUN/TURN      │◄────────┘
                      │  (Port 3478 / UDP Relay)│
                      └─────────────────────────┘
```

---

## 5-Minute Quickstart

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/)
- A publicly accessible domain or IP (for TURN traversal across cellular networks)

### 1. Configure Environment
Copy and adjust the default settings:

```bash
# In relay/ directory:
cp .env.example .env 2>/dev/null || true
```

Set your public domain or public IP in your environment or `.env`:
```bash
export COTURN_HOST=relay.yourdomain.com
export COTURN_SECRET=generate_a_secure_random_secret_here
export PORT=9000
```

### 2. Start Services
```bash
docker compose up -d
```

Verify status:
```bash
curl http://localhost:9000/health
# {"status":"ok","service":"copio-relay","version":"0.1.0","uptime":4.2,"connectedPeers":0}

curl http://localhost:9000/ice
# [{"urls":"stun:stun.l.google.com:19302"},{"urls":"stun:relay.yourdomain.com:3478"},...]
```

---

## Client SDK Integration

### 1. HTML Declarative Configuration (`<copio-handoff>`)

Point `<copio-handoff>` to your self-hosted relay URL:

```html
<copio-handoff
  relay-url="https://relay.yourdomain.com"
  theme="dark"
  mode="batch">
</copio-handoff>
```

When `<copio-handoff>` generates the optical QR code, the `relay-url` is automatically encoded into the ephemeral session token. When the mobile user scans the QR code, their mobile browser automatically pairs through your self-hosted relay without any manual configuration!

### 2. JavaScript Programmatic Configuration (`CopioEngine`)

```javascript
import { CopioEngine, CopioHandoff } from '@copio/sdk';

const engine = new CopioEngine({
  relayUrl: 'https://relay.yourdomain.com',
});

const handoff = new CopioHandoff();
handoff.relayUrl = 'https://relay.yourdomain.com';
document.body.appendChild(handoff);
```

### 3. Advanced Custom ICE Servers Override

To bypass automatic credential fetching and supply explicit STUN/TURN servers:

```html
<copio-handoff
  ice-servers='[{"urls":"turn:relay.yourdomain.com:3478","username":"copio","credential":"secret_password"}]'
  signaling-url="wss://relay.yourdomain.com">
</copio-handoff>
```

---

## Verifying Relay & Diagnostics (`copio:connection-info`)

Developers can verify that NAT traversal and TURN fallback function correctly in their target network without any telemetry:

### 1. Forced Relay Testing
Simulate symmetric NAT by forcing all WebRTC traffic through TURN:

```html
<copio-handoff
  relay-url="https://relay.yourdomain.com"
  ice-transport-policy="relay">
</copio-handoff>
```

### 2. Telemetry-Free Connection Diagnostics Event
Listen to `copio:connection-info`:

```javascript
const handoff = document.querySelector('copio-handoff');

handoff.addEventListener('copio:connection-info', (event) => {
  const { transport, rttMs } = event.detail;
  console.log(`WebRTC connected via ${transport.toUpperCase()} (RTT: ${rttMs}ms)`);
  // transport is 'direct' (local/STUN) or 'turn' (relay)
});
```

You can also read `handoff.connectionInfo` or call `await handoff.getConnectionInfo()` at any time.

---

## Production Deployment & Firewall Configuration

### Required Firewall Ports
Ensure your cloud or enterprise firewall allows:

| Port | Protocol | Purpose |
|------|----------|---------|
| `9000` | TCP | Copio Signaling & `/ice` HTTP/WebSocket (typically fronted by Nginx/Caddy TLS) |
| `3478` | UDP/TCP | Coturn STUN & TURN signaling |
| `5349` | UDP/TCP | Coturn TLS TURN (optional) |
| `49152–65535` | UDP | Coturn WebRTC media relay dynamic port range |

### HTTPS & Reverse Proxy (Nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name relay.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/relay.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/relay.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:9000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```
