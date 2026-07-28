# ADR-001: FormBhar Architecture & Security Overview

## Status
Accepted

## Date
2026-07-28

## Context
FormBhar is an automated AI-powered Google Forms auto-fill system consisting of a Chrome Extension (Manifest V3) and an Express/PostgreSQL backend analytics service hosted on Render.

Key technical requirements:
- MV3 service worker architecture with non-persistent background scripts.
- Multi-provider AI generation support (Google Gemini, OpenAI GPT, Anthropic Claude) via direct provider requests or manual ChatGPT prompt copying.
- Dynamic DOM element matching and shadow root UI encapsulation on Google Forms.
- Observability and security controls across extension storage, REST endpoints, and backend PostgreSQL queries.

## Decision

1. **Manifest V3 Architecture & Message Passing**:
   - Use `background.js` ES module service worker for state management and async session token generation.
   - Encapsulate floating overlay UI within a Shadow DOM root on Google Forms to isolate extension styles from host page styles and CSP rules.

2. **Backend Infrastructure & Hardening**:
   - Express backend hosted on Render (`https://formbhar-backend-7ir1.onrender.com`).
   - Use `helmet` for security HTTP response headers.
   - Enforce origin-restricted CORS allowing `chrome-extension://*`, `localhost`, and official backend URLs.
   - Request correlation tracing via `x-request-id` header attached to structured JSON logs.

3. **Telemetry & Privacy**:
   - Store API keys locally in `chrome.storage.local` (never transmitted to backend analytics).
   - Only log anonymous aggregate metadata (form titles, question counts, execution timestamps) in PostgreSQL.

## Consequences
- High security isolation for user API keys.
- Complete request correlation tracing for on-call debugging in Render logs.
- Smooth Chrome Web Store compliance and CSP safety on `docs.google.com/forms`.
