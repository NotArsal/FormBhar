# FormBhar Production Launch & Operations Checklist (v2.5.0)

## 1. Extension Verification (Chrome Web Store)
- [x] Manifest V3 compliance in `extension/manifest.json` (version `2.5.0`).
- [x] Service Worker (`extension/background/background.js`) contains try/catch handlers and `chrome.runtime.lastError` checking on messaging ports.
- [x] Content scripts (`domObserver.js`, `formFiller.js`, `formReader.js`) obey Google Forms CSP without inline script/external font link injections.
- [x] Provider Manager (`extension/providers/providerManager.js`) supports OpenAI `gpt-4o-mini`, Gemini `gemini-2.5-flash` (header `x-goog-api-key`), and Claude `claude-3-5-haiku-latest`.

## 2. Backend & API Hardening (Render)
- [x] Host URL configured: `https://formbhar-backend-7ir1.onrender.com`.
- [x] HTTP Security headers enforced via `helmet`.
- [x] CORS origin validation matching `chrome-extension://*`, `localhost`, and `https://formbhar-backend-7ir1.onrender.com`.
- [x] Health check endpoint active at `/health`.
- [x] PostgreSQL connection pool configured for SSL connections.
- [x] Rate limiting active (`express-rate-limit` 100 requests per 15-minute window).

## 3. Operations, Observability & ADRs
- [x] Architecture Decision Record created: [ADR-001](file:///d:/Projects/FormBhar/FormBhar/docs/adr/0001-architecture-overview-and-security.md).
- [x] Request correlation ID (`x-request-id`) header tracking integrated across Express endpoints and PostgreSQL query logs.
- [x] Daily automated cleanup job running for expired sessions (`> 30 days`) and stale logs (`> 90 days`).
- [x] Continuous Integration pipeline running on GitHub Actions (`.github/workflows/ci.yml`).
- [x] Zero high-severity security vulnerabilities (`npm audit --omit=dev --audit-level=high`).
