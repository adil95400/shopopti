import json
import os
import sys
from pathlib import Path

# Make repository-root imports work whether this script is executed from the
# repository root or directly as `python backend/generate_openapi.py`.
REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# Provide placeholder environment variables so that modules imported by
# `backend.main` do not fail when required configuration is missing.
os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "dummy")
os.environ.setdefault("STRIPE_SECRET_KEY", "dummy")

from backend.main import app

# Generate the OpenAPI schema using FastAPI's built-in generator.
schema = app.openapi()

# Always write to the repository docs directory, independent of the caller's
# current working directory.
output_path = REPO_ROOT / "docs" / "openapi.json"
output_path.parent.mkdir(parents=True, exist_ok=True)

with output_path.open("w", encoding="utf-8") as f:
    json.dump(schema, f, indent=2)
