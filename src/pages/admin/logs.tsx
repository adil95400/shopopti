import React, { useState } from 'react';

import MainNavbar from '../../components/layout/MainNavbar';
import Footer from '../../components/layout/Footer';
import { Input } from '../../components/ui/input';

interface Log {
  id: number;
  module: string;
  date: string;
  message: string;
}

const logs: Log[] = [
  { id: 1, module: 'orders', date: '2024-05-20', message: 'Nouvelle commande' },
  { id: 2, module: 'auth', date: '2024-05-19', message: 'Connexion admin' }
];

const AdminLogs: React.FC = () => {
  const [module, setModule] = useState('');
  const [date, setDate] = useState('');
  const [search, setSearch] = useState('');

  const filtered = logs.filter(l =>
    (module ? l.module === module : true) &&
    (date ? l.date === date : true) &&
    (search ? l.message.toLowerCase().includes(search.toLowerCase()) : true)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavbar />
      <div className="max-w-4xl mx-auto px-4 py-12 mt-16 space-y-6">
        <h1 className="text-2xl font-bold">Logs système</h1>

        <div className="flex flex-wrap gap-4">
          <select className="border px-3 py-2 rounded" value={module} onChange={e => setModule(e.target.value)}>
            <option value="">Tous modules</option>
            <option value="orders">Commandes</option>
            <option value="auth">Authentification</option>
          </select>
          <input type="date" className="border px-3 py-2 rounded" value={date} onChange={e => setDate(e.target.value)} />
          <Input placeholder="Recherche" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="bg-white rounded shadow">
          <ul className="divide-y divide-gray-200 text-sm">
            {filtered.map(log => (
              <li key={log.id} className="p-4 flex justify-between">
                <span>{log.date} - {log.module}</span>
                <span>{log.message}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AdminLogs;
