# 📁 LocalDrop

LocalDrop is a purely client-side, serverless-capable, peer-to-peer (P2P) file sharing tool. It establishes secure direct connections between devices in the same network or over the internet using WebRTC.

## 🚀 Key Features

* **Sleek Glassmorphic Radar UI**: A modern, interactive interface styled with custom CSS variables, offering dark/light modes and dynamic device node positioning.
* **4-to-6 Digit Room Pairing**: Instantly connect devices using a lightweight numeric PIN or low-density QR code. No complex WebRTC SDP/ICE string copying required.
* **Optimized 64KB Chunking**: Files are sliced incrementally in blocks of `65,536` bytes to ensure reliable packets and lightning-fast transfer speeds.
* **Backpressure Flow Control**: Actively monitors the WebRTC data channel's `bufferedAmount`. If the buffer exceeds 1MB (`1,048,576` bytes), it pauses transmission and resumes dynamically when `onbufferedamountlow` triggers (configured at `256KB`), avoiding SCTP channel drops.
* **Multi-File Queue Transfers**: Support selecting/dropping multiple files simultaneously. Files are transferred sequentially via a structured handshake (`file-start` descriptor and client-side acknowledgments).
* **RAM-Safe Stitching & Downloads**: Chunks are assembled sequentially in memory, triggered as a client-side download immediately on completion, and the generated object URL is instantly revoked to free system memory.
* **Persistent User Identity**: Identities (such as `asif-11digits`) are cached inside `localStorage` on first load and remain locked. Users can inline-edit the numeric portion directly on the radar screen.

---

## 🛠️ Technology Stack

* **Core**: React 18, Vite 8
* **Styling**: Vanilla CSS (custom design tokens and glassmorphism)
* **WebRTC Handshake**: Custom signaling over WebSockets (`vite-signaling-plugin.js`)
* **QR Codes**: `qrcode` (for generating low-density QR codes) and `html5-qrcode` (for camera scanning)

---

## 🏗️ Architecture & Signaling Flow

LocalDrop uses a server-mediated room architecture to coordinate the WebRTC handshake:

1. **Room Pin Connection**:
   Both devices join the same room on the signaling channel (e.g. `room-5731`) by navigating to or typing a 4-to-6 digit PIN.
2. **WebSocket Signaling Fallback**:
   The signaling URL is computed dynamically from the window location:
   ```javascript
   const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
   const host = window.location.host;
   const wsUrl = `${protocol}//${host}/signaling?room=room-${enteredPin}&peerId=${myId}`;
   ```
3. **Automated Handshake**:
   - The websocket signaling plugin groups connections by `room`.
   - When a peer joins, they exchange SDP Offers, Answers, and stream gathered ICE candidates incrementally.
   - Once the WebRTC `RTCDataChannel` is opened (`onopen`), the signaling socket can be safely disconnected—all file transfers happen directly P2P.

---

## 🏃 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Development Server
```bash
# Standard local start
npm run dev

# Host on local network (useful for multi-device testing over Wi-Fi)
npm run host
```

During development, the embedded Vite signaling plugin will automatically launch the room signaling socket at `/signaling`.

### 3. Build for Production
To bundle the static files for deployment on hosting platforms like Cloudflare Pages, Netlify, or Vercel:
```bash
npm run build
```

---

## 🔒 Code Standards & Quality
This codebase has been rigorously configured and validated:
* **Linter**: Zero warnings/errors under `eslint .`
* **Footer Reference**: Maintained the exact documentation footer reference: `Latest: asifulmamun.info.bd/cv (Docs)`.
