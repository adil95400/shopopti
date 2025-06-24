/*
  # Update existing user roles to new enum
*/

-- Map old roles to the new set
UPDATE users
SET role = CASE
  WHEN role IN ('superadmin', 'admin') THEN 'admin'
  WHEN role = 'user' THEN 'viewer'
  WHEN role IS NULL THEN 'viewer'
  ELSE role
END;

-- Ensure default and constraint reflect new roles
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'viewer';
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check' AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_role_check;
  END IF;
  ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'manager', 'viewer'));
END $$;
