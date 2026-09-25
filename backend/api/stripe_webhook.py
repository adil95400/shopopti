from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.post("/api/stripe/webhook")
async def stripe_webhook():
    """Deprecated legacy endpoint.

    Stripe webhooks are processed only by the Supabase `stripe-webhook` Edge
    Function, which verifies the Stripe signature against the raw request body
    and persists events idempotently.
    """
    raise HTTPException(
        status_code=410,
        detail="Legacy Stripe webhook disabled; use the stripe-webhook Edge Function.",
    )
