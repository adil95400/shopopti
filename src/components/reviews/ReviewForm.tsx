import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Star, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export interface ReviewInput {
  rating: number;
  comment: string;
  images: File[];
}

interface ReviewFormProps {
  onAdd: (review: any) => void;
}

const MAX_FILES = 3;

const ReviewForm: React.FC<ReviewFormProps> = ({ onAdd }) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback((accepted: File[]) => {
    setFiles(prev => [...prev, ...accepted].slice(0, MAX_FILES));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.webp']
    },
    multiple: true,
    maxFiles: MAX_FILES
  });

  const handleSubmit = async () => {
    if (uploading) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of files) {
        const path = `reviews/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage
          .from('review-images')
          .upload(path, file);
        if (error) throw error;
        const { data } = supabase.storage.from('review-images').getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      const { data, error } = await supabase
        .from('product_reviews')
        .insert([{ rating, comment, images: urls }])
        .select()
        .single();
      if (error) throw error;
      const newReview = {
        id: data?.id || Date.now().toString(),
        productName: data?.product_name || 'Manual product',
        productImage: data?.product_image || '',
        customerName: data?.customer_name || 'Anonymous',
        rating: data?.rating ?? rating,
        comment: data?.comment ?? comment,
        date: data?.created_at || new Date().toISOString(),
        source: 'manual',
        helpful: 0,
        verified: false,
        images: urls
      };
      onAdd(newReview);
      setRating(5);
      setComment('');
      setFiles([]);
    } catch (err) {
      console.error('Failed to submit review', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={20}
            className={
              star <= rating ? 'text-warning-400 fill-warning-400 cursor-pointer' : 'text-neutral-300 cursor-pointer'
            }
            onClick={() => setRating(star)}
          />
        ))}
      </div>
      <textarea
        className="w-full border border-neutral-300 rounded-md p-2"
        placeholder="Write your review..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div
        {...getRootProps()}
        className="border-2 border-dashed rounded-md p-4 text-center cursor-pointer"
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center">
          <ImageIcon className="h-6 w-6 text-neutral-500" />
          <p className="mt-2 text-sm text-neutral-500">
            {isDragActive ? 'Drop images here...' : `Select up to ${MAX_FILES} images`}
          </p>
        </div>
      </div>
      {files.length > 0 && (
        <div className="flex gap-2">
          {files.map((file, idx) => (
            <img
              key={idx}
              src={URL.createObjectURL(file)}
              alt={`preview-${idx}`}
              className="w-16 h-16 object-cover rounded"
            />
          ))}
        </div>
      )}
      <button className="btn btn-primary" onClick={handleSubmit} disabled={uploading}>
        {uploading ? 'Submitting...' : 'Submit Review'}
      </button>
    </div>
  );
};

export default ReviewForm;
