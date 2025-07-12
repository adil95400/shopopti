from fastapi import APIRouter, Request
from supabase import create_client
import httpx
import os

router = APIRouter()

supabase_url = os.getenv("SUPABASE_URL") or ""
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""
supabase = create_client(supabase_url, supabase_key)

@router.post("/api/zapier/subscribe")
async def subscribe_zapier(request: Request):
    body = await request.json()
    user_id = body.get("user_id")
    url = body.get("url")
    if not user_id or not url:
        return {"error": "user_id and url required"}

    supabase.table("webhook_integrations").upsert({
        "user_id": user_id,
        "service": "zapier",
        "url": url,
        "settings": {}
    }, on_conflict=["user_id","service"]).execute()

    return {"status": "subscribed"}

@router.post("/api/zapier/event")
async def forward_zapier_event(request: Request):
    body = await request.json()
    user_id = body.get("user_id")
    event = body.get("event")
    if not user_id or event is None:
        return {"error": "user_id and event required"}

    resp = supabase.table("webhook_integrations").select("url").eq("user_id", user_id).eq("service", "zapier").maybe_single().execute()
    url = resp.data["url"] if resp.data else None
    if not url:
        return {"error": "no subscription"}

    async with httpx.AsyncClient() as client:
        await client.post(url, json=event, timeout=10)

    return {"status": "forwarded"}
