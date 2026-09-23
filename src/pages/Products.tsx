import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { supabase } from '@/lib/supabase';
import { shopifyService } from '@/services/shopifyService';

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

  const publishToShopify = async (p: any) => {
    try {
      const result = await shopifyService.publishProduct(p.id);
      if (!result.confirmed || !result.published) {
        throw new Error('Shopify did not confirm the publication.');
      }
      alert(`✅ Produit "${p.title}" publié et confirmé sur Shopify.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Publication Shopify non confirmée.';
      alert(`❌ Échec : ${message}`);
    }
  };

  const filtered = products.filter(p =>
    (!category || (p.category && p.category.toLowerCase().includes(category.toLowerCase())))
  );

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
                onClick={() => publishToShopify(p)}
                className="bg-green-600 text-white px-3 py-1 rounded"
              >
                🛍️ Publier vers Shopify
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Products;
