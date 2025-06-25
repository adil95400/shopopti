from pathlib import Path
import sys
import json
import os

# Ensure the project root is on PYTHONPATH
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Provide default environment variables so imports succeed
os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "key")
os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test")
os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "whsec")
os.environ.setdefault("STRIPE_SUCCESS_URL", "http://localhost")
os.environ.setdefault("STRIPE_CANCEL_URL", "http://localhost")

from backend.main import app


def main() -> None:
    """Generate OpenAPI specification."""
    spec = app.openapi()
    docs_dir = ROOT / "docs"
    docs_dir.mkdir(exist_ok=True)
    spec_path = docs_dir / "openapi.json"
    spec_path.write_text(json.dumps(spec, indent=2))
    print(f"OpenAPI spec written to {spec_path}")


if __name__ == "__main__":
    main()
