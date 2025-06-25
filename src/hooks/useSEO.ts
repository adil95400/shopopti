import { useState } from 'react';

import { askChatGPT } from '../lib/openai';

export interface SEOResult {
  score: number;
  title: string;
  description: string;
  recommendations: string[];
  [key: string]: any;
}

export function useSEO() {
  const [result, setResult] = useState<SEOResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async (prompt: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await askChatGPT(prompt);
      const data = JSON.parse(response);
      setResult(data);
      return data;
    } catch (err: any) {
      console.error('Error getting SEO data:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { result, loading, error, analyze };
}
