import React, { useState } from 'react';
import { CheckCircle, XCircle, Bot, Download } from 'lucide-react';

import { askChatGPT } from '../../lib/openai';
import { Button } from '../../components/ui/button';

interface Review {
  id: string;
  author: string;
  rating: number;
  comment: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  reply?: string;
}

const initialReviews: Review[] = [
  { id: '1', author: 'John', rating: 5, comment: 'Great product!', date: '2024-05-15', status: 'pending' },
  { id: '2', author: 'Emma', rating: 3, comment: 'Average quality', date: '2024-05-18', status: 'pending' }
];

const ReviewsPage: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [loading, setLoading] = useState(false);

  const handleApprove = (id: string) => {
    setReviews(reviews.map(r => (r.id === id ? { ...r, status: 'approved' } : r)));
  };

  const handleReject = (id: string) => {
    setReviews(reviews.map(r => (r.id === id ? { ...r, status: 'rejected' } : r)));
  };

  const handleAutoReply = async (id: string) => {
    const review = reviews.find(r => r.id === id);
    if (!review) return;
    try {
      setLoading(true);
      const reply = await askChatGPT(`Reply to this customer review: ${review.comment}`);
      setReviews(reviews.map(r => (r.id === id ? { ...r, reply } : r)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1000);
    alert('Imported reviews from Shopify');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Reviews</h1>
          <p className="text-gray-600">Moderate customer reviews</p>
        </div>
        <Button onClick={handleImport} disabled={loading}>
          <Download className="h-4 w-4 mr-2" /> Import Shopify
        </Button>
      </div>

      <div className="overflow-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Author</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comment</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {reviews.map(review => (
              <tr key={review.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{review.author}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{review.rating}/5</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{review.comment}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{review.date}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <Button size="sm" variant="outline" onClick={() => handleApprove(review.id)}>
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleReject(review.id)}>
                    <XCircle className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" disabled={loading} onClick={() => handleAutoReply(review.id)}>
                    <Bot className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {reviews.some(r => r.reply) && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">AI Replies</h2>
          {reviews.filter(r => r.reply).map(r => (
            <div key={r.id} className="p-4 border rounded-md bg-gray-50">
              <p className="text-sm text-gray-700">{r.reply}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReviewsPage;
