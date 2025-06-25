import React from 'react';
import { Check, Link } from 'lucide-react';

import MainNavbar from '../../components/layout/MainNavbar';
import Footer from '../../components/layout/Footer';
import { Button } from '../../components/ui/button';

interface Platform {
  id: string;
  name: string;
  connected: boolean;
}

const platforms: Platform[] = [
  { id: 'shopify', name: 'Shopify', connected: false },
  { id: 'amazon', name: 'Amazon', connected: false },
  { id: 'tiktok', name: 'TikTok', connected: false }
];

const MarketplaceIndex: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavbar />
      <div className="max-w-4xl mx-auto px-4 py-12 mt-16 space-y-6">
        <h1 className="text-2xl font-bold">Marketplaces</h1>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {platforms.map(p => (
            <div key={p.id} className="bg-white p-4 rounded shadow flex flex-col items-center">
              <p className="font-semibold mb-2">{p.name}</p>
              {p.connected ? (
                <Button disabled><Check className="h-4 w-4 mr-2" />Connecté</Button>
              ) : (
                <Button variant="outline"><Link className="h-4 w-4 mr-2" />Se connecter</Button>
              )}
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default MarketplaceIndex;
