import React from 'react';
import { UploadCloud } from 'lucide-react';

import MainNavbar from '../../components/layout/MainNavbar';
import Footer from '../../components/layout/Footer';
import CSVImporter from '../../components/import/CSVImporter';
import { Button } from '../../components/ui/button';

const ProductImport: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavbar />
      <div className="max-w-4xl mx-auto px-4 py-12 mt-16 space-y-8">
        <h1 className="text-2xl font-bold">Importer des produits</h1>

        <CSVImporter />

        <div className="space-y-4">
          <h2 className="font-semibold">Connexion fournisseurs</h2>
          <div className="flex flex-wrap gap-4">
            <Button variant="outline">Connecter AliExpress</Button>
            <Button variant="outline">Connecter BigBuy</Button>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="font-semibold">Optimisation IA</h2>
          <p className="text-sm text-gray-500">Améliorez titre, description et prix automatiquement</p>
          <Button>
            <UploadCloud className="h-4 w-4 mr-2" />Optimiser
          </Button>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ProductImport;
