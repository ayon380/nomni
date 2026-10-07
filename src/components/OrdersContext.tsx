'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { InternalOrder, OrdersFilterParams } from '@/lib/types';

interface OrdersContextType {
  orders: InternalOrder[];
  setOrders: React.Dispatch<React.SetStateAction<InternalOrder[]>>;
  loading: boolean;
  error: string | null;
  fetchOrders: (filters?: OrdersFilterParams, silent?: boolean) => Promise<void>;
  updateOrderInStore: (updated: InternalOrder) => void;
  hasLoadedOnce: boolean;
}

const OrdersContext = createContext<OrdersContextType | null>(null);

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<InternalOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState<boolean>(false);
  const activeAbortRef = useRef<AbortController | null>(null);

  const fetchOrders = useCallback(
    async (filters?: OrdersFilterParams, silent = false) => {
      if (!silent) {
        setLoading(true);
      }
      setError(null);

      // Cancel inflight request
      if (activeAbortRef.current) {
        activeAbortRef.current.abort();
      }
      const controller = new AbortController();
      activeAbortRef.current = controller;

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
        setOrders(data.orders || []);
        setHasLoadedOnce(true);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to fetch kitchen orders');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateOrderInStore = useCallback((updated: InternalOrder) => {
    setOrders((prev) =>
      prev.map((ord) => (ord.id === updated.id ? updated : ord))
    );
  }, []);

  return (
    <OrdersContext.Provider
      value={{
        orders,
        setOrders,
        loading,
        error,
        fetchOrders,
        updateOrderInStore,
        hasLoadedOnce,
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) {
    throw new Error('useOrders must be used within an OrdersProvider');
  }
  return ctx;
}
