/*
  # Create product_reviews table

  1. New Tables
    - product_reviews: product reviews with optional images

  2. Security
    - Enable RLS and public read access
*/

CREATE TABLE IF NOT EXISTS product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  product_name text,
  product_image text,
  customer_name text,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  images text[],
  created_at timestamptz DEFAULT now()
);

ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read product reviews" ON product_reviews
  FOR SELECT USING (true);
