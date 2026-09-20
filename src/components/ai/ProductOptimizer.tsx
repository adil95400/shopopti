import React, { useMemo, useState } from 'react';
import { ArrowRight, Check, Loader2, RefreshCw, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAiOptimization } from '@/modules/ai/hooks/useAiOptimization';

interface ProductOptimizerProps {
  product: {
    title: string;
    description: string;
    price: number;
    category?: string;
    tags?: string[];
  };
  onOptimize: (optimizedProduct: any) => void;
}

type OptionKey = 'title' | 'description' | 'seo' | 'tags';

const ProductOptimizer: React.FC<ProductOptimizerProps> = ({ product, onOptimize }) => {
  const { optimizeProduct, loading, error } = useAiOptimization();
  const [optimizationOptions, setOptimizationOptions] = useState<Record<OptionKey, boolean>>({
    title: true,
    description: true,
    seo: true,
    tags: true
  });
  const [optimizedProduct, setOptimizedProduct] = useState<any>(null);

  const hasSelection = useMemo(
    () => Object.values(optimizationOptions).some(Boolean),
    [optimizationOptions]
  );

  const toggleOption = (key: OptionKey) => {
    setOptimizationOptions(current => ({ ...current, [key]: !current[key] }));
  };

  const handleOptimize = async (regenerate = false) => {
    const optimized = await optimizeProduct(
      {
        name: product.title,
        description: product.description,
        category: product.category,
        price: product.price
      },
      {
        ...optimizationOptions,
        pricing: false
      },
      { regenerate }
    );

    setOptimizedProduct({
      ...product,
      ...optimized,
      title: optimized.title ?? product.title,
      description: optimized.description ?? product.description,
      tags: optimized.tags ?? product.tags,
      price: product.price
    });
  };

  const handleApply = () => {
    if (optimizedProduct) onOptimize(optimizedProduct);
  };

  const options: Array<{ key: OptionKey; label: string; description: string }> = [
    { key: 'title', label: 'Optimize title', description: 'Improve clarity, SEO and conversion intent.' },
    { key: 'description', label: 'Optimize description', description: 'Rewrite the product description with AI.' },
    { key: 'seo', label: 'Optimize SEO', description: 'Generate meta title, meta description and keywords.' },
    { key: 'tags', label: 'Generate tags', description: 'Create relevant product and SEO tags.' }
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center">
        <div className="mr-3 rounded-full bg-blue-100 p-2">
          <Sparkles className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-medium">AI Product Optimizer</h3>
          <p className="text-sm text-gray-500">Real AI optimization with review before applying changes.</p>
        </div>
      </div>

      <div className="mb-6 space-y-3">
        {options.map(option => (
          <label
            key={option.key}
            className="flex cursor-pointer items-center justify-between rounded-md border border-gray-100 p-3"
          >
            <div className="pr-4">
              <div className="font-medium text-gray-700">{option.label}</div>
              <div className="text-sm text-gray-500">{option.description}</div>
            </div>
            <input
              type="checkbox"
              checked={optimizationOptions[option.key]}
              onChange={() => toggleOption(option.key)}
              className="h-4 w-4"
            />
          </label>
        ))}
      </div>

      {!optimizedProduct ? (
        <Button onClick={() => handleOptimize(false)} disabled={loading || !hasSelection} className="w-full">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Optimizing…
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Optimize with AI
            </>
          )}
        </Button>
      ) : (
        <div className="space-y-5">
          <div className="rounded-md border border-green-200 bg-green-50 p-4">
            <div className="flex items-center font-medium text-green-800">
              <Check className="mr-2 h-4 w-4" />
              AI optimization ready for review
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-md border p-4">
              <h4 className="mb-3 font-medium">Original</h4>
              <p className="text-sm font-medium">{product.title}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{product.description}</p>
            </div>

            <div className="rounded-md border p-4">
              <h4 className="mb-3 font-medium">AI version</h4>
              <p className="text-sm font-medium">{optimizedProduct.title}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
                {optimizedProduct.description}
              </p>

              {optimizationOptions.tags && optimizedProduct.tags?.length > 0 && (
                <div className="mt-3 text-sm text-gray-600">
                  <span className="font-medium text-gray-700">Tags:</span>{' '}
                  {optimizedProduct.tags.join(', ')}
                </div>
              )}

              {optimizationOptions.seo && optimizedProduct.seo && (
                <div className="mt-3 space-y-1 text-sm text-gray-600">
                  <div><span className="font-medium text-gray-700">Meta title:</span> {optimizedProduct.seo.metaTitle}</div>
                  <div><span className="font-medium text-gray-700">Meta description:</span> {optimizedProduct.seo.metaDescription}</div>
                  {optimizedProduct.seo.keywords?.length > 0 && (
                    <div><span className="font-medium text-gray-700">Keywords:</span> {optimizedProduct.seo.keywords.join(', ')}</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Button variant="outline" onClick={() => handleOptimize(true)} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Regenerate
            </Button>
            <Button onClick={handleApply}>
              Apply changes
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <p className="mt-4 text-xs text-gray-500">
        Price optimization is intentionally excluded here until ShopOpti has a real margin/repricing engine.
      </p>
    </div>
  );
};

export default ProductOptimizer;
