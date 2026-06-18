import type { WebSocket } from 'ws';

/**
 * WebSocket manager: tracks connected clients (waiters + customer devices),
 * broadcasts order/table status updates in real-time.
 */

interface ConnectedClient {
  ws: WebSocket;
  id: string;
  role: 'waiter' | 'client' | 'unknown';
  tableId?: string;   // for clients viewing a specific table
  waiterId?: string;  // for waiters
}

const clients = new Map<string, ConnectedClient>();

export function addClient(client: ConnectedClient): void {
  clients.set(client.id, client);
  console.log(`[WS] Client connected: ${client.id} (role: ${client.role})`);
}

export function removeClient(id: string): void {
  clients.delete(id);
  console.log(`[WS] Client disconnected: ${id}`);
}

export function broadcast(event: string, data: unknown): void {
  const msg = JSON.stringify({ event, data, timestamp: Date.now() });
  let sent = 0;
  for (const client of Array.from(clients.values())) {
    if (client.ws.readyState === 1) { // OPEN
      client.ws.send(msg);
      sent++;
    }
  }
  if (sent > 0) {
    console.log(`[WS] Broadcast "${event}" to ${sent} clients`);
  }
}

export function sendToWaiters(event: string, data: unknown): void {
  const msg = JSON.stringify({ event, data, timestamp: Date.now() });
  let sent = 0;
  for (const client of Array.from(clients.values())) {
    if (client.role === 'waiter' && client.ws.readyState === 1) {
      client.ws.send(msg);
      sent++;
    }
  }
  if (sent > 0) {
    console.log(`[WS] Notified ${sent} waiters: ${event}`);
  }
}

export function sendToTable(tableId: string, event: string, data: unknown): void {
  const msg = JSON.stringify({ event, data, timestamp: Date.now() });
  let sent = 0;
  for (const client of Array.from(clients.values())) {
    if (client.tableId === tableId && client.ws.readyState === 1) {
      client.ws.send(msg);
      sent++;
    }
  }
  if (sent > 0) {
    console.log(`[WS] Notified table ${tableId}: ${event}`);
  }
}

export function getConnectedCount(): number {
  return clients.size;
}