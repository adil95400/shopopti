import React, { useState } from 'react';
import { Check, ThumbsDown, ThumbsUp, Upload } from 'lucide-react';

import MainNavbar from '../../components/layout/MainNavbar';
import Footer from '../../components/layout/Footer';
import { Button } from '../../components/ui/button';

interface Review {
  id: string;
  author: string;
  content: string;
  rating: number;
}

const ReviewsIndex: React.FC = () => {
  const [reviews] = useState<Review[]>([
    { id: '1', author: 'Alice', content: 'Super produit', rating: 5 },
    { id: '2', author: 'Bob', content: 'Moyen', rating: 3 }
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavbar />
      <div className="max-w-4xl mx-auto px-4 py-12 mt-16 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Avis clients</h1>
          <Button variant="outline"><Upload className="h-4 w-4 mr-2" />Importer Shopify</Button>
        </div>

        <div className="space-y-4">
          {reviews.map(r => (
            <div key={r.id} className="bg-white p-4 rounded shadow">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{r.author}</p>
                  <p className="text-sm text-gray-500">{r.content}</p>
                </div>
                <div className="flex gap-2">
                  <button className="text-green-600 hover:text-green-800"><ThumbsUp className="h-4 w-4" /></button>
                  <button className="text-red-600 hover:text-red-800"><ThumbsDown className="h-4 w-4" /></button>
                  <button className="text-blue-600 hover:text-blue-800"><Check className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ReviewsIndex;
