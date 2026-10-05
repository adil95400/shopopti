import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Chrome,
  ExternalLink,
  Image,
  PackageSearch,
  ShieldCheck,
  Store,
  XCircle
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useShop } from '@/contexts/ShopContext';

type CapabilityStatus = 'available' | 'partial' | 'planned';

const capabilities: Array<{
  label: string;
  description: string;
  status: CapabilityStatus;
}> = [
  {
    label: 'Détection des fiches produit',
    description: 'AliExpress et Amazon sont pris en charge par le flux extension actuellement validé.',
    status: 'available'
  },
  {
    label: 'Capture titre, prix, image et URL',
    description: 'Le flux validé extrait localement titre, description, prix, devise, images, vendeur et variantes structurées lorsqu’elles sont vérifiables.',
    status: 'available'
  },
  {
    label: 'Passage vers ShopOpti',
    description: 'L’extension transfère un snapshot vérifié vers ShopOpti puis l’ajoute au pipeline canonique d’import après validation humaine.',
    status: 'available'
  },
  {
    label: 'Variantes et données enrichies',
    description: 'Les variantes structurées, images et métadonnées ne sont conservées que lorsqu’elles sont réellement détectées et vérifiées.',
    status: 'partial'
  },
  {
    label: 'Pipeline canonique persistant',
    description: 'Les handoffs AliExpress et Amazon peuvent créer un job canonique idempotent dans ShopOpti. La publication boutique reste séparée.',
    status: 'partial'
  },
  {
    label: 'Import en masse et multi-boutiques',
    description: 'Ces fonctions ne sont pas encore validées dans le flux extension actuel.',
    status: 'planned'
  }
];

const statusMeta: Record<CapabilityStatus, { label: string; className: string }> = {
  available: {
    label: 'Disponible',
    className: 'bg-green-100 text-green-800'
  },
  partial: {
    label: 'Partiel',
    className: 'bg-amber-100 text-amber-800'
  },
  planned: {
    label: 'À venir',
    className: 'bg-gray-100 text-gray-700'
  }
};

const ExtensionHub: React.FC = () => {
  const { isConnected, store } = useShop();

  return (
    <div className="space-y-6 p-4 md:p-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2">
              <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                <Chrome className="h-6 w-6" />
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                Beta
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Extension Chrome ShopOpti</h1>
            <p className="mt-3 text-gray-600">
              Capturez une fiche AliExpress ou Amazon compatible dans Chrome, vérifiez les données détectées, puis
              transférez-les vers le pipeline canonique ShopOpti. Les fonctions non validées restent
              volontairement désactivées ou signalées comme partielles.
            </p>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 lg:w-80">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-blue-700" />
              <div>
                <p className="font-semibold text-blue-900">Sécurité</p>
                <p className="mt-1 text-sm text-blue-800">
                  L’extension ne demande pas votre token Shopify dans son popup. Les opérations sensibles
                  restent dans ShopOpti.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <PackageSearch className="h-6 w-6 text-blue-600" />
          <p className="mt-3 text-sm text-gray-500">Source validée</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">AliExpress + Amazon</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <Image className="h-6 w-6 text-blue-600" />
          <p className="mt-3 text-sm text-gray-500">Capture vérifiée</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">Données structurées vérifiées</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <Store className="h-6 w-6 text-blue-600" />
          <p className="mt-3 text-sm text-gray-500">Boutique cible</p>
          {isConnected && store ? (
            <>
              <p className="mt-1 text-xl font-semibold text-gray-900">{store.name}</p>
              <p className="mt-1 text-sm text-gray-500">{store.platform} · connexion active</p>
            </>
          ) : (
            <>
              <p className="mt-1 text-xl font-semibold text-gray-900">Aucune boutique active</p>
              <p className="mt-1 text-sm text-amber-700">Connectez une boutique avant publication.</p>
            </>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-gray-900">État réel des fonctionnalités</h2>
          <p className="mt-1 text-sm text-gray-600">
            Cette page n’affiche que ce qui est vérifié dans le code actuel. Aucun compteur simulé.
          </p>
        </div>

        <div className="divide-y divide-gray-100">
          {capabilities.map((capability) => {
            const meta = statusMeta[capability.status];
            const Icon =
              capability.status === 'available'
                ? CheckCircle2
                : capability.status === 'partial'
                  ? AlertTriangle
                  : XCircle;

            return (
              <div key={capability.label} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                  <Icon
                    className={
                      capability.status === 'available'
                        ? 'mt-0.5 h-5 w-5 text-green-600'
                        : capability.status === 'partial'
                          ? 'mt-0.5 h-5 w-5 text-amber-600'
                          : 'mt-0.5 h-5 w-5 text-gray-400'
                    }
                  />
                  <div>
                    <p className="font-medium text-gray-900">{capability.label}</p>
                    <p className="mt-1 text-sm text-gray-600">{capability.description}</p>
                  </div>
                </div>
                <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${meta.className}`}>
                  {meta.label}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Comment l’utiliser</h2>
          <ol className="mt-4 space-y-4 text-sm text-gray-700">
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700">1</span>
              <span>Ouvrez une fiche produit AliExpress ou Amazon compatible dans Chrome.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700">2</span>
              <span>Ouvrez l’extension ShopOpti et vérifiez l’aperçu détecté.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700">3</span>
              <span>Transférez le produit vers ShopOpti, vérifiez les données reçues puis ajoutez-le au pipeline canonique.</span>
            </li>
          </ol>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Actions</h2>
          <div className="mt-4 flex flex-col gap-3">
            <Button asChild>
              <Link to="/app/import-products">
                Ouvrir Import produits
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/app/integrations">Voir les intégrations</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-gray-500">
            Le téléchargement Chrome Web Store n’est pas affiché tant qu’une version publiée et validée n’est pas disponible.
          </p>
        </div>
      </section>
    </div>
  );
};

export default ExtensionHub;
