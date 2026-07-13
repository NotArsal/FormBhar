# ADR-004: Simplify Observability Stack

## Status
Accepted

## Date
2026-07-13

## Context
The FormBhar backend application was previously instrumented with OpenTelemetry (`@opentelemetry/sdk-node`), Prometheus metrics (`prom-client`), and the Pino logging library (`pino`, `pino-http`) as detailed in ADR-001 and ADR-003. 

While these patterns (distributed tracing, RED metrics, high-performance structured logging) are best practices for complex microservices architectures, an audit of the FormBhar extension revealed that this stack is significantly over-engineered for a small backend component that merely logs forms and sessions.

Specifically:
- No Prometheus server is scraping the `/api/metrics` endpoint.
- Distributed tracing over-complicates the network layer for single-hop extension-to-backend requests (via `X-Correlation-ID`).
- The memory and startup overhead of OpenTelemetry is unjustified.
- Standard `console.log` is performant enough for this scale while remaining structured.

## Decision
We are deprecating the speculative observability features to embrace simplicity.

1. **Remove OpenTelemetry and Tracing**: We will remove the `tracing.js` initialization script, associated dependencies, and the generation/passing of `X-Correlation-ID` headers from the extension.
2. **Remove Prometheus Metrics**: We will remove the `prom-client` dependency and the `/api/metrics` endpoint.
3. **Replace Pino with Native Console**: We will use structured JSON logging via the native `console` API (e.g., `console.log(JSON.stringify({ level: 'info', ... }))`).

This ADR supersedes both **ADR-001** and **ADR-003**.

## Consequences
- Significant reduction in backend bundle/dependency size.
- Lower memory footprint and faster application startup.
- Simplified frontend request logic (no correlation ID headers).
- Future metric gathering (if needed) will be done via simple logs parsed by log aggregators, rather than exposing an active `/metrics` scraping endpoint.
