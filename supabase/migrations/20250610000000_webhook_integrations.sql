/*
  # Create webhook_integrations table

  1. New Tables
    - `webhook_integrations`
      - `id` uuid primary key
      - `user_id` uuid references auth.users
      - `service` text (zapier, airtable, notion)
      - `url` text
      - `settings` jsonb
      - `created_at` timestamp

  2. Security
    - Enable RLS on webhook_integrations
    - Policies for users to manage their own rows
*/

CREATE TABLE IF NOT EXISTS webhook_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  service text NOT NULL,
  url text,
  settings jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_integrations_user_service ON webhook_integrations(user_id, service);

ALTER TABLE webhook_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own webhook integrations" ON webhook_integrations
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own webhook integrations" ON webhook_integrations
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own webhook integrations" ON webhook_integrations
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own webhook integrations" ON webhook_integrations
  FOR DELETE USING (user_id = auth.uid());
