import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT))

# Provide dummy environment variables required for importing the app
os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "d.e.f")

from backend.main import app

Path("docs").mkdir(parents=True, exist_ok=True)
with open("docs/openapi.json", "w") as f:
    json.dump(app.openapi(), f, indent=2)
