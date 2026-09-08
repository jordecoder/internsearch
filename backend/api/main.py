import os

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

# api/__init__.py loads .env before this or any other api.* submodule runs —
# see the comment there for why it has to happen at the package level rather
# than here.
from api.auth import router as auth_router, limiter
from api.generate import router as generate_router
from api.interview import router as interview_router
from api.rag import router as rag_router
from api.tracker import router as tracker_router

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
app.include_router(generate_router, prefix="/api", tags=["generate"])
app.include_router(interview_router, prefix="/api", tags=["interview"])


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
