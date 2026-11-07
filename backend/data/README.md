# data/

`readytalent_inbox.json` is written by the **ReadyTalent Job Watch** Chrome extension, not by hand.

It is an AES-256-GCM encrypted snapshot of the open listings on SIT ReadyTalent (a login-gated portal). This repo is public, so the listings are never stored here in plain text. `sources/readytalent.py` decrypts the file during pipeline runs using the `READYTALENT_INBOX_KEY` Actions secret. That secret must hold the same key shown in the extension's settings.
