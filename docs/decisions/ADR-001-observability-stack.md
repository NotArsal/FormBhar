# ADR-001: Implement Structured Logging and OpenTelemetry

## Status
Accepted

## Date
2026-07-09

## Context
FormBhar needs a robust observability strategy to allow rapid diagnosis of production issues. Previously, the backend used basic string-based logging (`console.log`, `console.error`) which is difficult to query, lacks correlation context (request IDs), and does not provide systemic insights into latency or throughput.

## Decision
1. Replace all string-based `console.log/error` calls with structured JSON logging using **Pino**.
2. Inject an `x-request-id` into all logs for distributed correlation.
3. Use **prom-client** to expose RED metrics (Rate, Error, Duration) via a `/metrics` endpoint.
4. Integrate **OpenTelemetry SDK** (`@opentelemetry/sdk-node`) for distributed tracing and auto-instrumentation.

## Alternatives Considered

### Datadog APM (Agent)
- **Pros:** Turn-key solution, comprehensive.
- **Cons:** Vendor lock-in, expensive for a small project.
- **Rejected:** OpenTelemetry is vendor-neutral and completely free, offering the same level of insight without lock-in.

### Morgan (Express Logger)
- **Pros:** Easy to set up for HTTP requests.
- **Cons:** Only handles HTTP boundary; does not help with internal service logs or DB logs.
- **Rejected:** We need structured logging everywhere, not just at the HTTP edge.

## Consequences
- Requires running a Prometheus instance or compatible scraper in the deployment environment to ingest `/metrics`.
- Modifies our logging convention. All developers must now use `logger.info({ field: 'value' }, 'Message')` instead of `console.log`.
