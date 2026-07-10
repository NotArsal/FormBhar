# ADR-002: CI/CD Pipeline and Trunk-Based Development

## Status
Accepted

## Date
2026-07-09

## Context
As the FormBhar project scales, we need to enforce code quality and prevent regressions from reaching production. Previously, deployments were largely manual or lacked pre-merge quality gates, leading to a higher risk of introducing bugs to the main branch.

## Decision
1. **Trunk-Based Development:** All features and fixes must be developed on short-lived branches (1-3 days max) and merged directly into `main`. We will not use long-lived `develop` or `release` branches.
2. **Comprehensive CI Quality Gates:** We implemented GitHub Actions (`.github/workflows/ci.yml`) to enforce:
   - ESLint
   - Jest Unit Tests
   - Integration Tests (against a temporary PostgreSQL container)
   - `npm audit` for security vulnerabilities
3. **Pre-Commit Hooks:** We implemented Husky and `lint-staged` to catch formatting and lint errors locally before they are pushed to the remote repository.

## Alternatives Considered
### GitFlow
- **Pros:** Clear separation of releases and hotfixes.
- **Cons:** High merge conflict overhead, delays integration, reduces deployment frequency.
- **Rejected:** Trunk-based development correlates with higher deployment stability and speed.

## Consequences
- Every PR must pass all CI checks before it can be merged.
- Incomplete features should be merged to `main` hidden behind feature flags rather than kept on long-lived branches.
