import os
import logging
import logging.config
from fastapi import FastAPI
from backend.api import router

LOG_DIR = os.getenv("LOG_DIR", "logs")
os.makedirs(LOG_DIR, exist_ok=True)

logging_config = {
    "version": 1,
    "formatters": {
        "json": {
            "()": "logging.Formatter",
            "format": (
                '{"time": "%(asctime)s", "level": "%(levelname)s", '
                '"name": "%(name)s", "message": "%(message)s"}'
            ),
        },
        "standard": {"format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s"},
    },
    "handlers": {
        "file": {
            "class": "logging.FileHandler",
            "formatter": "json",
            "filename": os.path.join(LOG_DIR, "app.log"),
            "level": os.getenv("LOG_LEVEL", "INFO"),
        },
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "standard",
            "level": os.getenv("LOG_LEVEL", "INFO"),
        },
    },
    "root": {"handlers": ["file", "console"], "level": os.getenv("LOG_LEVEL", "INFO")},
}

logging.config.dictConfig(logging_config)

app = FastAPI()
app.include_router(router)
