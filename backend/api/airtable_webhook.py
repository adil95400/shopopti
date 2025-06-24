from fastapi import APIRouter, Request
from supabase import create_client
import httpx
import os

router = APIRouter(prefix="/api/airtable")

supabase_url = os.getenv("SUPABASE_URL") or ""
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""
supabase = create_client(supabase_url, supabase_key)

@router.post("/subscribe")
async def subscribe(request: Request):
    body = await request.json()
    user_id = body.get("user_id")
    target_url = body.get("target_url")
    events = body.get("events", [])
    if not user_id or not target_url:
        return {"error": "user_id and target_url required"}
    supabase.table("webhook_subscriptions").upsert({
        "user_id": user_id,
        "service": "airtable",
        "target_url": target_url,
        "events": events,
    }).execute()
    return {"status": "subscribed"}

@router.post("/event")
async def forward_event(request: Request):
    body = await request.json()
    user_id = body.get("user_id")
    event = body.get("event")
    payload = body.get("payload")
    if not user_id or not event or payload is None:
        return {"error": "invalid payload"}
    resp = supabase.table("webhook_subscriptions").select("target_url").eq("user_id", user_id).eq("service", "airtable").maybe_single().execute()
    target = resp.data.get("target_url") if resp.data else None
    if not target:
        return {"error": "no subscription"}
    try:
        async with httpx.AsyncClient() as client:
            await client.post(target, json={"event": event, "payload": payload}, timeout=10)
        return {"status": "forwarded"}
    except Exception as e:
        return {"error": str(e)}
