import React from 'react';
import { Link2, Unlink } from 'lucide-react';

import MainNavbar from '../../components/layout/MainNavbar';
import Footer from '../../components/layout/Footer';
import { Button } from '../../components/ui/button';

interface Supplier {
  id: string;
  name: string;
  score: number;
  notes: string;
  connected: boolean;
}

const suppliers: Supplier[] = [
  { id: '1', name: 'AliExpress', score: 80, notes: 'Fiable', connected: true },
  { id: '2', name: 'BigBuy', score: 70, notes: 'Bon service', connected: false }
];

const SuppliersIndex: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavbar />
      <div className="max-w-4xl mx-auto px-4 py-12 mt-16 space-y-6">
        <h1 className="text-2xl font-bold">Fournisseurs connectés</h1>

        <div className="space-y-4">
          {suppliers.map(s => (
            <div key={s.id} className="bg-white p-4 rounded shadow flex items-center justify-between">
              <div>
                <p className="font-semibold">{s.name}</p>
                <p className="text-sm text-gray-500">Score {s.score} - {s.notes}</p>
              </div>
              {s.connected ? (
                <Button variant="outline"><Unlink className="h-4 w-4 mr-2" />Délier</Button>
              ) : (
                <Button variant="outline"><Link2 className="h-4 w-4 mr-2" />Lier</Button>
              )}
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default SuppliersIndex;
