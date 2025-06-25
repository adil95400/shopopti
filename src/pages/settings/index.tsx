import React, { useState } from 'react';

import { Button } from '../../components/ui/button';

const SettingsPage: React.FC = () => {
  const [prefs, setPrefs] = useState({ language: 'en', theme: 'light' });
  const [apiKeys, setApiKeys] = useState({ shopify: '', openai: '' });
  const [webhook, setWebhook] = useState('');
  const [integrations, setIntegrations] = useState({ shopify: false, stripe: false });

  const save = () => {
    alert('Settings saved');
  };

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="space-y-4 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-medium">Preferences</h2>
        <div className="space-y-2">
          <div>
            <label className="block text-sm font-medium mb-1">Language</label>
            <select className="w-full border rounded-md px-2 py-1" value={prefs.language} onChange={e => setPrefs({ ...prefs, language: e.target.value })}>
              <option value="en">English</option>
              <option value="fr">Français</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Theme</label>
            <select className="w-full border rounded-md px-2 py-1" value={prefs.theme} onChange={e => setPrefs({ ...prefs, theme: e.target.value })}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-medium">API Keys</h2>
        <div className="space-y-2">
          <div>
            <label className="block text-sm font-medium mb-1">Shopify</label>
            <input className="w-full border rounded-md px-2 py-1" value={apiKeys.shopify} onChange={e => setApiKeys({ ...apiKeys, shopify: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">OpenAI</label>
            <input className="w-full border rounded-md px-2 py-1" value={apiKeys.openai} onChange={e => setApiKeys({ ...apiKeys, openai: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="space-y-4 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-medium">Webhooks</h2>
        <input className="w-full border rounded-md px-2 py-1" placeholder="https://example.com/webhook" value={webhook} onChange={e => setWebhook(e.target.value)} />
      </div>

      <div className="space-y-4 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-medium">Integrations</h2>
        <label className="flex items-center space-x-2">
          <input type="checkbox" checked={integrations.shopify} onChange={e => setIntegrations({ ...integrations, shopify: e.target.checked })} />
          <span>Shopify</span>
        </label>
        <label className="flex items-center space-x-2">
          <input type="checkbox" checked={integrations.stripe} onChange={e => setIntegrations({ ...integrations, stripe: e.target.checked })} />
          <span>Stripe</span>
        </label>
      </div>

      <Button onClick={save}>Save</Button>
    </div>
  );
};

export default SettingsPage;
