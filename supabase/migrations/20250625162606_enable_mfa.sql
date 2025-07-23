/*
  # Add user_mfa_factors table for tracking enrolled MFA factors

  1. New Tables
    - user_mfa_factors - Links auth.mfa_factors to users for easier queries
      - id (uuid, primary key)
      - user_id (uuid, references auth.users)
      - factor_id (uuid, references auth.mfa_factors)
      - created_at (timestamp)

  2. Security
    - Enable RLS
    - Allow users to manage their own records
*/

CREATE TABLE IF NOT EXISTS user_mfa_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  factor_id uuid REFERENCES auth.mfa_factors(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_mfa_factors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their MFA factors" ON user_mfa_factors
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_mfa_user_id ON user_mfa_factors(user_id);
