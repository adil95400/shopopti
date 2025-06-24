import { useState, useEffect } from 'react';

import { analyticsService, DailyImportCount, SalesData, SeoScore } from '../services/analyticsService';

export function useDailyImportCounts() {
  const [data, setData] = useState<DailyImportCount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const counts = await analyticsService.getDailyImportCounts();
      setData(counts);
    } catch (err: any) {
      console.error('Error fetching import counts:', err);
      setError(err.message || 'Failed to load import analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, refetch: fetchData };
}

export function useSalesAnalytics() {
  const [data, setData] = useState<SalesData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const sales = await analyticsService.getSalesData();
      setData(sales);
    } catch (err: any) {
      console.error('Error fetching sales analytics:', err);
      setError(err.message || 'Failed to load sales analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, refetch: fetchData };
}

export function useSeoScores() {
  const [data, setData] = useState<SeoScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const scores = await analyticsService.getSeoScores();
      setData(scores);
    } catch (err: any) {
      console.error('Error fetching SEO scores:', err);
      setError(err.message || 'Failed to load SEO scores');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, refetch: fetchData };
}
