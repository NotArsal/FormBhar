# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive CI/CD pipeline using GitHub Actions (Lint, Test, Audit, Integration).
- Dependabot configuration for automated dependency updates.
- Trunk-based development pre-commit hooks via Husky and lint-staged.
- Feature Flags utility (`backend/featureFlags.js`) to decouple deployment from release.
- Pre-launch checklist and rollback plan templates.

### Changed
- Replaced `console.error` and `console.log` in backend with high-performance structured JSON logging.
- Fixed backend database race condition on `/api/log-form` (Security & Hardening Audit).
- Simplified system architecture by removing heavy OpenTelemetry, Pino, and Prometheus overhead (ADR-004).
