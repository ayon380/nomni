import fs from 'fs';
import path from 'path';
import { InternalOrder, OrderStatus, OrdersFilterParams } from './types';
import { normalizeUberOrder } from './normalizers/uber';
import { normalizeDoorDashOrder } from './normalizers/doordash';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'orders.json');

class OrderStore {
  private orders: Map<string, InternalOrder> = new Map();
  private lastMtime = 0;
  private initialized = false;

  private ensureInitialized() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DATA_FILE)) {
      try {
        const stat = fs.statSync(DATA_FILE);
        if (stat.mtimeMs !== this.lastMtime || !this.initialized) {
          const raw = fs.readFileSync(DATA_FILE, 'utf-8');
          const parsed: InternalOrder[] = JSON.parse(raw);
          this.orders.clear();
          for (const order of parsed) {
            this.orders.set(order.id, order);
          }
          this.lastMtime = stat.mtimeMs;
          this.initialized = true;
        }
        return;
      } catch (err) {
        console.error('Failed reading existing orders.json, seeding defaults...', err);
      }
    }

    this.seedDefaultOrders();
    this.persist();
    this.initialized = true;
  }

  private seedDefaultOrders() {
    this.orders.clear();
    const fixturesDir = path.join(process.cwd(), 'fixtures');

    // 1. Seed Uber Eats Official Sample Order (Larry - Muffin, Coffee, Donut)
    try {
      const samplePath = path.join(fixturesDir, 'uber', 'sample_order.json');
      if (fs.existsSync(samplePath)) {
        const uberJson = JSON.parse(fs.readFileSync(samplePath, 'utf-8'));
        const uberOrder = normalizeUberOrder({ meta: { resource_id: uberJson.id } }, uberJson);
        this.orders.set(uberOrder.id, uberOrder);
      }
    } catch (e) {
      console.warn('Could not seed Uber sample:', e);
    }

    // 2. Seed DoorDash Official Sample Order (Kelley W. - Burrito Scram-Bowl)
    try {
      const samplePath = path.join(fixturesDir, 'doordash', 'sample.json');
      if (fs.existsSync(samplePath)) {
        const ddJson = JSON.parse(fs.readFileSync(samplePath, 'utf-8'));
        const ddOrder = normalizeDoorDashOrder(ddJson);
        this.orders.set(ddOrder.id, ddOrder);
      }
    } catch (e) {
      console.warn('Could not seed DoorDash sample:', e);
    }
  }

  private persist() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const data = Array.from(this.orders.values());
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
      const stat = fs.statSync(DATA_FILE);
      this.lastMtime = stat.mtimeMs;
    } catch (err) {
      console.error('Failed to persist orders to disk:', err);
    }
  }

  public getAllOrders(filters?: OrdersFilterParams): InternalOrder[] {
    this.ensureInitialized();
    let list = Array.from(this.orders.values());

    if (filters?.provider && filters.provider !== 'all') {
      list = list.filter((o) => o.provider === filters.provider);
    }

    if (filters?.status && filters.status !== 'all') {
      list = list.filter((o) => o.status.toLowerCase() === filters.status?.toLowerCase());
    }

    if (filters?.search && filters.search.trim()) {
      const query = filters.search.trim().toLowerCase();
      list = list.filter(
        (o) =>
          o.customer.name.toLowerCase().includes(query) ||
          o.external_order_id.toLowerCase().includes(query) ||
          o.id.toLowerCase().includes(query)
      );
    }

    // Sort by created_at time
    const sortAsc = filters?.sort === 'time_asc';
    list.sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      return sortAsc ? timeA - timeB : timeB - timeA;
    });

    return list;
  }

  public getOrderById(id: string): InternalOrder | null {
    this.ensureInitialized();
    return this.orders.get(id) || null;
  }

  /**
   * Idempotent Upsert:
   * Matches existing order by (provider + external_order_id) or internal id.
   * If found, updates details in-place. If not found, inserts new record.
   */
  public upsertOrder(order: InternalOrder): { order: InternalOrder; isUpsert: boolean } {
    this.ensureInitialized();

    // Find existing match
    let existingId: string | null = null;
    for (const [id, existing] of this.orders.entries()) {
      if (
        (existing.provider === order.provider && existing.external_order_id === order.external_order_id) ||
        existing.id === order.id
      ) {
        existingId = id;
        break;
      }
    }

    if (existingId) {
      const existing = this.orders.get(existingId)!;

      // Monotonic Kitchen Lifecycle Preservation:
      // In a Kitchen OS, once kitchen staff has moved an order forward
      // (RECEIVED -> CONFIRMED -> PREPARING -> READY -> DELIVERED), a redelivered webhook
      // (e.g. initial 'NEW' or 'CREATED' payload retry) must NOT regress the ticket's status back.
      //
      // Status resolution rules:
      // 1. If incoming order is an explicit cancellation ('CANCELLED'), accept cancellation.
      // 2. If the existing order is still in initial 'RECEIVED' state, incoming status updates apply.
      // 3. If staff has already progressed the ticket ('CONFIRMED', 'PREPARING', 'READY', 'DELIVERED'),
      //    preserve existing.status to prevent rolling back kitchen progress.
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
        id: existingId, // preserve internal ID
        status: resolvedStatus, // preserve kitchen progress
      };
      this.orders.set(existingId, updatedOrder);
      this.persist();
      return { order: updatedOrder, isUpsert: true };
    }

    // New insertion
    this.orders.set(order.id, order);
    this.persist();
    return { order, isUpsert: false };
  }

  public updateOrderStatus(id: string, newStatus: OrderStatus): InternalOrder | null {
    this.ensureInitialized();
    const existing = this.orders.get(id);
    if (!existing) return null;

    const updated: InternalOrder = {
      ...existing,
      status: newStatus,
    };
    this.orders.set(id, updated);
    this.persist();
    return updated;
  }

  public resetStore(): void {
    this.seedDefaultOrders();
    this.persist();
  }
}

export const orderStore = new OrderStore();
