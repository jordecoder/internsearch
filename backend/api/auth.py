"""Single-owner auth: the site has exactly one user, identified by
OWNER_PASSWORD. There are no accounts, no registration, and no users database
— logging in with the right password mints a JWT for the fixed OWNER subject,
and every protected endpoint rejects any token whose subject isn't OWNER
(which also invalidates tokens minted for the old multi-user accounts).
"""
import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel, ValidationError
from slowapi import Limiter
from slowapi.util import get_remote_address

# ── config ────────────────────────────────────────────────────────────────────
_JWT_SECRET = os.environ["JWT_SECRET"]
_JWT_ALGORITHM = "HS256"
_TOKEN_EXPIRE_HOURS = 8
_OWNER_PASSWORD = os.environ["OWNER_PASSWORD"]
OWNER = "owner"

# ── setup ─────────────────────────────────────────────────────────────────────
router = APIRouter()
limiter = Limiter(key_func=get_remote_address)
_bearer = HTTPBearer(auto_error=False)


# ── helpers ───────────────────────────────────────────────────────────────────
def _password_matches(candidate: str) -> bool:
    # Compare fixed-length digests so the comparison is constant-time
    # regardless of the candidate's length.
    return hmac.compare_digest(
        hashlib.sha256(candidate.encode()).digest(),
        hashlib.sha256(_OWNER_PASSWORD.encode()).digest(),
    )


def _create_token() -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=_TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": OWNER, "exp": expire}, _JWT_SECRET, algorithm=_JWT_ALGORITHM)


def _verify_token(token: str) -> str:
    try:
        payload = jwt.decode(token, _JWT_SECRET, algorithms=[_JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    if payload.get("sub") != OWNER:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return OWNER


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> str:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return _verify_token(credentials.credentials)


# ── schemas ───────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


async def _parse_json_body(request: Request, model: type[BaseModel]):
    """Reads and validates the body via Request.json() instead of a plain
    Pydantic body-parameter, which FastAPI only auto-parses for
    Content-Type: application/json specifically. That header is what forces a
    CORS preflight (OPTIONS) on the login call — some networks mishandle
    preflight even when plain GET/POST works fine, which broke this exact
    endpoint for at least one user despite CORS being configured correctly.
    Request.json() parses JSON regardless of the declared Content-Type, so the
    frontend can send login as a CORS-safelisted "simple request" (no
    preflight at all) by just not setting that header.
    """
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Request body must be valid JSON")
    try:
        return model(**data)
    except ValidationError as exc:
        # exc.errors() isn't JSON-safe as-is (a validator's raw exception can
        # land in "ctx"). Keep only the string fields the frontend reads.
        safe_errors = [
            {"type": e.get("type"), "loc": list(e.get("loc", [])), "msg": e.get("msg")} for e in exc.errors()
        ]
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=safe_errors)


# ── routes ────────────────────────────────────────────────────────────────────
@router.post("/login")
@limiter.limit("5/minute")
async def login(request: Request) -> TokenResponse:
    body: LoginRequest = await _parse_json_body(request, LoginRequest)
    if not _password_matches(body.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect password")
    return TokenResponse(access_token=_create_token(), username=OWNER)


@router.get("/me")
def me(username: Annotated[str, Depends(get_current_user)]) -> dict:
    return {"username": username}
