"""WSGI entrypoint for PythonAnywhere's free tier (WSGI-only — no native ASGI hosting).

PythonAnywhere's web app config file should end with:

    from api.wsgi import application

with this project's `backend/` directory on the path (PythonAnywhere's "Code" /
working directory setting) — everything else in this app (main.py, auth.py,
etc.) is unchanged and still runs as normal FastAPI/ASGI underneath.
"""
from a2wsgi import ASGIMiddleware

from api.main import app as _asgi_app

application = ASGIMiddleware(_asgi_app)
