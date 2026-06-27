# ADR-004: CI/CD Pipeline and Automated Quality Gates

## Status
Accepted

## Date
2026-06-27

## Context
FormBhar's codebase consists of a Chrome Extension and an Express backend. As the project expands, manually testing changes or verifying that syntax errors or code regressions are not introduced becomes error-prone and slow.
We need automated quality gates to ensure that every pull request or push to the `main` branch:
- Build is clean and free of syntax errors.
- Code matches linting specifications.
- Unit tests run successfully and all assertions pass.

## Decision
Establish a GitHub Actions CI pipeline in `.github/workflows/ci.yml`. The workflow runs on every push and pull request to the `main` branch. 
To support this:
1. Set up a modern test runner in the backend using `jest` and `supertest` for Express endpoint validation.
2. Install `eslint` as a devDependency in the backend and configure standard CommonJS recommended rules.
3. Configure the CI action to run on Node 22.x to install dependencies, run linter checks (`npm run lint`), and run unit tests (`npm test`).

## Alternatives Considered

### Built-in node:test Runner
- Pros: Zero dependencies, extremely fast execution.
- Cons: Lacks robust ecosystem tools, snapshot testing, and elegant mocking utilities built-in for things like the PostgreSQL Pool connection which we heavily rely on for backend database operations. We opted for Jest to easily mock our database pool.

### Pre-commit Hooks (Husky + lint-staged)
- Pros: Prevents bad code from being committed.
- Cons: Can feel intrusive to developers during local experimentation. We will recommend local npm script execution but mandate server-side GitHub Actions CI as the definitive gate.

## Consequences
- No broken commits can merge into `main`.
- Continuous integration runtime stays extremely fast (typically < 10 seconds total).
- Development feedback loop is automated.
