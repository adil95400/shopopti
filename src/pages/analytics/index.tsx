import React, { useState } from 'react';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';

import MainNavbar from '../../components/layout/MainNavbar';
import Footer from '../../components/layout/Footer';

const data = [
  { name: 'Jan', sales: 400, conversion: 2.1, cart: 45 },
  { name: 'Feb', sales: 460, conversion: 2.3, cart: 48 },
  { name: 'Mar', sales: 510, conversion: 2.5, cart: 50 }
];

const AnalyticsIndex: React.FC = () => {
  const [period, setPeriod] = useState('this');
  const [channel, setChannel] = useState('all');

  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavbar />
      <div className="max-w-5xl mx-auto px-4 py-12 mt-16 space-y-6">
        <h1 className="text-2xl font-bold">Analytics</h1>

        <div className="flex flex-wrap gap-4">
          <select className="border px-3 py-2 rounded" value={period} onChange={e => setPeriod(e.target.value)}>
            <option value="this">Cette période</option>
            <option value="prev">Période précédente</option>
          </select>
          <select className="border px-3 py-2 rounded" value={channel} onChange={e => setChannel(e.target.value)}>
            <option value="all">Tous canaux</option>
            <option value="shopify">Shopify</option>
            <option value="amazon">Amazon</option>
          </select>
        </div>

        <div className="bg-white p-4 rounded shadow overflow-x-auto">
          <LineChart width={600} height={300} data={data} className="mx-auto">
            <Line type="monotone" dataKey="sales" stroke="#3b82f6" />
            <CartesianGrid stroke="#ccc" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
          </LineChart>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AnalyticsIndex;
