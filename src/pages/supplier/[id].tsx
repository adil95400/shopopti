import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface Supplier {
  id: string;
  name: string;
  description?: string;
}

const SupplierDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      supabase
        .from('suppliers')
        .select('*')
        .eq('id', id)
        .maybeSingle()
        .then(({ data }) => setSupplier(data));
    }
  }, [id]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setImages(Array.from(e.target.files));
    }
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const formData = new FormData();
      formData.append('supplier_id', id || '');
      formData.append('email', user.email ?? '');
      formData.append('rating', rating.toString());
      formData.append('comment', comment);
      images.forEach(img => formData.append('images', img));

      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-review`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      setRating(0);
      setComment('');
      setImages([]);
    } catch (err) {
      console.error('Error submitting review:', err);
      setError('Failed to submit review');
    }
  };

  if (!supplier) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">{supplier.name}</h1>
        <p>{supplier.description}</p>
      </div>

      <form onSubmit={submitReview} className="space-y-4 max-w-md">
        <div>
          <label className="block mb-1 font-medium">Rating</label>
          <select
            className="input"
            value={rating}
            onChange={e => setRating(Number(e.target.value))}
          >
            {[1,2,3,4,5].map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block mb-1 font-medium">Comment</label>
          <textarea
            className="input w-full"
            value={comment}
            onChange={e => setComment(e.target.value)}
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Images</label>
          <input type="file" multiple onChange={handleImageChange} />
        </div>
        {error && <p className="text-red-600">{error}</p>}
        <button type="submit" className="btn btn-primary">Submit Review</button>
      </form>
    </div>
  );
};

export default SupplierDetail;
