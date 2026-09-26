import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, PackageCheck, RefreshCw, Search } from 'lucide-react';

import { shopifyService } from '@/services/shopifyService';

type ShopifyOrder = Awaited<ReturnType<typeof shopifyService.getOrders>>[number];

const Orders: React.FC = () => {
  const [orders, setOrders] = useState<ShopifyOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const remoteOrders = await shopifyService.getOrders();
      setOrders(remoteOrders);
    } catch (loadError) {
      setOrders([]);
      setError(loadError instanceof Error ? loadError.message : 'Shopify orders could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return orders;
    return orders.filter(order =>
      order.name.toLowerCase().includes(needle)
      || (order.customer_name || '').toLowerCase().includes(needle)
      || (order.email || '').toLowerCase().includes(needle)
    );
  }, [orders, searchQuery]);

  const formatDate = (value?: string | null) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
  };

  const formatMoney = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${currency}`;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 md:text-3xl">Shopify Orders</h1>
          <p className="text-neutral-500">
            Orders shown here are fetched from the connected Shopify store and persisted by ShopOpti.
          </p>
        </div>
        <button className="btn btn-outline" onClick={() => void loadOrders()} disabled={loading}>
          {loading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <RefreshCw size={16} className="mr-2" />}
          Refresh from Shopify
        </button>
      </div>

      {error && (
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Shopify orders are not confirmed.</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      <div className="card">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="Search Shopify orders, customers..."
            className="input w-full pl-10"
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-neutral-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading confirmed Shopify orders…
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-neutral-100 p-3">
              <PackageCheck size={28} className="text-neutral-400" />
            </div>
            <h2 className="mt-4 text-lg font-medium text-neutral-900">No confirmed Shopify orders</h2>
            <p className="mt-1 text-neutral-500">
              ShopOpti does not display sample orders. Connect Shopify with read_orders access and refresh.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-neutral-200">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">Order</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">Updated</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">Payment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">Fulfillment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white">
                {filteredOrders.map(order => (
                  <tr key={order.id}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-neutral-900">{order.name}</td>
                    <td className="px-6 py-4 text-sm text-neutral-700">
                      <div>{order.customer_name || 'Guest'}</div>
                      <div className="text-xs text-neutral-500">{order.email || 'No email'}</div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-neutral-600">{formatDate(order.updated_at || order.created_at)}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-neutral-900">
                      {formatMoney(order.total_price, order.currency)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-neutral-700">{order.financial_status || 'UNKNOWN'}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-neutral-700">{order.fulfillment_status || 'UNKNOWN'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Orders;
