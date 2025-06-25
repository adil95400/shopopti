/*
  # Create reviews table with RLS policies

  1. New Tables
    - `reviews` - Stores user reviews for suppliers
      - `id` (uuid, primary key)
      - `supplier_id` (uuid, references suppliers)
      - `user_id` (uuid, references auth.users)
      - `user_email` (text)
      - `rating` (integer, optional)
      - `review` (text, optional)
      - `images` (text[])
      - `source` (text, optional)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on reviews table
    - Add policy for authenticated users to manage their own reviews
*/

-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES suppliers(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_email text,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  review text,
  images text[],
  source text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_reviews_supplier_id ON reviews(supplier_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);

-- Enable Row Level Security
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Policy allowing users to manage their own reviews
CREATE POLICY "Users manage their own reviews" ON reviews
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
