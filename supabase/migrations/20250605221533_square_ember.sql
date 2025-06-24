/*
  # Create users table and add RLS policies
  
  1. New Tables
    - `users` - Table for storing user information
  
  2. Security
    - Enable RLS on `users` table
    - Add policy for users to read their own profile
    - Add policy for users to read basic info of other users
*/

-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'viewer' CHECK (role IN ('admin', 'manager', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy for users to read their own full profile
CREATE POLICY "Users can read own profile"
ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Policy for users to read basic info of other users
CREATE POLICY "Users can read basic info of other users"
ON users
FOR SELECT
TO authenticated
USING (true);

-- Ensure authenticated role has usage on public schema
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant SELECT on users table to authenticated role
GRANT SELECT ON users TO authenticated;

-- Admins can manage all users
CREATE POLICY "Admins manage all users"
  ON users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- Managers can update users
CREATE POLICY "Managers can update users"
  ON users
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('manager', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('manager', 'admin')
    )
  );
