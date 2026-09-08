"""Central Gemini SDK configuration, shared by every api/* module that calls Gemini.

Configuring the API key here (once, at import time) instead of in each module
avoids import-order bugs where a module calls genai before configure() has run.
"""
from __future__ import annotations

import os

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
genai.configure(api_key=GEMINI_API_KEY)

EMBED_MODEL = "models/text-embedding-004"
GEN_MODEL = "gemini-2.0-flash"
