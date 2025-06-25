import React, { useState } from 'react';

import { Button } from '../../components/ui/button';

interface Log {
  date: string;
  module: string;
  message: string;
}

const initialLogs: Log[] = [
  { date: '2024-05-20', module: 'auth', message: 'User login successful' },
  { date: '2024-05-21', module: 'orders', message: 'Order #123 created' },
  { date: '2024-05-21', module: 'products', message: 'Product synced from Shopify' }
];

const AdminLogs: React.FC = () => {
  const [sortBy, setSortBy] = useState<'date' | 'module'>('date');

  const sorted = [...initialLogs].sort((a, b) => {
    if (sortBy === 'date') {
      return b.date.localeCompare(a.date);
    }
    return a.module.localeCompare(b.module);
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">System Logs</h1>
        <select className="border px-2 py-1 rounded-md" value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
          <option value="date">Sort by Date</option>
          <option value="module">Sort by Module</option>
        </select>
      </div>
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Module</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {sorted.map((log, idx) => (
              <tr key={idx}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.date}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.module}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{log.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminLogs;
