from fastapi import APIRouter, Request
from supabase import create_client
import httpx
import os
import logging
from datetime import datetime, timezone

router = APIRouter()
logger = logging.getLogger(__name__)

supabase_url = os.getenv("SUPABASE_URL") or ""
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""

supabase = create_client(supabase_url, supabase_key)


def _credential(creds: dict, snake: str, camel: str) -> str | None:
    value = creds.get(snake)
    if value:
        return value
    return creds.get(camel)


async def _authenticated_user_id(request: Request) -> str:
    authorization = request.headers.get("authorization", "")
    if not authorization.startswith("Bearer "):
        raise ValueError("authentication required")

    access_token = authorization.removeprefix("Bearer ").strip()
    if not access_token:
        raise ValueError("authentication required")

    try:
        response = supabase.auth.get_user(access_token)
        user = getattr(response, "user", None)
        user_id = getattr(user, "id", None)
        if not user_id:
            raise ValueError("invalid session")
        return str(user_id)
    except Exception as exc:
        logger.warning("Rejected platform connection request with invalid session")
        raise ValueError("invalid session") from exc


async def validate_shopify(creds: dict) -> tuple[bool, str | None]:
    url = _credential(creds, "store_url", "storeUrl")
    token = _credential(creds, "access_token", "accessToken")
    if not url or not token:
        return False, "store_url and access_token required"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://{url}/admin/api/2024-01/shop.json",
                headers={"X-Shopify-Access-Token": token},
                timeout=10,
            )
        if resp.status_code == 200:
            return True, None
        return False, f"Shopify responded with status {resp.status_code}"
    except Exception:
        logger.exception("Error validating Shopify store")
        return False, "Shopify validation request failed"


async def validate_woocommerce(creds: dict) -> tuple[bool, str | None]:
    url = _credential(creds, "store_url", "storeUrl")
    key = _credential(creds, "consumer_key", "apiKey")
    secret = _credential(creds, "consumer_secret", "apiSecret")
    if not url or not key or not secret:
        return False, "store_url, consumer_key and consumer_secret required"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{url}/wp-json/wc/v3", auth=(key, secret), timeout=10)
        if resp.status_code == 200:
            return True, None
        return False, f"WooCommerce responded with status {resp.status_code}"
    except Exception:
        logger.exception("Error validating WooCommerce store")
        return False, "WooCommerce validation request failed"


async def validate_ebay(creds: dict) -> tuple[bool, str | None, dict | None]:
    token = _credential(creds, "access_token", "accessToken")
    if not token:
        return False, "access_token required", None

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.ebay.com/commerce/identity/v1/user/",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/json",
                },
                timeout=10,
            )
    except Exception:
        logger.exception("Error validating eBay access token")
        return False, "eBay validation request failed", None

    if resp.status_code != 200:
        return False, f"eBay responded with status {resp.status_code}", None

    try:
        identity = resp.json()
    except ValueError:
        return False, "eBay returned an invalid identity response", None

    external_account_id = (
        identity.get("userId")
        or identity.get("username")
        or identity.get("businessAccount", {}).get("name")
    )
    return True, None, {
        "external_account_id": external_account_id,
        "verified_at": datetime.now(timezone.utc).isoformat(),
        "environment": "production",
    }


validators = {
    "shopify": validate_shopify,
    "woocommerce": validate_woocommerce,
}


@router.post("/api/connect/{platform}")
async def connect_platform(platform: str, request: Request):
    try:
        user_id = await _authenticated_user_id(request)
    except ValueError as exc:
        return {"success": False, "error": str(exc)}

    body = await request.json()
    credentials = body.get("credentials", {})

    if platform == "ebay":
        valid, error, verification = await validate_ebay(credentials)
        if not valid:
            return {"success": False, "error": error or "invalid credentials"}

        token = _credential(credentials, "access_token", "accessToken")
        if not token:
            return {"success": False, "error": "access_token required"}

        try:
            existing = (
                supabase.table("platform_connections")
                .select("id")
                .eq("user_id", user_id)
                .eq("platform_id", "ebay")
                .limit(1)
                .execute()
            )

            metadata = {
                "user_id": user_id,
                "platform_id": "ebay",
                "name": "eBay",
                "type": "marketplace",
                "credentials": {},
                "settings": verification or {},
                "status": "active",
                "connected_at": datetime.now(timezone.utc).isoformat(),
                "disconnected_at": None,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }

            if existing.data:
                connection_id = existing.data[0]["id"]
                (
                    supabase.table("platform_connections")
                    .update(metadata)
                    .eq("id", connection_id)
                    .execute()
                )
            else:
                inserted = (
                    supabase.table("platform_connections")
                    .insert(metadata)
                    .execute()
                )
                if not inserted.data:
                    raise RuntimeError("platform connection was not persisted")
                connection_id = inserted.data[0]["id"]

            (
                supabase.table("platform_connection_secrets")
                .upsert(
                    {
                        "connection_id": connection_id,
                        "access_token": token,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    },
                    on_conflict="connection_id",
                )
                .execute()
            )
        except Exception:
            logger.exception("Failed to save eBay integration")
            return {"success": False, "error": "internal server error"}

        return {
            "success": True,
            "status": "connected",
            "platform": "ebay",
            "verification": verification,
        }

    validator = validators.get(platform)
    if not validator:
        return {"success": False, "error": "unsupported platform"}

    valid, error = await validator(credentials)
    if not valid:
        return {"success": False, "error": error or "invalid credentials"}

    return {
        "success": False,
        "error": f"{platform} persistence is not enabled in this production-safe path",
    }


@router.delete("/api/connect/{platform}")
async def disconnect_platform(platform: str, request: Request):
    try:
        user_id = await _authenticated_user_id(request)
    except ValueError as exc:
        return {"success": False, "error": str(exc)}

    try:
        existing = (
            supabase.table("platform_connections")
            .select("id")
            .eq("user_id", user_id)
            .eq("platform_id", platform)
            .limit(1)
            .execute()
        )

        if not existing.data:
            return {"success": True, "status": "disconnected", "platform": platform}

        connection_id = existing.data[0]["id"]
        (
            supabase.table("platform_connection_secrets")
            .delete()
            .eq("connection_id", connection_id)
            .execute()
        )
        (
            supabase.table("platform_connections")
            .update(
                {
                    "status": "inactive",
                    "credentials": {},
                    "disconnected_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            .eq("id", connection_id)
            .execute()
        )
    except Exception:
        logger.exception("Failed to disconnect platform")
        return {"success": False, "error": "internal server error"}

    return {"success": True, "status": "disconnected", "platform": platform}
