import React, { useState } from 'react';

import MainNavbar from '../../components/layout/MainNavbar';
import Footer from '../../components/layout/Footer';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

const SettingsIndex: React.FC = () => {
  const [shopifyKey, setShopifyKey] = useState('');
  const [trackKey, setTrackKey] = useState('');

  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavbar />
      <div className="max-w-xl mx-auto px-4 py-12 mt-16 space-y-6">
        <h1 className="text-2xl font-bold">Paramètres</h1>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Clé API Shopify</label>
            <Input value={shopifyKey} onChange={e => setShopifyKey(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Clé API 17track</label>
            <Input value={trackKey} onChange={e => setTrackKey(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Préférences IA</label>
            <textarea className="w-full border rounded px-3 py-2" rows={3} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Intégrations</label>
            <div className="flex gap-2">
              <Button variant="outline">Zapier</Button>
              <Button variant="outline">Mailchimp</Button>
            </div>
          </div>
          <Button>Enregistrer</Button>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default SettingsIndex;
