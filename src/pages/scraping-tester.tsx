'use client';

import React, { useState } from 'react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { scrapingService } from '@/services/scrapingService';

export default function ScrapingTesterPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScrape = async () => {
    setLoading(true);
    setError(null);
    setProduct(null);
    try {
      const result = await scrapingService.scrapeByUrl(url);
      setProduct(result);
    } catch (err: any) {
      setError(err.message || 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">🔍 Testeur de Scraping de Produits</h1>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          type="text"
          placeholder="Entrez une URL Shopify, AliExpress, etc."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button onClick={handleScrape} disabled={loading || !url}>
          {loading ? 'Chargement...' : 'Scraper'}
        </Button>
      </div>

      {error && <div className="text-red-600 font-semibold">❌ {error}</div>}

      {product && (
        <Card>
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold">✅ Résultat</h2>
            <div><strong>Titre :</strong> {product.title}</div>
            <div><strong>Prix :</strong> {product.price}</div>
            <div><strong>Description :</strong></div>
            <div
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
            <div className="flex gap-2 overflow-x-auto">
              {product.images?.map((src: string, i: number) => (
                <img
                  key={i}
                  src={src}
                  alt={`image-${i}`}
                  className="h-24 rounded-md border"
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
