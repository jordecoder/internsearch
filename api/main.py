from __future__ import annotations

import os

import sentry_sdk
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from api.auth import router as auth_router, limiter
from api.rag import router as rag_router
from api.tracker import router as tracker_router

load_dotenv()

_SENTRY_DSN = os.getenv("SENTRY_DSN")
if _SENTRY_DSN:
    sentry_sdk.init(
        dsn=_SENTRY_DSN,
        traces_sample_rate=0.05,  # 5% of requests traced — enough signal, low overhead
        profiles_sample_rate=0.05,
        send_default_pii=False,
    )

app = FastAPI(title="Intern Scout API", docs_url=None, redoc_url=None)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_ALLOWED_ORIGIN = os.getenv("ALLOWED_ORIGIN", "https://jordecoder.github.io")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[_ALLOWED_ORIGIN],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(rag_router, prefix="/api", tags=["rag"])
app.include_router(tracker_router, prefix="/api", tags=["tracker"])


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
