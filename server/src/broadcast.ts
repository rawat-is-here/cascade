import type { WebSocket } from 'ws';

const clients = new Set<WebSocket>();

export function registerWsClient(ws: WebSocket): void {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));
}

export function broadcast(payload: unknown): void {
  const msg = JSON.stringify(payload);
  for (const client of clients) {
    if (client.readyState === 1) { // WebSocket.OPEN = 1
      try {
        client.send(msg);
      } catch {
        clients.delete(client);
      }
    }
  }
}

export function getConnectedClientCount(): number {
  return clients.size;
}
