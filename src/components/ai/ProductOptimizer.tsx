import React, { useState } from 'react';
import { Sparkles, Check, Loader2, RefreshCw, ArrowRight } from 'lucide-react';

import { aiService } from '../../services/aiService';
import { Button } from '../ui/button';

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

const ProductOptimizer: React.FC<ProductOptimizerProps> = ({ product, onOptimize }) => {
  const [loading, setLoading] = useState(false);
  const [optimizationOptions, setOptimizationOptions] = useState({
    title: true,
    description: true,
    seo: true,
    tags: true,
    pricing: false
  });
  const [optimizedProduct, setOptimizedProduct] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOptimize = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await aiService.optimizeProduct({
        name: product.title,
        description: product.description,
        category: product.category || ''
      });

      const optimized: any = {
        title: optimizationOptions.title ? result.title : product.title,
        description: optimizationOptions.description
          ? result.description_html
          : product.description,
        price: optimizationOptions.pricing
          ? Math.round(product.price * 1.15 * 100) / 100
          : product.price,
        tags: optimizationOptions.tags ? result.tags : product.tags,
        seo: null
      };

      if (optimizationOptions.seo) {
        const seoData = await aiService.optimizeForSEO({
          title: optimized.title,
          description: optimized.description,
          category: product.category || ''
        });

        optimized.seo = {
          metaTitle: seoData.metaTitle,
          metaDescription: seoData.metaDescription,
          keywords: seoData.keywords
        };
      }

      setOptimizedProduct(optimized);
    } catch (err: any) {
      console.error('Error optimizing product:', err);
      setError(err.message || 'Failed to optimize product');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (optimizedProduct) {
      onOptimize(optimizedProduct);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center mb-4">
        <div className="p-2 bg-blue-100 rounded-full mr-3">
          <Sparkles className="h-5 w-5 text-blue-600" />
        </div>
        <h3 className="text-lg font-medium">AI Product Optimizer</h3>
      </div>
      
      <div className="mb-6">
        <p className="text-gray-600">
          Use AI to optimize your product listing for better visibility and conversion rates.
        </p>
      </div>
      
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <label className="font-medium text-gray-700">Optimize Title</label>
            <p className="text-sm text-gray-500">Improve product title for better SEO</p>
          </div>
          <div className="relative inline-block w-12 align-middle select-none">
            <input
              type="checkbox"
              id="toggle-title"
              checked={optimizationOptions.title}
              onChange={() => setOptimizationOptions({
                ...optimizationOptions,
                title: !optimizationOptions.title
              })}
              className="sr-only"
            />
            <label
              htmlFor="toggle-title"
              className={`block overflow-hidden h-6 rounded-full cursor-pointer ${
                optimizationOptions.title ? 'bg-blue-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`block h-6 w-6 rounded-full bg-white transform transition-transform ${
                  optimizationOptions.title ? 'translate-x-6' : 'translate-x-0'
                }`}
              ></span>
            </label>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <label className="font-medium text-gray-700">Enhance Description</label>
            <p className="text-sm text-gray-500">Add compelling details and features</p>
          </div>
          <div className="relative inline-block w-12 align-middle select-none">
            <input
              type="checkbox"
              id="toggle-description"
              checked={optimizationOptions.description}
              onChange={() => setOptimizationOptions({
                ...optimizationOptions,
                description: !optimizationOptions.description
              })}
              className="sr-only"
            />
            <label
              htmlFor="toggle-description"
              className={`block overflow-hidden h-6 rounded-full cursor-pointer ${
                optimizationOptions.description ? 'bg-blue-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`block h-6 w-6 rounded-full bg-white transform transition-transform ${
                  optimizationOptions.description ? 'translate-x-6' : 'translate-x-0'
                }`}
              ></span>
            </label>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <label className="font-medium text-gray-700">Generate SEO Metadata</label>
            <p className="text-sm text-gray-500">Create SEO-friendly meta tags</p>
          </div>
          <div className="relative inline-block w-12 align-middle select-none">
            <input
              type="checkbox"
              id="toggle-seo"
              checked={optimizationOptions.seo}
              onChange={() => setOptimizationOptions({
                ...optimizationOptions,
                seo: !optimizationOptions.seo
              })}
              className="sr-only"
            />
            <label
              htmlFor="toggle-seo"
              className={`block overflow-hidden h-6 rounded-full cursor-pointer ${
                optimizationOptions.seo ? 'bg-blue-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`block h-6 w-6 rounded-full bg-white transform transition-transform ${
                  optimizationOptions.seo ? 'translate-x-6' : 'translate-x-0'
                }`}
              ></span>
            </label>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <label className="font-medium text-gray-700">Suggest Tags</label>
            <p className="text-sm text-gray-500">Add relevant tags for better discoverability</p>
          </div>
          <div className="relative inline-block w-12 align-middle select-none">
            <input
              type="checkbox"
              id="toggle-tags"
              checked={optimizationOptions.tags}
              onChange={() => setOptimizationOptions({
                ...optimizationOptions,
                tags: !optimizationOptions.tags
              })}
              className="sr-only"
            />
            <label
              htmlFor="toggle-tags"
              className={`block overflow-hidden h-6 rounded-full cursor-pointer ${
                optimizationOptions.tags ? 'bg-blue-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`block h-6 w-6 rounded-full bg-white transform transition-transform ${
                  optimizationOptions.tags ? 'translate-x-6' : 'translate-x-0'
                }`}
              ></span>
            </label>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <label className="font-medium text-gray-700">Optimize Pricing</label>
            <p className="text-sm text-gray-500">Suggest optimal price based on market data</p>
          </div>
          <div className="relative inline-block w-12 align-middle select-none">
            <input
              type="checkbox"
              id="toggle-pricing"
              checked={optimizationOptions.pricing}
              onChange={() => setOptimizationOptions({
                ...optimizationOptions,
                pricing: !optimizationOptions.pricing
              })}
              className="sr-only"
            />
            <label
              htmlFor="toggle-pricing"
              className={`block overflow-hidden h-6 rounded-full cursor-pointer ${
                optimizationOptions.pricing ? 'bg-blue-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`block h-6 w-6 rounded-full bg-white transform transition-transform ${
                  optimizationOptions.pricing ? 'translate-x-6' : 'translate-x-0'
                }`}
              ></span>
            </label>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      {!optimizedProduct ? (
        <Button
          onClick={handleOptimize}
          disabled={loading || (!optimizationOptions.title && !optimizationOptions.description && !optimizationOptions.seo && !optimizationOptions.tags && !optimizationOptions.pricing)}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Optimizing...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Optimize with AI
            </>
          )}
        </Button>
      ) : (
        <div className="space-y-4">
          <div className="bg-green-50 p-4 rounded-md">
            <div className="flex items-center mb-2">
              <Check className="h-5 w-5 text-green-600 mr-2" />
              <h4 className="font-medium text-green-800">Optimization Complete</h4>
            </div>
            <p className="text-sm text-green-700">
              Your product has been optimized for better performance.
            </p>
          </div>

          <div className="space-y-2">
            {optimizationOptions.title && (
              <div>
                <h5 className="font-medium">Title</h5>
                <p className="text-sm">{optimizedProduct.title}</p>
              </div>
            )}
            {optimizationOptions.description && (
              <div>
                <h5 className="font-medium">Description</h5>
                <div
                  className="text-sm prose"
                  dangerouslySetInnerHTML={{ __html: optimizedProduct.description }}
                />
              </div>
            )}
            {optimizationOptions.tags && optimizedProduct.tags && (
              <div>
                <h5 className="font-medium">Tags</h5>
                <p className="text-sm">{optimizedProduct.tags.join(', ')}</p>
              </div>
            )}
            {optimizationOptions.pricing && optimizedProduct.price && (
              <div>
                <h5 className="font-medium">Price</h5>
                <p className="text-sm">{optimizedProduct.price} €</p>
              </div>
            )}
            {optimizationOptions.seo && optimizedProduct.seo && (
              <div>
                <h5 className="font-medium">SEO</h5>
                <p className="text-sm">{optimizedProduct.seo.metaTitle}</p>
                <p className="text-sm">{optimizedProduct.seo.metaDescription}</p>
                <p className="text-sm">
                  Keywords: {optimizedProduct.seo.keywords.join(', ')}
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button onClick={handleApply} className="w-full">
              <Check className="h-4 w-4 mr-2" />
              Apply Changes
            </Button>
            <Button
              variant="outline"
              onClick={() => setOptimizedProduct(null)}
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Start Over
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductOptimizer;

