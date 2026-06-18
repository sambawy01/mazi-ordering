import Database from 'better-sqlite3';
import { config } from '../config.js';
import fs from 'fs';
import path from 'path';

let db: Database.Database;

export function initDB(): Database.Database {
  // Ensure data dir exists
  const dbDir = path.dirname(config.backend.dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(config.backend.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  createTables();
  console.log(`[DB] SQLite initialized at ${config.backend.dbPath}`);
  return db;
}

export function getDB(): Database.Database {
  if (!db) throw new Error('DB not initialized. Call initDB() first.');
  return db;
}

function createTables(): void {
  db.exec(`
    -- OAuth tokens (encrypted at rest by app-level encryption if needed)
    CREATE TABLE IF NOT EXISTS oauth_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      access_token TEXT NOT NULL,
      business_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT
    );

    -- Waiter sessions
    CREATE TABLE IF NOT EXISTS waiter_sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_email TEXT,
      is_owner INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );

    -- Menu cache (products, categories stored as JSON)
    CREATE TABLE IF NOT EXISTS menu_cache (
      key TEXT PRIMARY KEY,        -- 'products' | 'categories' | 'modifiers'
      data TEXT NOT NULL,           -- JSON array
      synced_at INTEGER NOT NULL    -- epoch ms
    );

    -- Table cache
    CREATE TABLE IF NOT EXISTS table_cache (
      table_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status INTEGER,
      seats INTEGER,
      section_id TEXT,
      section_name TEXT,
      accepts_reservations INTEGER,
      data TEXT NOT NULL,            -- full JSON object
      synced_at INTEGER NOT NULL
    );

    -- QR codes generated for tables
    CREATE TABLE IF NOT EXISTS qr_codes (
      id TEXT PRIMARY KEY,           -- uuid
      table_id TEXT NOT NULL,
      table_name TEXT,
      reservation_name TEXT,
      branch_id TEXT,
      qr_data TEXT NOT NULL,         -- the encoded payload
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Order cache (recent orders, lightweight)
    CREATE TABLE IF NOT EXISTS order_cache (
      order_id TEXT PRIMARY KEY,
      table_id TEXT,
      table_name TEXT,
      branch_id TEXT,
      status INTEGER,
      total REAL,
      source TEXT,                   -- 'waiter' | 'client_qr'
      reservation_name TEXT,
      data TEXT NOT NULL,            -- full JSON
      synced_at INTEGER NOT NULL
    );

    -- App settings (key-value)
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    -- Webhook events log (for debugging)
    CREATE TABLE IF NOT EXISTS webhook_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT,
      resource_type TEXT,
      resource_id TEXT,
      payload TEXT,
      received_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

// --- Menu cache operations ---

export function setMenuCache(key: string, data: unknown): void {
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO menu_cache (key, data, synced_at) VALUES (?, ?, ?)`,
  );
  stmt.run(key, JSON.stringify(data), Date.now());
}

export function getMenuCache(key: string): { data: unknown; syncedAt: number } | null {
  const stmt = db.prepare(`SELECT data, synced_at FROM menu_cache WHERE key = ?`);
  const row = stmt.get(key) as { data: string; synced_at: number } | undefined;
  if (!row) return null;
  return { data: JSON.parse(row.data), syncedAt: row.synced_at };
}

// --- Table cache operations ---

export function setTableCache(tables: { id: string; name: string; status: number | null; seats: number; section_id?: string; section_name?: string; accepts_reservations: boolean; data: unknown }[]): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO table_cache
    (table_id, name, status, seats, section_id, section_name, accepts_reservations, data, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const tx = db.transaction(() => {
    for (const t of tables) {
      stmt.run(
        t.id, t.name, t.status ?? null, t.seats,
        t.section_id ?? null, t.section_name ?? null,
        t.accepts_reservations ? 1 : 0,
        JSON.stringify(t.data),
        Date.now(),
      );
    }
  });
  tx();
}

export function getAllCachedTables(): { table_id: string; name: string; status: number | null; seats: number; section_id: string | null; section_name: string | null; accepts_reservations: number; data: string; synced_at: number }[] {
  const stmt = db.prepare(`SELECT * FROM table_cache ORDER BY name`);
  return stmt.all() as any[];
}

export function getCachedTable(tableId: string): { table_id: string; name: string; status: number | null; seats: number; data: string } | null {
  const stmt = db.prepare(`SELECT * FROM table_cache WHERE table_id = ?`);
  return (stmt.get(tableId) as any) || null;
}

// --- Order cache operations ---

export function setOrderCache(order: {
  order_id: string;
  table_id?: string;
  table_name?: string;
  branch_id?: string;
  status?: number;
  total?: number;
  source?: string;
  reservation_name?: string;
  data: unknown;
}): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO order_cache
    (order_id, table_id, table_name, branch_id, status, total, source, reservation_name, data, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    order.order_id,
    order.table_id ?? null,
    order.table_name ?? null,
    order.branch_id ?? null,
    order.status ?? null,
    order.total ?? null,
    order.source ?? null,
    order.reservation_name ?? null,
    JSON.stringify(order.data),
    Date.now(),
  );
}

export function getCachedOrder(orderId: string): any {
  const stmt = db.prepare(`SELECT * FROM order_cache WHERE order_id = ?`);
  return stmt.get(orderId) || null;
}

export function getCachedOrdersByTable(tableId: string): any[] {
  const stmt = db.prepare(`SELECT * FROM order_cache WHERE table_id = ? ORDER BY synced_at DESC`);
  return stmt.all(tableId) as any[];
}

// --- Waiter session operations ---

export function saveWaiterSession(session: {
  token: string;
  user_id: string;
  user_name: string;
  user_email?: string;
  is_owner: boolean;
  created_at: number;
  expires_at: number;
}): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO waiter_sessions
    (token, user_id, user_name, user_email, is_owner, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    session.token,
    session.user_id,
    session.user_name,
    session.user_email ?? null,
    session.is_owner ? 1 : 0,
    session.created_at,
    session.expires_at,
  );
}

export function getWaiterSession(token: string): { token: string; user_id: string; user_name: string; user_email: string | null; is_owner: number; created_at: number; expires_at: number } | null {
  const stmt = db.prepare(`SELECT * FROM waiter_sessions WHERE token = ?`);
  return (stmt.get(token) as any) || null;
}

export function deleteWaiterSession(token: string): void {
  const stmt = db.prepare(`DELETE FROM waiter_sessions WHERE token = ?`);
  stmt.run(token);
}

// --- Settings ---

export function getSetting(key: string): string | null {
  const stmt = db.prepare(`SELECT value FROM settings WHERE key = ?`);
  const row = stmt.get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  const stmt = db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`);
  stmt.run(key, value);
}

// --- Webhook event log ---

export function logWebhookEvent(event: { event_type: string; resource_type: string; resource_id: string; payload: string }): void {
  const stmt = db.prepare(`
    INSERT INTO webhook_events (event_type, resource_type, resource_id, payload)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(event.event_type, event.resource_type, event.resource_id, event.payload);
}