"""Loading .env here — instead of in main.py — guarantees it happens before ANY
api.* submodule is imported. main.py imports api.auth (which reads
os.environ["JWT_SECRET"] at module level) before it gets to calling
load_dotenv() itself, so on a host that sets real env vars natively (Render:
dashboard-configured vars are injected into the process before Python even
starts) this was never a problem — but on a host relying on a .env file
(PythonAnywhere), that import order would crash before dotenv ever loaded.
Python runs a package's __init__.py before any of its submodules, so this is
the one place that's guaranteed to run first regardless of which api.*
submodule gets imported first.
"""
from pathlib import Path

from dotenv import load_dotenv

# Explicit path (not just load_dotenv()'s default cwd-relative search) so this
# finds the repo-root .env regardless of the WSGI process's working directory —
# PythonAnywhere doesn't guarantee that's the project directory the way a
# `cd backend && uvicorn ...` startCommand does on Render. No-ops harmlessly if
# the file doesn't exist (e.g. on Render, which sets real env vars instead).
_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path=_ENV_PATH)
