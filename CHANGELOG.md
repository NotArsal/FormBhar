# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.6.0] - 2026-09-08

### Added
- **Self-Improvement & Adaptive Dual-Layer Memory Engine**: Inspired by Claude Code Auto Memory and OpenClaw daily log/dreaming pass patterns. Real-time DOM correction capture and heuristic confidence gate promotion ($\ge 0.8$).
- **Interactive Editable Memory UI**: View, inline-edit, delete, or manually create custom question-answer field mappings directly in the Chrome extension popup.
- **Groq AI Provider Support**: Integrated Groq API endpoint with high-speed response generation alongside OpenAI, Gemini, and Claude.
- **AI Health & Latency Telemetry**: Dynamic provider ranking based on real-time latency and error tracking for intelligent automatic failover.
- **Multi-Member/Team Disambiguation**: Improved field match resolution for form fields with numbered member labels (e.g. `Student 1 Name`, `Student 2 Name`).
- **Architecture Documentation**: Documented ADR-005 (`ADR-005-adaptive-dual-layer-memory-engine.md`) in `docs/decisions/`.

## [2.5.0] - 2026-07-26

### Fixed
- Fixed multi-tab session key race conditions by dynamically keying storage sessions by ID (`session_${sessionId}`).
- Fixed open message port hanging issues by wrapping background message listeners in try-catch blocks.
- Fixed unchecked `chrome.runtime.lastError` exceptions across background and popup message callers.
- Removed Google Fonts external CSS injection from Shadow DOM to comply with Google Forms Content Security Policy.
- Resolved autonomous fill page-load race condition using dynamic DOM readiness polling.
- Expanded ChatGPT answer paste regex pattern matching to support arbitrary list delimiters (`.`, `)`, `:`, `-`, `]`).
- Sanitized history link URLs to only permit secure `http://` / `https://` protocols.
- Fixed backend IP address parameter fallback in `/api/start-session` to prevent database binding errors.
- Handled non-existent/expired sessions in `/api/ping` with HTTP 404 responses to auto-clear stale extension session IDs.

### Added
- Added `nodemon` to backend `devDependencies`.
- Improved mock PG pool handling in backend tests for precise calculation verification.
