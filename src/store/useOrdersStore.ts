import { create } from 'zustand';
import { InternalOrder, OrdersFilterParams } from '@/lib/types';

interface OrdersState {
  orders: InternalOrder[];
  loading: boolean;
  error: string | null;
  hasLoadedOnce: boolean;
  activeAbortController: AbortController | null;
  setOrders: (orders: InternalOrder[]) => void;
  updateOrderInStore: (order: InternalOrder) => void;
  fetchOrders: (filters?: OrdersFilterParams, silent?: boolean) => Promise<void>;
}

export const useOrdersStore = create<OrdersState>((set, get) => ({
  orders: [],
  loading: true,
  error: null,
  hasLoadedOnce: false,
  activeAbortController: null,

  setOrders: (orders) => set({ orders }),

  updateOrderInStore: (updated) =>
    set((state) => ({
      orders: state.orders.map((ord) => (ord.id === updated.id ? updated : ord)),
    })),

  fetchOrders: async (filters, silent) => {
    const isSilent = silent !== undefined ? silent : get().hasLoadedOnce;
    const { activeAbortController } = get();
    if (activeAbortController) {
      activeAbortController.abort();
    }
    const controller = new AbortController();

    if (!isSilent) {
      set({ loading: true, error: null, activeAbortController: controller });
    } else {
      set({ activeAbortController: controller, error: null });
    }

    try {
      const queryParams = new URLSearchParams();
      if (filters?.provider && filters.provider !== 'all') {
        queryParams.set('provider', filters.provider);
      }
      if (filters?.status && filters.status !== 'all') {
        queryParams.set('status', filters.status);
      }
      if (filters?.search && filters.search.trim()) {
        queryParams.set('search', filters.search.trim());
      }
      if (filters?.sort) {
        queryParams.set('sort', filters.sort);
      }

      const res = await fetch(`/api/orders?${queryParams.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      set({
        orders: data.orders || [],
        loading: false,
        hasLoadedOnce: true,
        error: null,
        activeAbortController: null,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch kitchen orders',
        activeAbortController: null,
      });
    }
  },
}));
