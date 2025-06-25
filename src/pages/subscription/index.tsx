import React from 'react';

import MainNavbar from '../../components/layout/MainNavbar';
import Footer from '../../components/layout/Footer';
import { Button } from '../../components/ui/button';

const invoices = [
  { id: 'f001', date: '2024-04-01', amount: 29.9 },
  { id: 'f002', date: '2024-05-01', amount: 29.9 }
];

const SubscriptionIndex: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavbar />
      <div className="max-w-3xl mx-auto px-4 py-12 mt-16 space-y-6">
        <h1 className="text-2xl font-bold">Abonnement</h1>

        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">Facture</th>
                <th className="px-6 py-3 text-left">Date</th>
                <th className="px-6 py-3 text-right">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invoices.map(i => (
                <tr key={i.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3">{i.id}</td>
                  <td className="px-6 py-3">{i.date}</td>
                  <td className="px-6 py-3 text-right">{i.amount.toFixed(2)}€</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex gap-2">
          <Button>Mettre à niveau</Button>
          <Button variant="outline">Changer de forfait</Button>
          <Button variant="outline">Méthode de paiement</Button>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default SubscriptionIndex;
