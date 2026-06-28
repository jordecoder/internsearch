from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, field_validator
from slowapi import Limiter
from slowapi.util import get_remote_address

# ── config ────────────────────────────────────────────────────────────────────
_JWT_SECRET = os.environ["JWT_SECRET"]
_JWT_ALGORITHM = "HS256"
_TOKEN_EXPIRE_HOURS = 8
_INVITE_CODE = os.environ["INVITE_CODE"]
_DATABASE_URL = os.getenv("DATABASE_URL")          # Neon/Postgres when set
_DB_PATH = os.getenv("USERS_DB_PATH", "/tmp/internsearch_users.db")  # SQLite fallback

# ── setup ─────────────────────────────────────────────────────────────────────
router = APIRouter()
limiter = Limiter(key_func=get_remote_address)
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)
_bearer = HTTPBearer(auto_error=False)

_CREATE_TABLE = """
    CREATE TABLE IF NOT EXISTS users (
        id {pk},
        username TEXT UNIQUE NOT NULL,
        hashed_password TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
"""


# ── database abstraction ──────────────────────────────────────────────────────
# Supports both Postgres (via DATABASE_URL / Neon free tier) and SQLite
# (local dev). Postgres is recommended in production — it persists across
# Render redeploys, unlike /tmp/internsearch_users.db.

@contextmanager
def _db():
    if _DATABASE_URL:
        import psycopg2
        import psycopg2.extras
        conn = psycopg2.connect(_DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    else:
        Path(_DB_PATH).parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(_DB_PATH)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()


def _exec(conn: Any, sql: str, params: tuple = ()) -> Any:
    if _DATABASE_URL:
        cur = conn.cursor()
        cur.execute(sql.replace("?", "%s"), params)
        return cur
    return conn.execute(sql, params)


def _fetchone(conn: Any, sql: str, params: tuple = ()) -> dict | None:
    if _DATABASE_URL:
        cur = conn.cursor()
        cur.execute(sql.replace("?", "%s"), params)
        row = cur.fetchone()
        return dict(row) if row else None
    row = conn.execute(sql, params).fetchone()
    return dict(row) if row else None


def _init_db() -> None:
    pk = "SERIAL PRIMARY KEY" if _DATABASE_URL else "INTEGER PRIMARY KEY AUTOINCREMENT"
    with _db() as conn:
        _exec(conn, _CREATE_TABLE.format(pk=pk))


_init_db()


# ── helpers ───────────────────────────────────────────────────────────────────
def _create_token(username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=_TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": username, "exp": expire}, _JWT_SECRET, algorithm=_JWT_ALGORITHM)


def _verify_token(token: str) -> str:
    try:
        payload = jwt.decode(token, _JWT_SECRET, algorithms=[_JWT_ALGORITHM])
        username: str | None = payload.get("sub")
        if not username:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return username
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> str:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return _verify_token(credentials.credentials)


# ── schemas ───────────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    username: str
    password: str
    invite_code: str

    @field_validator("username")
    @classmethod
    def username_clean(cls, v: str) -> str:
        v = v.strip().lower()
        if not v or len(v) < 3 or len(v) > 32:
            raise ValueError("Username must be 3–32 characters")
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Username may only contain letters, numbers, hyphens, underscores")
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


# ── routes ────────────────────────────────────────────────────────────────────
@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest) -> dict:
    if body.invite_code != _INVITE_CODE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid invite code")

    hashed = _pwd.hash(body.password)
    now = datetime.now(timezone.utc).isoformat()
    try:
        with _db() as conn:
            _exec(
                conn,
                "INSERT INTO users (username, hashed_password, created_at) VALUES (?, ?, ?)",
                (body.username, hashed, now),
            )
    except Exception as exc:
        msg = str(exc).lower()
        if "unique" in msg or "duplicate" in msg:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")
        raise

    return {"message": "Account created. You can now log in."}


@router.post("/login")
@limiter.limit("5/minute")
def login(request: Request, body: LoginRequest) -> TokenResponse:
    with _db() as conn:
        row = _fetchone(
            conn,
            "SELECT username, hashed_password FROM users WHERE username = ?",
            (body.username.strip().lower(),),
        )

    # Constant-time compare even on miss — prevents username enumeration
    dummy_hash = "$2b$12$" + "x" * 53
    stored_hash = row["hashed_password"] if row else dummy_hash
    valid = _pwd.verify(body.password, stored_hash)

    if not row or not valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    token = _create_token(row["username"])
    return TokenResponse(access_token=token, username=row["username"])


@router.get("/me")
def me(username: Annotated[str, Depends(get_current_user)]) -> dict:
    return {"username": username}
