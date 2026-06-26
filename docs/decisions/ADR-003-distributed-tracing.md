# ADR-003: Distributed Tracing using Correlation IDs

## Status
Accepted

## Date
2026-06-27

## Context
FormBhar relies on an external Node.js backend (`formbhar-backend`) for live statistics, session tracking, and user logging. In production, logs from multiple active users are interleaved in Node/Express logs, making it impossible to debug individual user sessions or trace request failures to database queries:
- If a `/start-session` request fails, the on-call engineer sees an error in server logs but cannot associate it with the specific client-side network error or the underlying SQL database query.
- Telemetry pipelines had no request correlation, making telemetry debugging a guessing game.

## Decision
Implement a lightweight distributed tracing architecture across the extension and backend using correlation IDs:
1. Every API call made by the Chrome Extension background scripts will generate a unique `correlationId` using `crypto.randomUUID()` and attach it as a request header `X-Correlation-ID`.
2. The Express backend will use custom middleware to read or generate the correlation ID, set it on a child Pino logger context (`req.log`), and respond with the same header.
3. Every database query will be run through a `dbQuery(req, query, params)` wrapper which extracts `req.correlationId` and logs the query start, duration, row count, and database errors under the child logger context.

## Alternatives Considered

### OpenTelemetry Node SDK & Collector
- Pros: Complete distributed tracing standard.
- Cons: Introduces significant package bloat (hundreds of KB) to the extension bundle and backend dependencies. Requires setting up an OTel collector backend (Jaeger, Zipkin, etc.), which exceeds current project requirements and budget.

### No Distributed Tracing (Local Debugging Only)
- Pros: Zero code changes.
- Cons: Renders production server logs unqueryable for request/session correlation. High maintenance costs.

## Consequences
- End-to-end trace correlation is established. An engineer can search server logs for a single `correlationId` and see:
  1. The exact incoming HTTP request method, URL, client IP, and User-Agent.
  2. Every database query spawned by that request, including exact duration and rows affected.
  3. The final HTTP response status code and total execution time.
- No heavy runtime dependencies are added; the implementation is written natively using child Pino loggers.
