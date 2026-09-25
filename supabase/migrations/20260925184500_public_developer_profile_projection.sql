-- P0 public developer profile projection hardening.
-- Split public profile data from the private developer_profiles table so the
-- staging proof: public/private row counts match and sensitive columns are absent.
-- public view can use security_invoker without exposing payout/tax fields.

CREATE TABLE IF NOT EXISTS public.developer_public_profiles (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  developer_name text NOT NULL,
  company_name text,
  website text,
  bio text,
  avatar_url text,
  verified boolean DEFAULT false,
  total_revenue numeric(12,2) DEFAULT 0,
  total_downloads integer DEFAULT 0,
  average_rating numeric(3,2) DEFAULT 0,
  total_reviews integer DEFAULT 0,
  extensions_count integer DEFAULT 0,
  created_at timestamptz,
  updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS developer_public_profiles_user_id_idx
  ON public.developer_public_profiles(user_id);

ALTER TABLE public.developer_public_profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.developer_public_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.developer_public_profiles TO anon, authenticated;
GRANT ALL ON TABLE public.developer_public_profiles TO service_role;

DROP POLICY IF EXISTS "Public developer profiles are readable" ON public.developer_public_profiles;
CREATE POLICY "Public developer profiles are readable"
  ON public.developer_public_profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.sync_developer_public_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.developer_public_profiles
    WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  INSERT INTO public.developer_public_profiles (
    id,
    user_id,
    developer_name,
    company_name,
    website,
    bio,
    avatar_url,
    verified,
    total_revenue,
    total_downloads,
    average_rating,
    total_reviews,
    extensions_count,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.user_id,
    NEW.developer_name,
    NEW.company_name,
    NEW.website,
    NEW.bio,
    NEW.avatar_url,
    COALESCE(NEW.verified, false),
    COALESCE(NEW.total_revenue, 0),
    COALESCE(NEW.total_downloads, 0),
    COALESCE(NEW.average_rating, 0),
    COALESCE(NEW.total_reviews, 0),
    COALESCE(NEW.extensions_count, 0),
    NEW.created_at,
    NEW.updated_at
  )
  ON CONFLICT (id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    developer_name = EXCLUDED.developer_name,
    company_name = EXCLUDED.company_name,
    website = EXCLUDED.website,
    bio = EXCLUDED.bio,
    avatar_url = EXCLUDED.avatar_url,
    verified = EXCLUDED.verified,
    total_revenue = EXCLUDED.total_revenue,
    total_downloads = EXCLUDED.total_downloads,
    average_rating = EXCLUDED.average_rating,
    total_reviews = EXCLUDED.total_reviews,
    extensions_count = EXCLUDED.extensions_count,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.sync_developer_public_profile()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS developer_profiles_public_projection_sync
  ON public.developer_profiles;

CREATE TRIGGER developer_profiles_public_projection_sync
AFTER INSERT OR UPDATE OR DELETE ON public.developer_profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_developer_public_profile();

INSERT INTO public.developer_public_profiles (
  id,
  user_id,
  developer_name,
  company_name,
  website,
  bio,
  avatar_url,
  verified,
  total_revenue,
  total_downloads,
  average_rating,
  total_reviews,
  extensions_count,
  created_at,
  updated_at
)
SELECT
  id,
  user_id,
  developer_name,
  company_name,
  website,
  bio,
  avatar_url,
  COALESCE(verified, false),
  COALESCE(total_revenue, 0),
  COALESCE(total_downloads, 0),
  COALESCE(average_rating, 0),
  COALESCE(total_reviews, 0),
  COALESCE(extensions_count, 0),
  created_at,
  updated_at
FROM public.developer_profiles
ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  developer_name = EXCLUDED.developer_name,
  company_name = EXCLUDED.company_name,
  website = EXCLUDED.website,
  bio = EXCLUDED.bio,
  avatar_url = EXCLUDED.avatar_url,
  verified = EXCLUDED.verified,
  total_revenue = EXCLUDED.total_revenue,
  total_downloads = EXCLUDED.total_downloads,
  average_rating = EXCLUDED.average_rating,
  total_reviews = EXCLUDED.total_reviews,
  extensions_count = EXCLUDED.extensions_count,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at;

CREATE OR REPLACE VIEW public.public_developer_profiles
WITH (security_invoker = true)
AS
SELECT
  id,
  user_id,
  developer_name,
  company_name,
  website,
  bio,
  avatar_url,
  verified,
  total_revenue,
  total_downloads,
  average_rating,
  total_reviews,
  extensions_count,
  created_at,
  updated_at
FROM public.developer_public_profiles;

REVOKE ALL ON TABLE public.public_developer_profiles FROM PUBLIC;
GRANT SELECT ON TABLE public.public_developer_profiles TO anon, authenticated, service_role;
