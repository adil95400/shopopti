from fastapi import APIRouter, Request
from supabase import create_client
import httpx
import os

router = APIRouter()

NOTION_API_KEY = os.getenv("NOTION_API_KEY")
supabase_url = os.getenv("SUPABASE_URL") or ""
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""
supabase = create_client(supabase_url, supabase_key)

@router.post("/api/notion/subscribe")
async def subscribe_notion(request: Request):
    body = await request.json()
    user_id = body.get("user_id")
    database_id = body.get("database_id")
    if not user_id or not database_id:
        return {"error": "user_id and database_id required"}

    supabase.table("webhook_integrations").upsert({
        "user_id": user_id,
        "service": "notion",
        "url": None,
        "settings": {"database_id": database_id}
    }, on_conflict=["user_id","service"]).execute()

    return {"status": "subscribed"}

@router.post("/api/notion/event")
async def forward_notion_event(request: Request):
    if not NOTION_API_KEY:
        return {"error": "NOTION_API_KEY not configured"}

    body = await request.json()
    user_id = body.get("user_id")
    event = body.get("event")
    if not user_id or event is None:
        return {"error": "user_id and event required"}

    resp = supabase.table("webhook_integrations").select("settings").eq("user_id", user_id).eq("service", "notion").maybe_single().execute()
    settings = resp.data.get("settings") if resp.data else None
    if not settings:
        return {"error": "no subscription"}

    database_id = settings.get("database_id")
    if not database_id:
        return {"error": "invalid settings"}

    url = "https://api.notion.com/v1/pages"
    headers = {
        "Authorization": f"Bearer {NOTION_API_KEY}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
    }
    payload = {
        "parent": {"database_id": database_id},
        "properties": event
    }
    async with httpx.AsyncClient() as client:
        await client.post(url, json=payload, headers=headers, timeout=10)

    return {"status": "forwarded"}
