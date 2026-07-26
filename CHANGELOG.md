# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
