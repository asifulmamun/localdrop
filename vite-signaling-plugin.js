import { WebSocketServer } from 'ws';

/**
 * Vite plugin that embeds a tiny WebSocket signaling relay
 * directly into the existing dev server. No separate backend needed.
 * Only relays discovery + WebRTC offer/answer/ICE messages.
 * All file data flows purely P2P via WebRTC DataChannels.
 */
export default function signalingPlugin() {
  return {
    name: 'localdrop-signaling',
    configureServer(server) {
      const wss = new WebSocketServer({ noServer: true });
      const clients = new Map(); // id → ws

      server.httpServer.on('upgrade', (req, socket, head) => {
        if (req.url === '/signaling') {
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
          });
        }
      });

      wss.on('connection', (ws) => {
        let clientId = null;

        ws.on('message', (raw) => {
          try {
            const msg = JSON.parse(raw);

            // Client registers with its unique ID
            if (msg.type === 'register') {
              clientId = msg.id;
              clients.set(clientId, ws);
              // Tell this client about all existing peers
              for (const [id] of clients) {
                if (id !== clientId) {
                  ws.send(JSON.stringify({ type: 'peer-joined', id }));
                }
              }
              // Announce this client to everyone else
              for (const [id, c] of clients) {
                if (id !== clientId && c.readyState === 1) {
                  c.send(JSON.stringify({ type: 'peer-joined', id: clientId }));
                }
              }
              return;
            }

            // Relay signaling messages (offer, answer, ice-candidate) to a specific peer
            if (msg.to) {
              const target = clients.get(msg.to);
              if (target && target.readyState === 1) {
                target.send(JSON.stringify({ ...msg, from: clientId }));
              }
            }
          } catch (e) {
            // ignore malformed messages
          }
        });

        ws.on('close', () => {
          if (clientId) {
            clients.delete(clientId);
            for (const [, c] of clients) {
              if (c.readyState === 1) {
                c.send(JSON.stringify({ type: 'peer-left', id: clientId }));
              }
            }
          }
        });
      });

      console.log('  ➜  LocalDrop signaling relay active on /signaling');
    },
  };
}
