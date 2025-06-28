from fastapi import APIRouter, Request, Header
import stripe
import os
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
endpoint_secret = os.getenv("STRIPE_WEBHOOK_SECRET")


@router.post("/api/stripe/webhook")
async def stripe_webhook(request: Request, stripe_signature: str = Header(None)):
    payload = await request.body()
    try:
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, endpoint_secret
        )
    except stripe.error.SignatureVerificationError:
        logger.exception("Invalid Stripe signature")
        return {"error": "Signature invalide"}
    except Exception:
        logger.exception("Failed to parse Stripe webhook payload")
        return {"error": "invalid payload"}

    try:
        if event["type"] == "checkout.session.completed":
            session = event["data"]["object"]
            stripe_customer = session.get("customer")
            stripe_subscription = session.get("subscription")
            user_id = session.get("metadata", {}).get("user_id")
            plan = (
                session.get("display_items", [{}])[0]
                .get("plan", {})
                .get("nickname", "unknown")
            )

            from supabase import create_client

            supabase_url = os.getenv("SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            supabase = create_client(supabase_url, supabase_key)

            supabase.table("subscriptions").insert(
                {
                    "user_id": user_id,
                    "stripe_customer_id": stripe_customer,
                    "stripe_subscription_id": stripe_subscription,
                    "plan": plan,
                    "status": "active",
                }
            ).execute()

        elif event["type"] in [
            "customer.subscription.deleted",
            "invoice.payment_failed",
        ]:
            subscription = event["data"]["object"]
            stripe_subscription_id = subscription.get("id")

            from supabase import create_client

            supabase_url = os.getenv("SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            supabase = create_client(supabase_url, supabase_key)

            supabase.table("subscriptions").update({"status": "canceled"}).eq(
                "stripe_subscription_id",
                stripe_subscription_id,
            ).execute()
        else:
            logger.info("Unhandled Stripe event type: %s", event["type"])
    except Exception:
        logger.exception("Error handling Stripe webhook event")
        return {"error": "internal server error"}

    return {"received": True}
