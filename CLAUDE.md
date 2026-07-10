# FormBhar AI Agent Guidelines

Welcome to FormBhar! When working on this project, please adhere to the following rules:

## 1. Code Quality & Formatting
- **Linting:** The backend uses ESLint. Run `npm run lint` before committing.
- **Pre-commit Hooks:** We use Husky and lint-staged. If your commit fails due to formatting, run `npm run lint --fix`.

## 2. Observability & Logging
- **NO `console.log` or `console.error` in production paths.** 
- **Structured Logging:** Use the `pino` instance (`const logger = require('pino')()`) for all logging.
- **Log Format:** `logger.info({ field: 'value', correlationId: req.correlationId }, 'Action description');`

## 3. Git Workflow
- We use **Trunk-Based Development**. Create short-lived feature branches, keep PRs under 400 lines, and merge quickly.
- Commit messages must follow conventional commits: `feat: add task`, `fix: handle null error`, `refactor: extract logic`.
- Ensure all CI gates pass before merge.

## 4. Launch Readiness
- Use the **Feature Flags** pattern (`backend/featureFlags.js`) to decouple deployment from release.
- Consult `docs/references/pre-launch-checklist.md` before launching a major feature to production.

## Commands
- **Backend Dev:** `cd backend && npm run dev`
- **Backend Test:** `cd backend && npm test`
- **Backend Lint:** `cd backend && npm run lint`
