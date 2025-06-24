from fastapi import APIRouter
from .stripe_checkout import router as stripe_checkout_router
from .stripe_webhook import router as stripe_webhook_router
from .connect import router as connect_router
from .zapier_webhook import router as zapier_router
from .airtable_webhook import router as airtable_router
from .notion_webhook import router as notion_router

router = APIRouter()
router.include_router(stripe_checkout_router)
router.include_router(stripe_webhook_router)
router.include_router(connect_router)
router.include_router(zapier_router)
router.include_router(airtable_router)
router.include_router(notion_router)
