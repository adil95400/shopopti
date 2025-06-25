import React, { useState } from 'react';

import MainNavbar from '../../components/layout/MainNavbar';
import Footer from '../../components/layout/Footer';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';

const ProductGenerator: React.FC = () => {
  const [name, setName] = useState('');

  const handleGenerate = () => {
    alert(`Génération AI pour ${name}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavbar />
      <div className="max-w-md mx-auto px-4 py-12 mt-16 space-y-4">
        <h1 className="text-2xl font-bold">Générateur de fiche produit</h1>
        <Input placeholder="Nom du produit" value={name} onChange={e => setName(e.target.value)} />
        <Button onClick={handleGenerate}>Générer</Button>
      </div>
      <Footer />
    </div>
  );
};

export default ProductGenerator;
