from fastapi import APIRouter, Request
from supabase import create_client
import httpx
import os

router = APIRouter()

AIRTABLE_API_KEY = os.getenv("AIRTABLE_API_KEY")
supabase_url = os.getenv("SUPABASE_URL") or ""
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""
supabase = create_client(supabase_url, supabase_key)

@router.post("/api/airtable/subscribe")
async def subscribe_airtable(request: Request):
    body = await request.json()
    user_id = body.get("user_id")
    base_id = body.get("base_id")
    table = body.get("table")
    if not user_id or not base_id or not table:
        return {"error": "user_id, base_id and table required"}

    supabase.table("webhook_integrations").upsert({
        "user_id": user_id,
        "service": "airtable",
        "url": None,
        "settings": {"base_id": base_id, "table": table}
    }, on_conflict=["user_id","service"]).execute()

    return {"status": "subscribed"}

@router.post("/api/airtable/event")
async def forward_airtable_event(request: Request):
    if not AIRTABLE_API_KEY:
        return {"error": "AIRTABLE_API_KEY not configured"}

    body = await request.json()
    user_id = body.get("user_id")
    event = body.get("event")
    if not user_id or event is None:
        return {"error": "user_id and event required"}

    resp = supabase.table("webhook_integrations").select("settings").eq("user_id", user_id).eq("service", "airtable").maybe_single().execute()
    settings = resp.data.get("settings") if resp.data else None
    if not settings:
        return {"error": "no subscription"}

    base_id = settings.get("base_id")
    table = settings.get("table")
    if not base_id or not table:
        return {"error": "invalid settings"}

    url = f"https://api.airtable.com/v0/{base_id}/{table}"
    headers = {"Authorization": f"Bearer {AIRTABLE_API_KEY}", "Content-Type": "application/json"}
    async with httpx.AsyncClient() as client:
        await client.post(url, json={"fields": event}, headers=headers, timeout=10)

    return {"status": "forwarded"}
