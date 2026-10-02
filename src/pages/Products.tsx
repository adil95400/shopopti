import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { supabase } from '@/lib/supabase';
import { aiService } from '@/services/aiService';

const Products = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [category, setCategory] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchAllProducts();
  }, []);

  const fetchAllProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*');
    if (data) setProducts(data);
  };

  const filtered = products.filter(p =>
    (!category || (p.category && p.category.toLowerCase().includes(category.toLowerCase())))
  );

  const optimizeAndImportToShopify = async (p: any) => {
    alert(`🤖 Optimisation AI en cours pour "${p.title}"...`);
    try {
      const optimized = await aiService.optimizeProduct({
        name: p.title,
        description: p.description,
        category: p.category
      });

      const { data, error } = await supabase.functions.invoke('shopify', {
        body: {
          operation: 'create_product',
          product: {
            title: optimized.title,
            descriptionHtml: optimized.description_html,
            productType: p.category,
            vendor: p.brand || p.vendor || 'ShopOpti',
            tags: optimized.tags || [],
            imageUrl: p.image_url,
            price: p.price
          }
        }
      });

      if (error) {
        throw new Error(error.message || 'Erreur Shopify');
      }

      if (!data?.success || data?.mode !== 'real' || !data?.shopifyProduct?.id) {
        throw new Error(data?.error || 'Écriture Shopify non confirmée par le serveur');
      }

      alert(
        `✅ Produit créé dans Shopify en brouillon. ID: ${data.shopifyProduct.id}`
      );
    } catch (e: any) {
      alert('❌ Échec : ' + (e?.message || 'Erreur Shopify inconnue'));
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Catalogue Produits</h1>
      <div className="flex gap-4 mb-4 flex-wrap">
        <input placeholder="Filtrer par catégorie" value={category} onChange={e => setCategory(e.target.value)} className="border p-2 rounded" />
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {filtered.map(p => (
          <div key={p.id} className="border p-4 rounded shadow">
            <img src={p.image_url} alt={p.title} className="w-full h-40 object-cover mb-2 rounded" />
            <h3 className="text-lg font-bold">{p.title}</h3>
            <p className="text-sm text-gray-600 mb-2">{p.description}</p>
            <p className="font-semibold text-blue-700 mb-1">{p.price} €</p>
            {p.metadata?.margin !== undefined && (
              <p className="text-sm text-green-600 mb-1">
                Margin: {(p.metadata.margin * 100).toFixed(0)}%
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => navigate(`/product/${p.id}`)}
                className="bg-gray-700 text-white px-3 py-1 rounded"
              >
                🔍 Voir
              </button>
              <button
                onClick={() => optimizeAndImportToShopify(p)}
                className="bg-green-600 text-white px-3 py-1 rounded"
              >
                🛍️ Importer vers Shopify
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Products;
