import { useEffect, useState } from 'react';

import { analyticsService, DailyImportCount, SalesAggregate, SeoScore } from '../services/analyticsService';

export function useAnalytics() {
  const [imports, setImports] = useState<DailyImportCount[]>([]);
  const [sales, setSales] = useState<SalesAggregate[]>([]);
  const [seoScores, setSeoScores] = useState<SeoScore[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const [i, s, seo] = await Promise.all([
        analyticsService.getDailyImportCounts(),
        analyticsService.getSalesData(),
        analyticsService.getSeoScores()
      ]);
      setImports(i);
      setSales(s);
      setSeoScores(seo);
    } catch (err) {
      console.error('Error loading analytics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  return { imports, sales, seoScores, loading, refresh };
}
