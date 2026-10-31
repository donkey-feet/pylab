# Project Summary

# Architecture

(TBD by planner)

# Conventions

(TBD)

# Commands

(TBD)

# Domain Rules
- API key goes in the X-API-Key header. OAuth 2.0 is required for private inventory and any mutation (equip, transfer, lock). Secrets and tokens stay server-side, never in the client bundle or the repo.
- Item definitions come from the Destiny manifest. Cache by manifest version; never fetch definitions per request.
- Respect rate limits: batch, cache, back off. Handle API error codes and maintenance windows.
- Mutating actions run only on explicit user action, with error handling, reversible where possible.
- Never invent Bungie endpoints or fields. Mark UNVERIFIED if unsure.

# Do-Not-Touch

# Changelog

Smoke test complete.
