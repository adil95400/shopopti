import { useState } from 'react';

import { auditSEOWithAI } from '../lib/seoAI';

export interface SEOResult {
  score: number;
  title: string;
  meta_description: string;
  rich_snippet: string;
  recommendations: string[];
  [key: string]: any;
}

export function useSEO() {
  const [data, setData] = useState<SEOResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async (params: { title: string; description: string; tags: string }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await auditSEOWithAI(params);
      setData(result);
    } catch (err: any) {
      console.error('Error getting SEO analysis:', err);
      setError(err.message || 'Failed to get SEO analysis');
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, analyze, setData };
}
