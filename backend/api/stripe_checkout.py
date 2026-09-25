from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.post("/api/stripe/checkout-session")
async def create_checkout_session():
    """Deprecated legacy endpoint.

    Stripe Checkout is served only by the authenticated Supabase
    `stripe-checkout` Edge Function, which derives the user from the JWT and
    resolves Stripe Price IDs from server-side subscription plan data.
    """
    raise HTTPException(
        status_code=410,
        detail="Legacy Stripe checkout disabled; use the stripe-checkout Edge Function.",
    )
