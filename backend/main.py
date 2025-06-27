from fastapi import FastAPI
from backend.api import router
import os
import sentry_sdk

sentry_sdk.init(dsn=os.getenv("SENTRY_DSN"))

app = FastAPI()
app.include_router(router)

