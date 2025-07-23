/*
  # Create store_connections and webhook_integrations tables
  
  1. New Tables
    - `store_connections` - Stores connections to e-commerce platforms
    - `webhook_integrations` - Stores webhook integrations with external services
    - `platform_connections` - Stores connections to sales platforms
  
  2. Security
    - Enable RLS on all tables
    - Add policies for users to manage their own connections and integrations
*/

-- Store connections table
CREATE TABLE IF NOT EXISTS public.store_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform varchar(255) NOT NULL,
  store_url text NOT NULL,
  api_key text NOT NULL,
  api_secret text,
  scopes text[],
  status varchar(50) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_sync timestamptz
);

ALTER TABLE public.store_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own store connections"
  ON public.store_connections
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own store connections"
  ON public.store_connections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own store connections"
  ON public.store_connections
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Webhook integrations table
CREATE TABLE IF NOT EXISTS public.webhook_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service varchar(255) NOT NULL,
  url text,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own webhook integrations"
  ON public.webhook_integrations
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own webhook integrations"
  ON public.webhook_integrations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own webhook integrations"
  ON public.webhook_integrations
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Platform connections table
CREATE TABLE IF NOT EXISTS public.platform_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_id varchar(255) NOT NULL,
  name varchar(255) NOT NULL,
  type varchar(50) NOT NULL,
  credentials jsonb,
  settings jsonb DEFAULT '{}'::jsonb,
  status varchar(50) NOT NULL DEFAULT 'active',
  connected_at timestamptz NOT NULL DEFAULT now(),
  disconnected_at timestamptz,
  last_sync timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own platform connections"
  ON public.platform_connections
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own platform connections"
  ON public.platform_connections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own platform connections"
  ON public.platform_connections
  FOR UPDATE
  USING (auth.uid() = user_id);