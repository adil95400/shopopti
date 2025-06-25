import React, { useState } from 'react';
import { Edit, RefreshCw, Trash } from 'lucide-react';

import MainNavbar from '../../components/layout/MainNavbar';
import Footer from '../../components/layout/Footer';

interface Product {
  id: string;
  title: string;
  status: string;
  supplier: string;
  date: string;
}

const ProductsIndex: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const products: Product[] = [
    { id: '1', title: 'Produit A', status: 'actif', supplier: 'AliExpress', date: '2024-06-01' },
    { id: '2', title: 'Produit B', status: 'brouillon', supplier: 'BigBuy', date: '2024-05-20' }
  ];

  const filtered = products.filter(p =>
    (statusFilter ? p.status === statusFilter : true) &&
    (supplierFilter ? p.supplier === supplierFilter : true) &&
    (dateFilter ? p.date === dateFilter : true)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavbar />
      <div className="max-w-5xl mx-auto px-4 py-12 mt-16 space-y-6">
        <h1 className="text-2xl font-bold">Produits importés</h1>

        <div className="flex flex-wrap gap-4">
          <select
            className="border px-3 py-2 rounded"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">Tous statuts</option>
            <option value="actif">Actif</option>
            <option value="brouillon">Brouillon</option>
          </select>
          <select
            className="border px-3 py-2 rounded"
            value={supplierFilter}
            onChange={e => setSupplierFilter(e.target.value)}
          >
            <option value="">Tous fournisseurs</option>
            <option value="AliExpress">AliExpress</option>
            <option value="BigBuy">BigBuy</option>
          </select>
          <input
            type="date"
            className="border px-3 py-2 rounded"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
          />
        </div>

        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">Produit</th>
                <th className="px-6 py-3 text-left">Statut</th>
                <th className="px-6 py-3 text-left">Fournisseur</th>
                <th className="px-6 py-3 text-left">Date</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3">{p.title}</td>
                  <td className="px-6 py-3 capitalize">{p.status}</td>
                  <td className="px-6 py-3">{p.supplier}</td>
                  <td className="px-6 py-3">{p.date}</td>
                  <td className="px-6 py-3 text-right space-x-2">
                    <button className="text-blue-600 hover:text-blue-800"><Edit className="inline h-4 w-4" /></button>
                    <button className="text-green-600 hover:text-green-800"><RefreshCw className="inline h-4 w-4" /></button>
                    <button className="text-red-600 hover:text-red-800"><Trash className="inline h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ProductsIndex;
