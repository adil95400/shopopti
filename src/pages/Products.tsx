import React, { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { supabase } from '@/lib/supabase';
import { aiService } from '@/services/aiService';
import { mapShopOptiProductsToCdiscountStockPrice } from '@/services/marketplaces/cdiscountProductMapper';
import { buildCdiscountStockPriceWorkbook } from '@/services/marketplaces/cdiscountStockPriceWorkbook';

const Products = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [category, setCategory] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const cdiscountTemplateInputRef = useRef<HTMLInputElement>(null);
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

  const selectedProducts = useMemo(
    () => products.filter((product) => selectedProductIds.has(String(product.id))),
    [products, selectedProductIds],
  );

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const requestCdiscountExport = () => {
    if (selectedProducts.length === 0) {
      alert('Sélectionnez au moins un produit avant de préparer le fichier Cdiscount.');
      return;
    }

    cdiscountTemplateInputRef.current?.click();
  };

  const exportSelectedProductsToCdiscount = async (event: ChangeEvent<HTMLInputElement>) => {
    const template = event.target.files?.[0];
    event.target.value = '';

    if (!template) return;

    const mapped = mapShopOptiProductsToCdiscountStockPrice(selectedProducts);
    if (mapped.errors.length > 0) {
      const details = mapped.errors
        .slice(0, 5)
        .map((error) => `${error.title} : ${error.message}`)
        .join('\n');
      const suffix = mapped.errors.length > 5
        ? `\n… et ${mapped.errors.length - 5} autre(s) erreur(s).`
        : '';

      alert(
        `Export Cdiscount bloqué : ${mapped.errors.length} produit(s) incomplet(s).\n\n${details}${suffix}`,
      );
      return;
    }

    try {
      const templateBytes = await template.arrayBuffer();
      const result = buildCdiscountStockPriceWorkbook(templateBytes, mapped.offers);

      if (!result.ok) {
        const details = result.errors
          .slice(0, 5)
          .map((row) => `Ligne ${row.row} (${row.reference}) : ${row.errors.map((error) => error.message).join(', ')}`)
          .join('\n');

        alert(
          `Export Cdiscount bloqué : le fichier contient des valeurs incompatibles.\n\n${details}`,
        );
        return;
      }

      const blob = new Blob([result.workbook], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);

      link.href = url;
      link.download = `cdiscount-prix-stock-${date}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      alert(
        `Fichier Cdiscount préparé pour ${result.exportedRows} offre(s). Aucun envoi automatique n'a été effectué.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      alert(
        `Export Cdiscount impossible : ${message}. Vérifiez que vous avez choisi le modèle prix/stock officiel.`,
      );
    }
  };

  const optimizeAndImportToShopify = async (p: any) => {
    alert(`🤖 Optimisation AI en cours pour "${p.title}"...`);
    try {
      const optimized = await aiService.optimizeProduct({
        name: p.title,
        description: p.description,
        category: p.category
      });

      const response = await fetch(`https://${import.meta.env.VITE_SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/products.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": import.meta.env.VITE_SHOPIFY_ADMIN_TOKEN
        },
        body: JSON.stringify({
          product: {
            title: optimized.title,
            body_html: optimized.description_html,
            tags: optimized.tags?.join(", "),
            images: [{ src: p.image_url }]
          }
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.errors || "Erreur Shopify");
      }

      alert(`✅ Produit "${optimized.title}" importé dans Shopify avec succès !`);
    } catch (e: any) {
      alert("❌ Échec : " + e.message);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Catalogue Produits</h1>
      <div className="flex gap-4 mb-4 flex-wrap items-center">
        <input
          placeholder="Filtrer par catégorie"
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="border p-2 rounded"
        />
        <button
          type="button"
          onClick={requestCdiscountExport}
          disabled={selectedProducts.length === 0}
          className="bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded"
        >
          Exporter vers Cdiscount ({selectedProducts.length})
        </button>
        <input
          ref={cdiscountTemplateInputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={exportSelectedProductsToCdiscount}
          className="hidden"
          aria-label="Modèle officiel Cdiscount prix et stock"
        />
        <p className="text-xs text-gray-600">
          Génération locale du fichier prix/stock uniquement : aucun envoi automatique à Cdiscount.
        </p>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {filtered.map(p => {
          const productId = String(p.id);
          const selected = selectedProductIds.has(productId);

          return (
            <div key={p.id} className="border p-4 rounded shadow">
              <label className="flex items-center gap-2 mb-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleProductSelection(productId)}
                />
                Sélectionner pour Cdiscount
              </label>
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
          );
        })}
      </div>
    </div>
  );
};

export default Products;
