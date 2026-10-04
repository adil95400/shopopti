import { useMemo, useState } from 'react';
import { CheckCircle, Download, PackageCheck, RefreshCw, Search, Truck } from 'lucide-react';

import { useSupplierOrders } from '@/hooks/useSupplierOrders';

const PAGE_SIZE = 20;

function statusLabel(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === 'delivered') return { label: 'Livrée', icon: CheckCircle };
  if (normalized === 'shipped') return { label: 'Expédiée', icon: Truck };
  if (normalized === 'processing') return { label: 'En traitement', icon: RefreshCw };
  if (normalized === 'pending') return { label: 'En attente', icon: RefreshCw };
  return { label: status || 'Non renseigné', icon: PackageCheck };
}

export default function Orders() {
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'amount_desc' | 'amount_asc'>('newest');
  const [page, setPage] = useState(1);
  const { orders, loading, error, refresh } = useSupplierOrders({ status });

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const rows = orders.filter((order) => {
      if (!query) return true;
      return (
        order.id.toLowerCase().includes(query) ||
        order.status.toLowerCase().includes(query) ||
        (order.tracking_number || '').toLowerCase().includes(query)
      );
    });

    return [...rows].sort((a, b) => {
      if (sort === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sort === 'amount_desc') return b.total_amount - a.total_amount;
      if (sort === 'amount_asc') return a.total_amount - b.total_amount;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [orders, searchQuery, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const exportCsv = () => {
    const header = ['id', 'status', 'total_amount', 'tracking_number', 'created_at'];
    const lines = filtered.map((order) =>
      [order.id, order.status, order.total_amount, order.tracking_number || '', order.created_at]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(',')
    );

    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `shopopti-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 md:text-3xl">Commandes fournisseur</h1>
          <p className="text-neutral-500">Données réelles issues de supplier_orders. Aucun ordre fictif n'est affiché.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-outline" onClick={() => void refresh()}>
            <RefreshCw size={16} className="mr-2" />Actualiser
          </button>
          <button type="button" className="btn btn-outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download size={16} className="mr-2" />Exporter CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Commandes indisponibles : {error}
        </div>
      )}

      <div className="card">
        <div className="mb-6 grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="ID, statut ou numéro de suivi…"
              className="input w-full pl-10"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            className="input"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">Tous les statuts</option>
            <option value="pending">En attente</option>
            <option value="processing">En traitement</option>
            <option value="shipped">Expédiée</option>
            <option value="delivered">Livrée</option>
            <option value="cancelled">Annulée</option>
          </select>
          <select className="input" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
            <option value="newest">Plus récentes</option>
            <option value="oldest">Plus anciennes</option>
            <option value="amount_desc">Montant décroissant</option>
            <option value="amount_asc">Montant croissant</option>
          </select>
        </div>

        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-neutral-500">Commande</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-neutral-500">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-neutral-500">Articles</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-neutral-500">Montant</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-neutral-500">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-neutral-500">Suivi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              {visible.map((order) => {
                const state = statusLabel(order.status);
                const StatusIcon = state.icon;
                return (
                  <tr key={order.id} className="hover:bg-neutral-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-neutral-900">#{order.id.slice(0, 8)}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-neutral-700">{new Date(order.created_at).toLocaleString('fr-FR')}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-neutral-700">{order.items.length}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-neutral-900">
                      {order.total_amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">
                        <StatusIcon size={12} className="mr-1" />{state.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-neutral-700">{order.tracking_number || 'Non disponible'}</td>
                  </tr>
                );
              })}

              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-neutral-500">Aucune commande vérifiée.</td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-neutral-500">Chargement…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-neutral-600">
          <span>{filtered.length} commande{filtered.length > 1 ? 's' : ''}</span>
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-outline" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Précédent</button>
            <span>Page {safePage} / {totalPages}</span>
            <button type="button" className="btn btn-outline" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Suivant</button>
          </div>
        </div>
      </div>
    </div>
  );
}
