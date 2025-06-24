-- Enable multi-factor authentication

-- enum types for factors and AAL
DO $$ BEGIN
  CREATE TYPE factor_type AS ENUM ('totp', 'phone', 'webauthn');
  CREATE TYPE factor_status AS ENUM ('unverified', 'verified');
  CREATE TYPE aal_level AS ENUM ('aal1', 'aal2', 'aal3');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS auth.mfa_factors (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friendly_name text NULL,
  factor_type factor_type NOT NULL,
  status factor_status NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  secret text NULL,
  phone text UNIQUE DEFAULT NULL,
  last_challenged_at timestamptz UNIQUE DEFAULT NULL,
  web_authn_credential jsonb NULL,
  web_authn_aaguid uuid NULL
);
COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';

CREATE UNIQUE INDEX IF NOT EXISTS mfa_factors_user_friendly_name_unique
  ON auth.mfa_factors (friendly_name, user_id) WHERE trim(friendly_name) <> '';
CREATE UNIQUE INDEX IF NOT EXISTS unique_verified_phone_factor
  ON auth.mfa_factors (user_id, phone);
CREATE INDEX IF NOT EXISTS mfa_factors_user_id_idx ON auth.mfa_factors(user_id);
CREATE INDEX IF NOT EXISTS factor_id_created_at_idx ON auth.mfa_factors (user_id, created_at);

CREATE TABLE IF NOT EXISTS auth.mfa_challenges (
  id uuid PRIMARY KEY,
  factor_id uuid NOT NULL REFERENCES auth.mfa_factors(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL,
  verified_at timestamptz NULL,
  ip_address inet NOT NULL,
  otp_code text NULL,
  web_authn_session_data jsonb NULL
);
COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';
CREATE INDEX IF NOT EXISTS mfa_challenge_created_at_idx ON auth.mfa_challenges (created_at DESC);

CREATE TABLE IF NOT EXISTS auth.mfa_amr_claims (
  id uuid,
  session_id uuid NOT NULL REFERENCES auth.sessions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  authentication_method text NOT NULL,
  CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE(session_id, authentication_method)
);
COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';

ALTER TABLE auth.sessions ADD COLUMN IF NOT EXISTS factor_id uuid NULL;
ALTER TABLE auth.sessions ADD COLUMN IF NOT EXISTS aal aal_level NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'auth'
      AND table_name = 'mfa_amr_claims'
      AND constraint_name = 'amr_id_pk'
  ) THEN
    ALTER TABLE auth.mfa_amr_claims ADD CONSTRAINT amr_id_pk PRIMARY KEY(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS user_id_created_at_idx ON auth.sessions (user_id, created_at);
