import React, { useEffect, useState } from 'react';
import {
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

interface ProductImport {
  id: string;
  product_id: string;
  created_at: string;
  metadata: any;
}

const PIE_COLORS = ['#3B82F6', '#EF4444'];

const ProductsAnalytics: React.FC = () => {
  const [dailyImports, setDailyImports] = useState<{ date: string; count: number }[]>([]);
  const [salesPerProduct, setSalesPerProduct] = useState<{ product: string; sales: number }[]>([]);
  const [seoRate, setSeoRate] = useState<{ optimized: number; notOptimized: number }>({ optimized: 0, notOptimized: 0 });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data, error } = await supabase
      .from('product_imports')
      .select('id, product_id, metadata, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching product imports', error);
      return;
    }

    const imports = (data || []) as ProductImport[];

    const dailyMap: Record<string, number> = {};
    const salesMap: Record<string, number> = {};
    let optimized = 0;

    imports.forEach((imp) => {
      const day = imp.created_at.split('T')[0];
      dailyMap[day] = (dailyMap[day] || 0) + 1;

      salesMap[imp.product_id] = (salesMap[imp.product_id] || 0) + 1;

      if (imp.metadata && (imp.metadata.seo || imp.metadata.seoOptimized)) {
        optimized += 1;
      }
    });

    setDailyImports(Object.keys(dailyMap).map((d) => ({ date: d, count: dailyMap[d] })));
    setSalesPerProduct(
      Object.keys(salesMap).map((id) => ({ product: id.substring(0, 8), sales: salesMap[id] * 10 }))
    );
    setSeoRate({ optimized, notOptimized: imports.length - optimized });
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold mb-4">Product Analytics</h1>

      <div className="card">
        <h3 className="mb-4 font-medium text-neutral-800">Daily Product Imports</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyImports}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7280' }} />
              <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" name="Imports" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-4 font-medium text-neutral-800">Estimated Sales per Product</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={salesPerProduct}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="product" tick={{ fontSize: 12, fill: '#6B7280' }} />
              <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="sales" name="Sales" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-4 font-medium text-neutral-800">SEO Optimization Rate</h3>
        <div className="h-80 flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[{ name: 'Optimized', value: seoRate.optimized }, { name: 'Not Optimized', value: seoRate.notOptimized }]}
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
                dataKey="value"
              >
                <Cell fill={PIE_COLORS[0]} />
                <Cell fill={PIE_COLORS[1]} />
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default ProductsAnalytics;
