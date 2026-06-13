import { WebSocketServer } from 'ws';
import { URL } from 'url';

/**
 * Vite plugin that embeds a room-based WebSocket signaling relay
 * directly into the existing dev server. Relays connection requests
 * based on the query parameter ?room=room-xxx&peerId=yyy.
 */
export default function signalingPlugin() {
  return {
    name: 'localdrop-signaling',
    configureServer(server) {
      const wss = new WebSocketServer({ noServer: true });
      const rooms = new Map(); // roomName → Map(peerId → ws)

      server.httpServer.on('upgrade', (req, socket, head) => {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        if (url.pathname.endsWith('/signaling')) {
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
          });
        }
      });

      wss.on('connection', (ws, req) => {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const room = url.searchParams.get('room');
        const peerId = url.searchParams.get('peerId');

        if (!room || !peerId) {
          ws.close(1008, 'Missing room or peerId query parameters');
          return;
        }

        // Initialize room if not exists
        if (!rooms.has(room)) {
          rooms.set(room, new Map());
        }
        const roomClients = rooms.get(room);

        // Store client
        roomClients.set(peerId, ws);

        // Notify other clients in the same room, and inform the new client about existing ones
        for (const [otherId, otherWs] of roomClients) {
          if (otherId !== peerId && otherWs.readyState === 1) {
            otherWs.send(JSON.stringify({ type: 'peer-joined', id: peerId }));
            ws.send(JSON.stringify({ type: 'peer-joined', id: otherId }));
          }
        }

        ws.on('message', (raw) => {
          try {
            const msg = JSON.parse(raw);
            if (msg.to) {
              const target = roomClients.get(msg.to);
              if (target && target.readyState === 1) {
                target.send(JSON.stringify({ ...msg, from: peerId }));
              }
            }
          } catch {
            // ignore
          }

        });

        ws.on('close', () => {
          roomClients.delete(peerId);
          if (roomClients.size === 0) {
            rooms.delete(room);
          } else {
            for (const [, otherWs] of roomClients) {
              if (otherWs.readyState === 1) {
                otherWs.send(JSON.stringify({ type: 'peer-left', id: peerId }));
              }
            }
          }
        });
      });

      console.log('  ➜  Room-based signaling relay active on /signaling');
    },
  };
}
