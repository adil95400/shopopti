/*
  # Create workspaces table

  1. New Tables
    - `workspaces` - Stores workspace settings per user
      - `id` uuid primary key
      - `owner_id` uuid references auth.users
      - `name` text
      - `timezone` text
      - `currency` text
      - `created_at` timestamp
      - `updated_at` timestamp

  2. Security
    - Enable RLS so only owner or admins/managers can update the row
*/

CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces(owner_id);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace owners can manage" ON workspaces
  FOR ALL
  USING (
    owner_id = auth.uid() OR EXISTS (
      SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin','superadmin')
    )
  )
  WITH CHECK (
    owner_id = auth.uid() OR EXISTS (
      SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin','superadmin')
    )
  );

