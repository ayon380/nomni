'use client';

import React, { useState, useEffect, use, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { InternalOrder, OrderStatus } from '@/lib/types';
import { formatMoney, formatDateTime, getNextStatus, getProviderLabel } from '@/lib/utils';
import { ProviderBadge } from '@/components/ProviderBadge';
import { StatusBadge } from '@/components/StatusBadge';
import {
  ArrowLeft,
  Clock,
  User,
  Phone,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ChevronRight,
  Code2,
  Terminal,
  Layers,
} from 'lucide-react';

function OrderDetailContent({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [order, setOrder] = useState<InternalOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Preserve query string for "Back to Orders"
  const backHref = searchParams.toString() ? `/?${searchParams.toString()}` : '/';

  useEffect(() => {
    async function loadOrder() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/orders/${id}`);
        if (!res.ok) {
          if (res.status === 404) throw new Error('Order not found');
          throw new Error(`HTTP error ${res.status}`);
        }
        const data = await res.json();
        setOrder(data.order);
      } catch (err: any) {
        setError(err.message || 'Failed to load order');
      } finally {
        setLoading(false);
      }
    }
    loadOrder();
  }, [id]);

  // Advance status forward
  const handleAdvanceStatus = async () => {
    if (!order) return;
    const next = getNextStatus(order.status);
    if (!next) return;

    setUpdating(true);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error('Failed to advance order status');
      const data = await res.json();
      setOrder(data.order);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdating(false);
    }
  };

  // Copy raw payload JSON to clipboard
  const handleCopyJson = () => {
    if (!order) return;
    navigator.clipboard.writeText(JSON.stringify(order.raw_payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
        <div className="w-32 h-6 rounded bg-zinc-800" />
        <div className="glass-panel rounded-2xl p-8 space-y-4">
          <div className="w-48 h-8 rounded bg-zinc-800" />
          <div className="w-full h-32 rounded bg-zinc-800" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-4xl mx-auto glass-panel rounded-2xl p-12 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
        <h2 className="text-base font-semibold text-white">Order Not Found</h2>
        <p className="text-xs text-zinc-400">
          The requested ticket #{id} could not be retrieved from the kitchen database.
        </p>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Orders
        </Link>
      </div>
    );
  }

  const nextStatus = getNextStatus(order.status);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Navigation & Back Button (Preserves Filters) */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/[0.08] transition-colors group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Orders</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-zinc-500">Internal ID: {order.id}</span>
        </div>
      </div>

      {/* Main Kitchen Ticket Card */}
      <div className="glass-panel rounded-2xl p-6 sm:p-8 space-y-8 shadow-2xl shadow-black/60">
        {/* Ticket Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-white/[0.06]">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <ProviderBadge provider={order.provider} />
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/[0.08]">
                #{order.external_order_id}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {order.customer.name}
            </h1>
            <div className="flex items-center gap-3 text-xs text-zinc-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                {formatDateTime(order.created_at)}
              </span>
              {order.customer.phone && (
                <>
                  <span className="text-zinc-600">•</span>
                  <span className="flex items-center gap-1 font-mono text-zinc-300">
                    <Phone className="w-3 h-3 text-zinc-500" />
                    {order.customer.phone}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Status & Status Progression Action */}
          <div className="flex flex-col sm:items-end gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">Current Status:</span>
              <StatusBadge status={order.status} />
            </div>

            {nextStatus && (
              <button
                onClick={handleAdvanceStatus}
                disabled={updating}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-all shadow-lg shadow-violet-500/25 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Advance to {nextStatus.charAt(0) + nextStatus.slice(1).toLowerCase()}</span>
              </button>
            )}

            {!nextStatus && (
              <span className="text-[11px] text-zinc-500 italic">
                Order reached terminal state ({order.status.toLowerCase()}).
              </span>
            )}
          </div>
        </div>

        {/* Line Items Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Order Items ({order.line_items.length})
            </h3>
            <span className="text-[11px] text-zinc-500">Unit Price & Line Total</span>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-black/20">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[11px] text-zinc-400 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Item</th>
                  <th className="py-2.5 px-4 text-center w-16">Qty</th>
                  <th className="py-2.5 px-4 text-right w-24">Unit Price</th>
                  <th className="py-2.5 px-4 text-right w-28">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {order.line_items.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-white/[0.01]">
                    <td className="py-3 px-4">
                      <div className="font-medium text-zinc-100">{item.name}</div>
                      {item.special_instructions && (
                        <div className="text-[11px] text-amber-400/90 mt-0.5 italic flex items-center gap-1">
                          <span>Note:</span> {item.special_instructions}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-zinc-300 tabular-nums">
                      {item.quantity}×
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-400 tabular-nums">
                      {formatMoney(item.unit_price, order.currency)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-white tabular-nums">
                      {formatMoney(item.line_total, order.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals Summary */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pt-4 border-t border-white/[0.06]">
          <div className="text-xs text-zinc-400 space-y-1">
            <p>Provider: <span className="text-zinc-200 font-medium">{getProviderLabel(order.provider)}</span></p>
            <p>Normalized Currency: <span className="font-mono text-zinc-200">{order.currency}</span></p>
          </div>

          <div className="w-full sm:w-64 space-y-2 text-xs">
            <div className="flex justify-between text-zinc-400">
              <span>Items Total:</span>
              <span className="font-mono tabular-nums text-zinc-200">
                {formatMoney(
                  order.line_items.reduce((acc, it) => acc + it.line_total, 0),
                  order.currency
                )}
              </span>
            </div>
            <div className="flex justify-between text-base font-semibold text-white pt-2 border-t border-white/[0.06]">
              <span>Grand Total:</span>
              <span className="font-mono tabular-nums text-emerald-400">
                {formatMoney(order.total_cents, order.currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Debug Accordion (Per Requirement: raw cents & marketplace JSON appear ONLY here) */}
        <details className="group border border-white/[0.06] bg-black/40 rounded-xl overflow-hidden text-xs">
          <summary className="px-4 py-3 cursor-pointer flex items-center justify-between text-zinc-400 hover:text-zinc-200 font-medium select-none transition-colors">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-violet-400" />
              <span>Debug Telemetry & Original Marketplace Payload</span>
            </div>
            <span className="text-[11px] font-mono text-zinc-500 group-open:rotate-90 transition-transform">
              ▸
            </span>
          </summary>

          <div className="p-4 space-y-4 border-t border-white/[0.04] bg-zinc-950/80">
            {/* Raw Cents & Metadata */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <div className="text-[10px] uppercase font-mono text-zinc-500">raw total_cents</div>
                <div className="text-sm font-mono text-violet-300 font-bold">{order.total_cents}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <div className="text-[10px] uppercase font-mono text-zinc-500">currency code</div>
                <div className="text-sm font-mono text-zinc-200">{order.currency}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <div className="text-[10px] uppercase font-mono text-zinc-500">internal id</div>
                <div className="text-sm font-mono text-zinc-200 truncate">{order.id}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <div className="text-[10px] uppercase font-mono text-zinc-500">external ref</div>
                <div className="text-sm font-mono text-zinc-200 truncate">{order.external_order_id}</div>
              </div>
            </div>

            {/* Raw Marketplace JSON */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5 text-zinc-500" />
                  raw_payload ({order.provider})
                </span>
                <button
                  onClick={handleCopyJson}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-300 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy JSON</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-3 rounded-lg bg-black/80 border border-white/[0.04] text-[11px] font-mono text-zinc-300 overflow-x-auto max-h-96">
                {JSON.stringify(order.raw_payload, null, 2)}
              </pre>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto glass-panel rounded-2xl p-8 text-center text-zinc-400 text-xs animate-pulse">
          Loading order details...
        </div>
      }
    >
      <OrderDetailContent paramsPromise={params} />
    </Suspense>
  );
}
