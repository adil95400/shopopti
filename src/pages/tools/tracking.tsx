import React, { useState } from 'react';

import MainNavbar from '../../components/layout/MainNavbar';
import Footer from '../../components/layout/Footer';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';

const TrackingTool: React.FC = () => {
  const [number, setNumber] = useState('');
  const handleTrack = () => {
    alert(`Tracking ${number}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavbar />
      <div className="max-w-md mx-auto px-4 py-12 mt-16 space-y-4">
        <h1 className="text-2xl font-bold">Suivi colis</h1>
        <Input placeholder="Numéro" value={number} onChange={e => setNumber(e.target.value)} />
        <Button onClick={handleTrack}>Suivre</Button>
        <div className="h-64 bg-gray-200 rounded" />
        <Button variant="outline">Contacter fournisseur</Button>
        <Button variant="outline">Contacter client</Button>
      </div>
      <Footer />
    </div>
  );
};

export default TrackingTool;
