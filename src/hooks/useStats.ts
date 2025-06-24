import { useEffect, useState } from 'react';

interface SimpleStat {
  value: number;
  change: number;
}

interface DailyPoint {
  date: string;
  value: number;
}

interface Stats {
  revenue: SimpleStat;
  orders: SimpleStat;
  visitors: SimpleStat;
  conversion: SimpleStat;
  revenueData: DailyPoint[];
  ordersData: DailyPoint[];
}

export function useStats() {
  const [stats, setStats] = useState<Stats>({
    revenue: { value: 0, change: 0 },
    orders: { value: 0, change: 0 },
    visitors: { value: 0, change: 0 },
    conversion: { value: 0, change: 0 },
    revenueData: [],
    ordersData: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      await new Promise((r) => setTimeout(r, 500));

      const dates: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
      }

      const revenueData = dates.map((date) => ({
        date,
        value: Math.floor(Math.random() * 1000) + 500
      }));

      const ordersData = dates.map((date) => ({
        date,
        value: Math.floor(Math.random() * 40) + 10
      }));

      const revenueTotal = revenueData.reduce((acc, cur) => acc + cur.value, 0);
      const ordersTotal = ordersData.reduce((acc, cur) => acc + cur.value, 0);
      const visitorsTotal = Math.floor(Math.random() * 4000) + 1000;
      const conversionRate = parseFloat(
        ((ordersTotal / visitorsTotal) * 100).toFixed(1)
      );

      setStats({
        revenue: {
          value: revenueTotal,
          change: parseFloat((Math.random() * 30 - 10).toFixed(1))
        },
        orders: {
          value: ordersTotal,
          change: parseFloat((Math.random() * 30 - 10).toFixed(1))
        },
        visitors: {
          value: visitorsTotal,
          change: parseFloat((Math.random() * 30 - 10).toFixed(1))
        },
        conversion: {
          value: conversionRate,
          change: parseFloat((Math.random() * 10 - 5).toFixed(1))
        },
        revenueData,
        ordersData
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  return { stats, loading };
}
