import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

import { supabase } from '../../lib/supabase';

interface ImportRow {
  created_at: string;
}

interface SalesRow {
  revenue: number;
  products?: {
    title?: string;
  };
  product_id: string;
}

const COLORS = ['#3366FF', '#00C8B3', '#FF7D00', '#FFCB00'];

const ProductAnalytics: React.FC = () => {
  const [imports, setImports] = useState<{ date: string; count: number }[]>([]);
  const [sales, setSales] = useState<{ name: string; revenue: number }[]>([]);
  const [seoRate, setSeoRate] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    fetchImports();
    fetchSales();
    fetchSeoRate();
  }, []);

  const fetchImports = async () => {
    const { data, error } = await supabase
      .from('product_imports')
      .select('created_at');

    if (error) {
      console.error('Failed to load product imports', error);
      return;
    }

    const counts: Record<string, number> = {};
    (data as ImportRow[]).forEach((row) => {
      const date = row.created_at.slice(0, 10);
      counts[date] = (counts[date] || 0) + 1;
    });

    const chartData = Object.entries(counts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    setImports(chartData);
  };

  const fetchSales = async () => {
    const { data, error } = await supabase
      .from('marketplace_analytics')
      .select('product_id, revenue, products(title)');

    if (error) {
      console.error('Failed to load sales analytics', error);
      return;
    }

    const map: Record<string, { name: string; revenue: number }> = {};
    (data as SalesRow[]).forEach((row) => {
      const name = row.products?.title || row.product_id;
      if (!map[name]) {
        map[name] = { name, revenue: 0 };
      }
      map[name].revenue += Number(row.revenue) || 0;
    });

    setSales(Object.values(map));
  };

  const fetchSeoRate = async () => {
    const { data, error } = await supabase.from('products').select('seo');

    if (error) {
      console.error('Failed to load SEO data', error);
      setSeoRate([
        { name: 'Optimized', value: 0 },
        { name: 'Not optimized', value: 0 }
      ]);
      return;
    }

    const total = data.length;
    const optimized = (data as any[]).filter((p) => p.seo).length;
    setSeoRate([
      { name: 'Optimized', value: optimized },
      { name: 'Not optimized', value: total - optimized }
    ]);
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold mb-4">Product Analytics</h1>

      <div className="card">
        <h3 className="mb-4 font-medium text-neutral-800">Daily Imports</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={imports}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="count" stroke="#3366FF" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-4 font-medium text-neutral-800">Estimated Sales</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sales}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="revenue" fill="#00C8B3" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-4 font-medium text-neutral-800">SEO Optimization Rate</h3>
        <div className="h-80 flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={seoRate} dataKey="value" cx="50%" cy="50%" outerRadius={100} label>
                {seoRate.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default ProductAnalytics;
export { ProductAnalytics };
