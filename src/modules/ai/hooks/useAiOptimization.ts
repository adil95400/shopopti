import { useState } from 'react';

import { aiService } from '@/services/aiService';

export interface OptimizationOptions {
  title?: boolean;
  description?: boolean;
  seo?: boolean;
  tags?: boolean;
  pricing?: boolean;
}

export function useAiOptimization() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optimizeProduct = async (
    product: {
      name: string;
      description: string;
      category?: string;
      price?: number;
    },
    options: OptimizationOptions = {
      title: true,
      description: true,
      seo: true,
      tags: true,
      pricing: false
    },
    requestOptions: { regenerate?: boolean } = {}
  ) => {
    setLoading(true);
    setError(null);

    try {
      const optimized: any = {};

      if (options.title || options.description || options.seo || options.tags) {
        const result = await aiService.optimizeProduct(
          {
            name: product.name,
            description: product.description,
            category: product.category || ''
          },
          { bypassCache: requestOptions.regenerate === true }
        );

        if (options.title) optimized.title = result.title;
        if (options.description) optimized.description = result.description_html;
        if (options.tags) optimized.tags = result.tags;

        if (options.seo && result.seo) {
          optimized.seo = result.seo;
        }
      }

      // Compatibility fallback only. The optimized product response normally includes SEO,
      // so this extra paid request should not run during the normal path.
      if (options.seo && !optimized.seo) {
        const seoData = await aiService.optimizeForSEO({
          title: optimized.title || product.name,
          description: optimized.description || product.description,
          category: product.category || ''
        });

        optimized.seo = {
          metaTitle: seoData.metaTitle,
          metaDescription: seoData.metaDescription,
          keywords: seoData.keywords
        };
      }

      if (options.pricing && product.price) {
        optimized.price = Math.round(product.price * 1.15 * 100) / 100;
      }

      return optimized;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to optimize product';
      setError(message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    optimizeProduct,
    loading,
    error
  };
}
