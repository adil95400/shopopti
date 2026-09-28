import React, { useEffect, useState } from 'react';
import { Search, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase';

interface MarketplaceImporterProps {
  marketplace?: string;
}

interface ExtensionVariant {
  id?: string;
  title: string;
  price: number;
  sku?: string;
  options: Record<string, string>;
}

interface ExtensionProduct {
  schemaVersion: number;
  source: 'aliexpress';
  sourceUrl: string;
  extractedAt: string;
  productId?: string | null;
  title: string;
  description?: string;
  price?: number | null;
  currency?: string | null;
  images?: string[];
  availability?: string | null;
  seller?: string | null;
  variants?: ExtensionVariant[];
  extraction?: {
    method?: string;
    verifiedFields?: Record<string, boolean>;
  };
}

interface ExtensionHandoffMessage {
  source: 'shopopti-extension';
  type: 'SHOPOPTI_ALIEXPRESS_HANDOFF';
  handoffId: string;
  product: ExtensionProduct;
}

const isExtensionHandoff = (value: unknown): value is ExtensionHandoffMessage => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ExtensionHandoffMessage>;

  return candidate.source === 'shopopti-extension'
    && candidate.type === 'SHOPOPTI_ALIEXPRESS_HANDOFF'
    && typeof candidate.handoffId === 'string'
    && Boolean(candidate.product)
    && candidate.product?.source === 'aliexpress'
    && typeof candidate.product?.title === 'string'
    && typeof candidate.product?.sourceUrl === 'string';
};

const MarketplaceImporter: React.FC<MarketplaceImporterProps> = ({ marketplace }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [extensionProduct, setExtensionProduct] = useState<ExtensionProduct | null>(null);
  const [enqueueing, setEnqueueing] = useState(false);
  const [queuedJob, setQueuedJob] = useState<{ job_id: string; created: boolean; stage: string } | null>(null);

  useEffect(() => {
    if (marketplace !== 'aliexpress') return undefined;

    const params = new URLSearchParams(window.location.search);
    const expectedHandoffId = params.get('handoff');

    if (!expectedHandoffId || params.get('mode') !== 'extension') return undefined;

    const handleMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      if (!isExtensionHandoff(event.data)) return;
      if (event.data.handoffId !== expectedHandoffId) return;

      setExtensionProduct(event.data.product);
      setQueuedJob(null);

      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('handoff');
      window.history.replaceState({}, '', cleanUrl);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [marketplace]);

  const verifiedFields = Object.entries(extensionProduct?.extraction?.verifiedFields || {})
    .filter(([, verified]) => verified)
    .map(([field]) => field);

  const enqueueExtensionProduct = async () => {
    if (!extensionProduct || marketplace !== 'aliexpress') return;

    try {
      setEnqueueing(true);

      const identity = extensionProduct.productId || extensionProduct.sourceUrl;
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(`aliexpress-extension:${identity}`)
      );
      const hash = Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');

      const extractedSnapshot = {
        contract: 'shopopti_extracted_product_v1',
        extraction_method: 'extension_verified_v1',
        extracted_at: extensionProduct.extractedAt,
        source: {
          id: 'aliexpress',
          product_id: extensionProduct.productId || null,
          requested_url: extensionProduct.sourceUrl,
          final_url: extensionProduct.sourceUrl,
        },
        product: {
          title: extensionProduct.title,
          description: extensionProduct.description || '',
          price: typeof extensionProduct.price === 'number' ? extensionProduct.price : null,
          currency: extensionProduct.currency || '',
          brand: null,
          sku: null,
          gtin: null,
          images: (extensionProduct.images || []).slice(0, 30),
          availability: extensionProduct.availability || null,
          seller: extensionProduct.seller || null,
          variants: (extensionProduct.variants || []).slice(0, 200),
          verification: extensionProduct.extraction?.verifiedFields || {},
        },
      };

      const { data, error } = await supabase.rpc('enqueue_import_pipeline_snapshot_job', {
        p_idempotency_key: `aliexpress-extension:${hash}`,
        p_source_id: 'aliexpress',
        p_source_product_id: extensionProduct.productId || null,
        p_source_url: extensionProduct.sourceUrl,
        p_destination_id: 'draft',
        p_max_attempts: 5,
        p_extracted_product: extractedSnapshot,
      });

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;
      if (!result?.job_id || !result?.stage) {
        throw new Error('Le pipeline canonique n’a pas retourné de job valide.');
      }

      setQueuedJob({
        job_id: result.job_id,
        created: Boolean(result.created),
        stage: result.stage,
      });

      toast.success(
        result.created
          ? 'Import AliExpress ajouté au pipeline.'
          : 'Cet import existe déjà dans le pipeline.'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Échec de création du job d’import.';
      toast.error(message);
    } finally {
      setEnqueueing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <div className="rounded-full bg-primary-400 bg-opacity-10 p-2">
          <ShoppingBag className="h-4 w-4 text-primary-400" />
        </div>
        <h3 className="text-lg font-medium text-white">
          Rechercher sur {marketplace === 'aliexpress' ? 'AliExpress' : 'Amazon'}
        </h3>
      </div>

      {marketplace === 'aliexpress' && extensionProduct && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-slate-900">
          <div className="flex gap-4">
            {extensionProduct.images?.[0] && (
              <img
                src={extensionProduct.images[0]}
                alt={extensionProduct.title}
                className="h-24 w-24 rounded-md object-contain bg-white"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                Produit reçu depuis l’extension ShopOpti
              </p>
              <h4 className="mt-1 font-semibold">{extensionProduct.title}</h4>
              <p className="mt-1 text-sm text-slate-600">
                {typeof extensionProduct.price === 'number'
                  ? `${extensionProduct.price} ${extensionProduct.currency || ''}`.trim()
                  : 'Prix non vérifié'}
                {extensionProduct.seller ? ` · ${extensionProduct.seller}` : ''}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {extensionProduct.variants?.length || 0} variante(s) structurée(s)
                {verifiedFields.length ? ` · vérifié : ${verifiedFields.join(', ')}` : ''}
              </p>
              <p className="mt-2 text-xs text-amber-700">
                Vérification humaine requise avant publication. Le transfert ne publie rien automatiquement.
              </p>
              <button
                type="button"
                className="mt-3 rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={enqueueing || Boolean(queuedJob)}
                onClick={() => void enqueueExtensionProduct()}
              >
                {enqueueing
                  ? 'Ajout au pipeline…'
                  : queuedJob
                    ? `Job ${queuedJob.stage}`
                    : 'Ajouter au pipeline d’import'}
              </button>
              {queuedJob && (
                <p className="mt-2 break-all text-xs text-slate-500">
                  Job canonique : {queuedJob.job_id}
                  {queuedJob.created ? ' · créé' : ' · déjà existant'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="relative">
        <input
          type="text"
          placeholder="Rechercher des produits..."
          className="w-full bg-secondary-400 rounded-lg pl-10 pr-4 py-2 text-white placeholder-accent-200"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Search className="absolute left-3 top-2.5 h-5 w-5 text-accent-200" />
      </div>
      <button
        className="px-4 py-2 bg-primary-400 text-white rounded-lg hover:bg-primary-500 transition-colors"
        onClick={() => {
          // Search remains intentionally separate from extension handoff.
          console.log(searchTerm);
        }}
      >
        Rechercher
      </button>
    </div>
  );
};

export default MarketplaceImporter;
