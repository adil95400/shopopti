import React, { useState } from 'react';

import { Button } from '../../components/ui/button';

interface Platform {
  id: string;
  name: string;
  connected: boolean;
}

const initialPlatforms: Platform[] = [
  { id: 'shopify', name: 'Shopify', connected: false },
  { id: 'amazon', name: 'Amazon', connected: false },
  { id: 'ebay', name: 'eBay', connected: false }
];

const MarketplacePage: React.FC = () => {
  const [platforms, setPlatforms] = useState<Platform[]>(initialPlatforms);

  const toggle = (id: string) => {
    setPlatforms(p => p.map(pl => (pl.id === id ? { ...pl, connected: !pl.connected } : pl)));
  };

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-2xl font-bold">Marketplace Connections</h1>
      {platforms.map(p => (
        <div key={p.id} className="flex justify-between items-center bg-white p-4 border rounded-md">
          <span>{p.name}</span>
          <Button onClick={() => toggle(p.id)} variant={p.connected ? 'outline' : 'default'}>
            {p.connected ? 'Disconnect' : 'Connect'}
          </Button>
        </div>
      ))}
    </div>
  );
};

export default MarketplacePage;
