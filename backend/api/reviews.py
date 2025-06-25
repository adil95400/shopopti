from fastapi import APIRouter, Request, Header
from supabase import create_client
import os

router = APIRouter()

supabase_url = os.getenv("SUPABASE_URL") or ""
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""

supabase = create_client(supabase_url, supabase_key)

@router.get("/api/reviews")
async def get_reviews():
    response = supabase.table("reviews").select("*").order("created_at", desc=True).execute()
    return response.data

@router.post("/api/reviews")
async def create_review(request: Request, authorization: str = Header(None)):
    if not authorization:
        return {"error": "Authorization header required"}
    body = await request.json()
    supabase.table("reviews").insert(body).execute()
    return {"status": "created"}
