import os
from pathlib import Path
import json

# Provide placeholder environment variables so that modules imported by
# `backend.main` do not fail when required configuration is missing.
os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "dummy")
os.environ.setdefault("STRIPE_SECRET_KEY", "dummy")

from backend.main import app

# Generate the OpenAPI schema using FastAPI's built-in generator
schema = app.openapi()

# Ensure docs directory exists
output_path = Path("docs/openapi.json")
output_path.parent.mkdir(parents=True, exist_ok=True)

# Write schema to file
with output_path.open("w") as f:
    json.dump(schema, f, indent=2)

