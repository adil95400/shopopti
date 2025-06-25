import React, { useState } from 'react';

import MainNavbar from '../../components/layout/MainNavbar';
import Footer from '../../components/layout/Footer';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';

interface Faq {
  q: string;
  a: string;
}

const faqs: Faq[] = [
  { q: 'Comment modifier mon abonnement ?', a: 'Rendez-vous dans la section abonnement.' },
  { q: 'Puis-je contacter un agent ?', a: 'Oui, si un agent est disponible un message s\'affiche.' }
];

const SupportIndex: React.FC = () => {
  const [message, setMessage] = useState('');
  const agentOnline = true;

  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavbar />
      <div className="max-w-3xl mx-auto px-4 py-12 mt-16 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Support</h1>
          {agentOnline && <Badge variant="success">Agent en ligne</Badge>}
        </div>

        <div className="space-y-4">
          <div className="bg-white p-4 rounded shadow space-y-2">
            <Input placeholder="Écrire au chat IA" value={message} onChange={e => setMessage(e.target.value)} />
            <Button>Envoyer</Button>
          </div>

          <div className="space-y-2">
            {faqs.map((f, i) => (
              <div key={i} className="bg-white p-4 rounded shadow">
                <p className="font-semibold">{f.q}</p>
                <p className="text-sm text-gray-500">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default SupportIndex;
