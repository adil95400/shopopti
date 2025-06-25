import React, { useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Bell, ShoppingBag, TrendingUp, Users } from 'lucide-react';

import MainNavbar from '../components/layout/MainNavbar';
import Footer from '../components/layout/Footer';
import { Badge } from '../components/ui/badge';

interface ActivityItem {
  id: number;
  title: string;
  description: string;
}

const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState({
    revenue: 0,
    orders: 0,
    visitors: 0,
    conversion: 0
  });
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    // simulate fetch
    setTimeout(() => {
      setStats({ revenue: 12450, orders: 321, visitors: 9876, conversion: 2.5 });
      setActivity([
        { id: 1, title: 'Commande #2312', description: '129€ - 2 articles' },
        { id: 2, title: 'Nouveau client', description: 'john@example.com' },
        { id: 3, title: 'Rapport généré', description: 'Performance Mai 2025' }
      ]);
    }, 500);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavbar />
      <div className="max-w-6xl mx-auto px-4 py-12 mt-16 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Tableau de bord</h1>
          <div className="flex items-center gap-2">
            <Badge variant="warning">Abonnement</Badge>
            <div role="alert" className="bg-yellow-50 border-l-4 border-yellow-400 p-2 rounded text-sm text-yellow-700">
              Votre forfait expire bientôt
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded shadow">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Chiffre d'affaires</span>
              <TrendingUp className="h-4 w-4" />
            </div>
            <p className="text-2xl font-bold mt-2">{stats.revenue.toLocaleString()}€</p>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Commandes</span>
              <ShoppingBag className="h-4 w-4" />
            </div>
            <p className="text-2xl font-bold mt-2">{stats.orders}</p>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Visiteurs</span>
              <Users className="h-4 w-4" />
            </div>
            <p className="text-2xl font-bold mt-2">{stats.visitors}</p>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Taux de conversion</span>
              {stats.conversion >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            </div>
            <p className="text-2xl font-bold mt-2">{stats.conversion}%</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold mb-4 flex items-center"><Bell className="h-4 w-4 mr-2" />Activité récente</h2>
          <ul className="space-y-2">
            {activity.map(item => (
              <li key={item.id} className="flex justify-between text-sm border-b last:border-b-0 pb-2">
                <span>{item.title}</span>
                <span className="text-gray-500">{item.description}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default DashboardPage;
