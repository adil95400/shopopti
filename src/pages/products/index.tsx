import React, { useState } from 'react';
import { Edit, RefreshCw, Trash2 } from 'lucide-react';

import { Button } from '../../components/ui/button';

interface Product {
  id: string;
  name: string;
  provider: string;
  status: 'active' | 'draft' | 'archived';
  date: string;
}

const initialProducts: Product[] = [
  { id: '1', name: 'Wireless Mouse', provider: 'Shopify', status: 'active', date: '2024-05-01' },
  { id: '2', name: 'USB-C Cable', provider: 'Amazon', status: 'draft', date: '2024-05-10' },
  { id: '3', name: 'Bluetooth Speaker', provider: 'eBay', status: 'active', date: '2024-05-12' }
];

const ProductList: React.FC = () => {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [statusFilter, setStatusFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const filtered = products.filter(p =>
    (statusFilter ? p.status === statusFilter : true) &&
    (providerFilter ? p.provider === providerFilter : true) &&
    (dateFilter ? p.date === dateFilter : true)
  );

  const handleEdit = (id: string) => {
    alert(`Edit product ${id}`);
  };

  const handleSync = (id: string) => {
    alert(`Sync product ${id}`);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this product?')) {
      setProducts(products.filter(p => p.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-gray-600">Manage your store products</p>
        </div>
      </div>

      <div className="flex gap-2">
        <select
          className="border border-gray-300 rounded-md px-2 py-1"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <select
          className="border border-gray-300 rounded-md px-2 py-1"
          value={providerFilter}
          onChange={e => setProviderFilter(e.target.value)}
        >
          <option value="">All Providers</option>
          <option value="Shopify">Shopify</option>
          <option value="Amazon">Amazon</option>
          <option value="eBay">eBay</option>
        </select>
        <input
          type="date"
          className="border border-gray-300 rounded-md px-2 py-1"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
        />
      </div>

      <div className="overflow-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {filtered.map(product => (
              <tr key={product.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.provider}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{product.status}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.date}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(product.id)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleSync(product.id)}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(product.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProductList;
