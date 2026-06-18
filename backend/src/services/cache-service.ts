import { getFoodicsClient } from './foodics-client.js';
import { getMenuCache, setMenuCache, getAllCachedTables, getCachedTable, getCachedOrdersByTable } from '../db/index.js';
import { config } from '../config.js';
import type { FoodicsProduct, FoodicsCategory, FoodicsTable } from '../types/index.js';

/**
 * Cache service: syncs menu, tables, and branches from Foodics on a schedule.
 * Prevents hitting the 90 req/min rate limit by caching read-heavy endpoints.
 */

let menuSyncInProgress = false;
let tableSyncInProgress = false;

export async function syncMenu(): Promise<void> {
  if (menuSyncInProgress) return;
  menuSyncInProgress = true;
  try {
    const client = getFoodicsClient();
    if (!client.hasToken()) {
      console.warn('[Cache] No Foodics token set, skipping menu sync');
      return;
    }
    console.log('[Cache] Syncing menu from Foodics...');
    const [products, categories] = await Promise.all([
      client.listProducts({ is_active: 1 }),
      client.listCategories(),
    ]);
    setMenuCache('products', products);
    setMenuCache('categories', categories);
    console.log(`[Cache] Menu synced: ${products.length} products, ${categories.length} categories`);
  } catch (err) {
    console.error('[Cache] Menu sync failed:', err instanceof Error ? err.message : err);
  } finally {
    menuSyncInProgress = false;
  }
}

export async function syncTables(): Promise<void> {
  if (tableSyncInProgress) return;
  tableSyncInProgress = true;
  try {
    const client = getFoodicsClient();
    if (!client.hasToken()) {
      console.warn('[Cache] No Foodics token set, skipping table sync');
      return;
    }
    const tables = await client.listTables();
    // Write to DB cache
    const { setTableCache } = await import('../db/index.js');
    setTableCache(
      tables.map((t: FoodicsTable) => ({
        id: t.id,
        name: t.name,
        status: t.status,
        seats: t.seats,
        section_id: t.section?.id,
        section_name: t.section?.name,
        accepts_reservations: t.accepts_reservations,
        data: t,
      })),
    );
    console.log(`[Cache] Tables synced: ${tables.length} tables`);
  } catch (err) {
    console.error('[Cache] Table sync failed:', err instanceof Error ? err.message : err);
  } finally {
    tableSyncInProgress = false;
  }
}

export function getCachedMenu(): { products: FoodicsProduct[]; categories: FoodicsCategory[] } | null {
  const productsCache = getMenuCache('products');
  const categoriesCache = getMenuCache('categories');
  if (!productsCache || !categoriesCache) return null;

  // Check TTL
  const now = Date.now();
  if (now - productsCache.syncedAt > config.cache.menuTtlMs) {
    // Stale — trigger background sync
    syncMenu().catch(() => {});
  }

  return {
    products: productsCache.data as FoodicsProduct[],
    categories: categoriesCache.data as FoodicsCategory[],
  };
}

export function getCachedTablesList() {
  return getAllCachedTables().map((row) => ({
    id: row.table_id,
    name: row.name,
    status: row.status,
    seats: row.seats,
    section_id: row.section_id,
    section_name: row.section_name,
    accepts_reservations: !!row.accepts_reservations,
    synced_at: row.synced_at,
  }));
}

export function getSingleCachedTable(tableId: string) {
  const row = getCachedTable(tableId);
  if (!row) return null;
  return {
    id: row.table_id,
    name: row.name,
    status: row.status,
    seats: row.seats,
    data: JSON.parse(row.data),
    synced_at: (row as any).synced_at || Date.now(),
  };
}

export function getOrdersForTable(tableId: string) {
  return getCachedOrdersByTable(tableId);
}

/**
 * Start periodic sync loops.
 */
export function startSyncLoops(): void {
  // Menu sync every 5 minutes
  setInterval(() => {
    syncMenu().catch(() => {});
  }, config.cache.menuTtlMs);

  // Table sync every 30 seconds
  setInterval(() => {
    syncTables().catch(() => {});
  }, config.cache.tableTtlMs);

  // Initial sync on startup (delayed to allow token to be set)
  setTimeout(() => {
    syncMenu().catch(() => {});
    syncTables().catch(() => {});
  }, 2000);

  console.log('[Cache] Sync loops started (menu: 5min, tables: 30s)');
}