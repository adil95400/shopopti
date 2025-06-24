from fastapi import FastAPI
from backend.api import router
import logging
import logging.config
import json
import os
from pathlib import Path


class JsonFormatter(logging.Formatter):
    """Simple JSON log formatter."""

    def format(self, record: logging.LogRecord) -> str:  # type: ignore[override]
        log_record = {
            "level": record.levelname,
            "name": record.name,
            "message": record.getMessage(),
            "time": self.formatTime(record, self.datefmt),
        }
        if record.exc_info:
            log_record["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(log_record)


log_file = os.getenv("APP_LOG_FILE", "backend/app.log")
Path(log_file).parent.mkdir(parents=True, exist_ok=True)

logging.config.dictConfig(
    {
        "version": 1,
        "formatters": {
            "json": {
                "()": JsonFormatter,
            }
        },
        "handlers": {
            "file": {
                "class": "logging.FileHandler",
                "filename": log_file,
                "formatter": "json",
                "level": "INFO",
            }
        },
        "root": {"handlers": ["file"], "level": "INFO"},
    }
)

app = FastAPI()
app.include_router(router)
