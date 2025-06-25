import React from 'react';
import { useParams } from 'react-router-dom';
import { Star } from 'lucide-react';
import Avatar from '../components/ui/avatar';

interface Review {
  id: string;
  reviewer: string;
  email: string;
  rating: number;
  comment: string;
  created_at: string;
}

const SupplierDetail: React.FC = () => {
  const { id } = useParams();
  const [reviews, setReviews] = React.useState<Review[]>([]);

  React.useEffect(() => {
    const fetchReviews = async () => {
      try {
        const res = await fetch(`/supabase/supplier-${id}-reviews.json`);
        const data = await res.json();
        const sorted = data.reviews.sort(
          (a: Review, b: Review) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setReviews(sorted);
      } catch (err) {
        console.error('Failed to fetch reviews', err);
      }
    };

    fetchReviews();
  }, [id]);

  const averageRating =
    reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Supplier {id}</h1>
      <div className="flex items-center gap-2">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            size={16}
            className={i < Math.round(averageRating) ? 'text-warning-400 fill-warning-400' : 'text-neutral-300'}
          />
        ))}
        <span className="text-sm text-neutral-700">{averageRating.toFixed(1)} / 5</span>
      </div>

      <div className="space-y-4">
        {reviews.map((review) => (
          <div key={review.id} className="border p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar email={review.email} size={32} />
                <span className="font-medium text-neutral-900">{review.reviewer}</span>
              </div>
              <span className="text-sm text-neutral-500">
                {new Date(review.created_at).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center mt-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  size={16}
                  className={i < review.rating ? 'text-warning-400 fill-warning-400' : 'text-neutral-300'}
                />
              ))}
            </div>
            <p className="mt-2 text-sm text-neutral-700">{review.comment}</p>
          </div>
        ))}

        {reviews.length === 0 && (
          <div className="py-12 text-center space-y-4">
            <p className="text-sm text-neutral-500">No reviews yet.</p>
            <button className="btn btn-primary">Write a review</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupplierDetail;
