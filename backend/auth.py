import os
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client
from gotrue import User

supabase_url = os.getenv("SUPABASE_URL") or ""
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""

supabase = create_client(supabase_url, supabase_key)
security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """Validate Authorization header Bearer token with Supabase and return the user."""
    token = credentials.credentials
    try:
        res = supabase.auth.get_user(token)
        if res and res.user:
            return res.user
    except Exception:
        pass
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")
