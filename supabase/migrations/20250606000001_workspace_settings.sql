/*
  # Create workspaces table

  1. New Table
    - `workspaces`
      - `id` uuid primary key
      - `owner_id` uuid references auth.users
      - `name` text
      - `timezone` text
      - `currency` text
      - `created_at` timestamptz
      - `updated_at` timestamptz

  2. Security
    - Enable RLS
    - Allow owners or admin/manager users to update their workspace
*/

CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text,
  timezone text,
  currency text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace owners can manage" ON workspaces
  FOR ALL USING (
    owner_id = auth.uid() OR
    auth.uid() IN (SELECT id FROM auth.users WHERE role IN ('admin', 'manager'))
  );
