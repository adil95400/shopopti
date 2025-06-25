import React, { useState } from 'react';
import { Download } from 'lucide-react';

import MainNavbar from '../../components/layout/MainNavbar';
import Footer from '../../components/layout/Footer';
import { Button } from '../../components/ui/button';

interface Order {
  id: string;
  status: string;
  channel: string;
  client: string;
  amount: number;
}

const OrdersIndex: React.FC = () => {
  const [status, setStatus] = useState('');
  const [channel, setChannel] = useState('');
  const [client, setClient] = useState('');

  const orders: Order[] = [
    { id: '#2301', status: 'expédiée', channel: 'Shopify', client: 'Alice', amount: 29.9 },
    { id: '#2302', status: 'en cours', channel: 'Amazon', client: 'Bob', amount: 49.9 }
  ];

  const filtered = orders.filter(o =>
    (status ? o.status === status : true) &&
    (channel ? o.channel === channel : true) &&
    (client ? o.client.toLowerCase().includes(client.toLowerCase()) : true)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavbar />
      <div className="max-w-5xl mx-auto px-4 py-12 mt-16 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Commandes</h1>
          <div className="flex gap-2">
            <Button variant="outline"><Download className="h-4 w-4 mr-2" />PDF</Button>
            <Button variant="outline"><Download className="h-4 w-4 mr-2" />CSV</Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <select className="border px-3 py-2 rounded" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">Tous statuts</option>
            <option value="expédiée">Expédiée</option>
            <option value="en cours">En cours</option>
          </select>
          <select className="border px-3 py-2 rounded" value={channel} onChange={e => setChannel(e.target.value)}>
            <option value="">Tous canaux</option>
            <option value="Shopify">Shopify</option>
            <option value="Amazon">Amazon</option>
          </select>
          <input className="border px-3 py-2 rounded" placeholder="Client" value={client} onChange={e => setClient(e.target.value)} />
        </div>

        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">Commande</th>
                <th className="px-6 py-3 text-left">Statut</th>
                <th className="px-6 py-3 text-left">Canal</th>
                <th className="px-6 py-3 text-left">Client</th>
                <th className="px-6 py-3 text-right">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map(o => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3">{o.id}</td>
                  <td className="px-6 py-3 capitalize">{o.status}</td>
                  <td className="px-6 py-3">{o.channel}</td>
                  <td className="px-6 py-3">{o.client}</td>
                  <td className="px-6 py-3 text-right">{o.amount.toFixed(2)}€</td>
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

export default OrdersIndex;
