# Pre-Launch Checklist

Every production deployment requires verifying these parameters:

## 1. Code Quality
- [ ] CI/CD pipeline is green (Lint, Test, Audit).
- [ ] No `console.log` statements in the backend (all logs use `pino`).
- [ ] Code is peer-reviewed (or agent-reviewed).

## 2. Security
- [ ] `npm audit` shows zero high/critical vulnerabilities.
- [ ] No secrets are hardcoded in the codebase.
- [ ] Admin endpoints are secured by `ADMIN_API_KEY`.

## 3. Observability
- [ ] `/metrics` endpoint is operational and exporting RED metrics.
- [ ] Structured logs contain `correlationId`.
- [ ] OpenTelemetry is correctly capturing spans.

## 4. Rollback
- [ ] A rollback plan is documented and linked.
- [ ] Feature flags are used for new capabilities to decouple deployment from release.
