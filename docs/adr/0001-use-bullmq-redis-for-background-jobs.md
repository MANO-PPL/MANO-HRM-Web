# ADR-0001: Use BullMQ and Redis for Background Asynchronous Processing

> Place this file in /docs/adr/, numbered sequentially (0001, 0002, ...).
> One ADR per significant, hard-to-reverse technical decision.
> Once accepted, an ADR is rarely edited — if the decision changes, write a
> new ADR that supersedes this one, don't rewrite history.

## Status
Accepted

## Context
The Mano platform processes resource-intensive operations including monthly multi-sheet attendance report generation (ExcelJS/PDFMake), image compression and transformation of verification selfies (Sharp), S3 asset uploads, and bulk FCM push notifications. Executing these operations synchronously inside Express HTTP request-response cycles blocks the Node.js single-threaded event loop, introducing severe API latency spikes, Nginx reverse proxy gateway timeouts (504s), and fragile request states for mobile and web clients. We required an asynchronous job queue mechanism that integrates with our AWS-hosted infrastructure and local development environments without significant external complexity.

## Decision
We will use BullMQ backed by Redis to manage durable background queues and execute CPU-heavy tasks asynchronously in dedicated worker processes.

## Alternatives Considered
- **In-Memory Job Processing (Node.js EventEmitter / Background Promises)** — Simple to implement with zero external dependencies; however, jobs are permanently lost during application crashes or PM2 reloads, unhandled task errors crash the server process, and work cannot be throttled or distributed across cluster instances.
- **AWS SQS (Simple Queue Service)** — Fully managed serverless cloud queue with high durability; however, introduces strict cloud vendor lock-in, requires internet connectivity and AWS credentials during local development (or complex LocalStack setups), adds network round-trip latency, and duplicates infrastructure since Redis is already deployed for application caching.

## Consequences
- Fast, non-blocking HTTP endpoints that return immediate acknowledgment (`202 Accepted` or job ID tracking) to users while background workers execute long-running tasks.
- Standardized job retry mechanisms, exponential backoff, dead-letter tracking, and concurrency limits across all background workloads.
- Introduces operational dependency on Redis persistence and memory configuration (`maxRetriesPerRequest: null`).
- Requires running worker handlers alongside the HTTP server or under PM2 in production.
