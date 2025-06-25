import React, { useState } from 'react';
import { Download } from 'lucide-react';

import MainNavbar from '../../components/layout/MainNavbar';
import Footer from '../../components/layout/Footer';
import { Button } from '../../components/ui/button';

const PdfInvoices: React.FC = () => {
  const [period, setPeriod] = useState('');
  const [status, setStatus] = useState('');

  const handleDownload = () => {
    alert('Téléchargement des factures...');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavbar />
      <div className="max-w-4xl mx-auto px-4 py-12 mt-16 space-y-6">
        <h1 className="text-2xl font-bold">Factures PDF</h1>

        <div className="flex flex-wrap gap-4">
          <input type="month" className="border px-3 py-2 rounded" value={period} onChange={e => setPeriod(e.target.value)} />
          <select className="border px-3 py-2 rounded" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">Tous statuts</option>
            <option value="payée">Payée</option>
            <option value="en attente">En attente</option>
          </select>
        </div>

        <Button onClick={handleDownload}><Download className="h-4 w-4 mr-2" />Télécharger en lot</Button>
      </div>
      <Footer />
    </div>
  );
};

export default PdfInvoices;
