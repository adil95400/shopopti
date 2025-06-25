import { useEffect, useState } from 'react';

export interface DailyStat {
  date: string;
  value: number;
}

export interface Stats {
  revenue: { value: number; change: number; daily: DailyStat[] };
  orders: { value: number; change: number; daily: DailyStat[] };
  visitors: { value: number; change: number };
  conversion: { value: number; change: number };
}

export function useStats() {
  const [stats, setStats] = useState<Stats>({
    revenue: { value: 0, change: 0, daily: [] },
    orders: { value: 0, change: 0, daily: [] },
    visitors: { value: 0, change: 0 },
    conversion: { value: 0, change: 0 },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const days = Array.from({ length: 7 }, (_, i) => `Day ${i + 1}`);
        const revenueData = days.map((d) => ({
          date: d,
          value: Math.floor(Math.random() * 300) + 100,
        }));
        const ordersData = days.map((d) => ({
          date: d,
          value: Math.floor(Math.random() * 20) + 5,
        }));

        setStats({
          revenue: {
            value: revenueData.reduce((sum, cur) => sum + cur.value, 0),
            change: 25,
            daily: revenueData,
          },
          orders: {
            value: ordersData.reduce((sum, cur) => sum + cur.value, 0),
            change: 12,
            daily: ordersData,
          },
          visitors: { value: 4521, change: 15.3 },
          conversion: { value: 3.2, change: -0.5 },
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, loading };
}
