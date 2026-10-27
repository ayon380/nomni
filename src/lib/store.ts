import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { InternalOrder, OrderStatus, OrdersFilterParams } from './types';
import { normalizeUberOrderSync } from './normalizers/uber';
import { normalizeDoorDashOrder } from './normalizers/doordash';
import { isValidStatusTransition } from './utils';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'orders.db');

class OrderStore {
  private db!: DatabaseSync;
  private initialized = false;

  private ensureInitialized() {
    if (this.initialized) return;

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    this.db = new DatabaseSync(DB_FILE);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA busy_timeout = 5000;');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        external_order_id TEXT NOT NULL,
        status TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT,
        total_cents INTEGER NOT NULL,
        currency TEXT NOT NULL,
        created_at TEXT NOT NULL,
        data TEXT NOT NULL,
        UNIQUE(provider, external_order_id)
      );
      CREATE INDEX IF NOT EXISTS idx_orders_provider_ext ON orders(provider, external_order_id);
      CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
    `);

    // Check if table is empty; if so, seed default fixture orders
    const countRow = this.db.prepare('SELECT COUNT(*) as cnt FROM orders').get() as { cnt: number };
    if (!countRow || countRow.cnt === 0) {
      this.seedDefaultOrders();
    }

    this.initialized = true;
  }

  private insertDirect(order: InternalOrder): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO orders (
        id, provider, external_order_id, status, customer_name, customer_phone, total_cents, currency, created_at, data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      order.id,
      order.provider,
      order.external_order_id,
      order.status,
      order.customer.name,
      order.customer.phone || null,
      order.total_cents,
      order.currency,
      order.created_at,
      JSON.stringify(order)
    );
  }

  private seedDefaultOrders(): void {
    const fixturesDir = path.join(process.cwd(), 'fixtures');

    // 1. Seed Uber Eats Official Sample Order (Larry - Muffin, Coffee, Donut)
    try {
      const samplePath = path.join(fixturesDir, 'uber', 'sample_order.json');
      if (fs.existsSync(samplePath)) {
        const raw = fs.readFileSync(samplePath, 'utf-8');
        const cleaned = raw.replace(/,(\s*[}\]])/g, '$1');
        const uberJson = JSON.parse(cleaned);
        const uberOrder = normalizeUberOrderSync(uberJson, { meta: { resource_id: uberJson.id } });
        this.insertDirect(uberOrder);
      }
    } catch (e) {
      console.warn('Could not seed Uber sample:', e);
    }

    // 2. Seed DoorDash Official Sample Order (Kelley W. - Burrito Scram-Bowl)
    try {
      const samplePath = path.join(fixturesDir, 'doordash', 'sample.json');
      if (fs.existsSync(samplePath)) {
        const raw = fs.readFileSync(samplePath, 'utf-8');
        const cleaned = raw.replace(/,(\s*[}\]])/g, '$1');
        const ddJson = JSON.parse(cleaned);
        const ddOrder = normalizeDoorDashOrder(ddJson);
        this.insertDirect(ddOrder);
      }
    } catch (e) {
      console.warn('Could not seed DoorDash sample:', e);
    }
  }

  public getAllOrders(filters?: OrdersFilterParams): InternalOrder[] {
    this.ensureInitialized();

    let sql = 'SELECT data FROM orders WHERE 1=1';
    const params: (string | number)[] = [];

    if (filters?.provider && filters.provider !== 'all') {
      sql += ' AND provider = ?';
      params.push(filters.provider);
    }

    if (filters?.status && filters.status !== 'all') {
      sql += ' AND LOWER(status) = LOWER(?)';
      params.push(filters.status);
    }

    if (filters?.search && filters.search.trim()) {
      sql += ' AND (LOWER(customer_name) LIKE ? OR LOWER(external_order_id) LIKE ? OR LOWER(id) LIKE ?)';
      const term = `%${filters.search.trim().toLowerCase()}%`;
      params.push(term, term, term);
    }

    const sortAsc = filters?.sort === 'time_asc';
    sql += sortAsc ? ' ORDER BY created_at ASC' : ' ORDER BY created_at DESC';

    const rows = this.db.prepare(sql).all(...params) as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as InternalOrder);
  }

  public getOrderById(id: string): InternalOrder | null {
    this.ensureInitialized();
    const row = this.db.prepare('SELECT data FROM orders WHERE id = ?').get(id) as { data: string } | undefined;
    if (!row) return null;
    return JSON.parse(row.data) as InternalOrder;
  }

  /**
   * Idempotent Upsert:
   * Matches existing order by (provider + external_order_id) or internal id.
   * If found, updates details in-place. If not found, inserts new record.
   * Thread-safe and atomic with SQLite.
   */
  public upsertOrder(order: InternalOrder): { order: InternalOrder; isUpsert: boolean } {
    this.ensureInitialized();

    // Find existing match by true unique identifiers (NOT short display_id)
    const existingRow = this.db.prepare(`
      SELECT id, data FROM orders
      WHERE id = ? OR (provider = ? AND external_order_id = ?)
      LIMIT 1
    `).get(order.id, order.provider, order.external_order_id) as { id: string; data: string } | undefined;

    if (existingRow) {
      const existing = JSON.parse(existingRow.data) as InternalOrder;

      // Monotonic Kitchen Lifecycle Preservation:
      // In a Kitchen OS, once kitchen staff has moved an order forward
      // (RECEIVED -> CONFIRMED -> PREPARING -> READY -> DELIVERED), a redelivered webhook
      // (e.g. initial 'NEW' or 'CREATED' payload retry) must NOT regress the ticket's status back.
      let resolvedStatus = existing.status;
      if (order.status === 'CANCELLED') {
        resolvedStatus = 'CANCELLED';
      } else if (existing.status === 'RECEIVED') {
        resolvedStatus = order.status;
      } else {
        resolvedStatus = existing.status;
      }

      const updatedOrder: InternalOrder = {
        ...order,
        id: existingRow.id, // preserve original internal ID
        status: resolvedStatus, // preserve kitchen progress
      };

      const updateStmt = this.db.prepare(`
        UPDATE orders SET
          status = ?,
          customer_name = ?,
          customer_phone = ?,
          total_cents = ?,
          currency = ?,
          data = ?
        WHERE id = ?
      `);

      updateStmt.run(
        updatedOrder.status,
        updatedOrder.customer.name,
        updatedOrder.customer.phone || null,
        updatedOrder.total_cents,
        updatedOrder.currency,
        JSON.stringify(updatedOrder),
        existingRow.id
      );

      return { order: updatedOrder, isUpsert: true };
    }

    // New insertion
    this.insertDirect(order);
    return { order, isUpsert: false };
  }

  public updateOrderStatus(id: string, newStatus: OrderStatus): InternalOrder | null {
    this.ensureInitialized();
    const existing = this.getOrderById(id);
    if (!existing) return null;

    if (!isValidStatusTransition(existing.status, newStatus)) {
      return null;
    }

    const updated: InternalOrder = {
      ...existing,
      status: newStatus,
    };

    const updateStmt = this.db.prepare(`
      UPDATE orders SET
        status = ?,
        data = ?
      WHERE id = ?
    `);

    updateStmt.run(newStatus, JSON.stringify(updated), id);
    return updated;
  }

  public resetStore(): void {
    this.ensureInitialized();
    this.db.exec('DELETE FROM orders');
    this.seedDefaultOrders();
  }
}

export const orderStore = new OrderStore();
