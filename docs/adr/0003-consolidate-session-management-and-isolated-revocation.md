# ADR-0003: Consolidate Session Management and Isolated Device Revocation

> Place this file in /docs/adr/, numbered sequentially (0001, 0002, ...).
> One ADR per significant, hard-to-reverse technical decision.
> Once accepted, an ADR is rarely edited — if the decision changes, write a
> new ADR that supersedes this one, don't rewrite history.

## Status
Accepted

## Context
The Mano platform originally managed user login sessions through a legacy `core_refresh_tokens` table. Over time, features such as SHA-256 token hashing, device fingerprinting, a self-service "Active Devices" interface, and a SuperAdmin diagnostics dashboard were layered on. However, this incremental approach led to severe architectural and operational issues:

1. **Cascading Invalidation Bugs**: Legacy token rotation and reuse-detection logic treated any stale token or single-device logout as a security breach, revoking *all* active refresh tokens for the user. Consequently, logging out on a web browser signed the user out of their mobile application, and mobile network reconnects frequently wiped desktop sessions.
2. **Metadata Packing**: Device fingerprints, client IP history, and operating system attributes were serialised into delimiter-separated strings (`rawUa|||{json}`) inside a generic `user_agent` column, requiring brittle regex and JSON unpacking on every read.
3. **Leaky Domain Boundary & Low Cohesion**: Multiple callers across `authService`, `tokenService`, `superAdminService`, `cleanupScheduler`, and cascade deletion services executed ad-hoc queries against token tables, making auditing, metric collection, and schema changes high-risk.
4. **Password Change Disruption**: Changing a password from a mobile app or web browser invalidated all sessions without preserving the acting device's active session, creating friction and confusing 401 errors.

We required a consolidated, highly cohesive, loosely coupled session management module that supports multi-device workforce operations, provides strict per-device revocation scoping, and isolates session state from all other domains.

## Decision
We consolidate all session persistence, validation, extension, revocation, diagnostics, and cleanup into a dedicated `sessions` table and a unified service boundary (`sessionService.js`).

Key architectural decisions:
1. **Dedicated Database Schema (`sessions`)**:
   - First-class columns for device identity: `token_hash` (64-char SHA-256), `device_id`, `device_name`, `device_type`, `os`, `browser`, `ip_address`, `created_at`, `last_used_at`, `expires_at`, `revoked`, `revoked_at`, `revoked_reason`, `remember_me`, `user_agent`.
   - `core_users(user_id)` foreign key with `ON DELETE CASCADE` to ensure clean lifecycle management.
2. **Strictly Isolated Revocation**:
   - Revoking a session (via user logout, self-service active device removal, or SuperAdmin action) updates `revoked = 1` solely on that specific session ID (`sid`) or token hash.
   - Reuse of an expired or revoked token rejects only the requesting caller with a `401 Unauthorized` without cascading to any other device.
   - `revokeAllSessions()` is the sole path that invalidates multiple sessions, strictly reserved for explicit "Sign out everywhere", account deletion, and password reset workflows (with optional `exceptSessionId` to keep the acting device signed in).
3. **Sliding Session Window with Dynamic IP Migration**:
   - Sessions maintain a 30-day sliding window (`expires_at` extended on active refresh).
   - Dynamic IP changes (e.g. mobile switching from Wi-Fi to LTE) update `ip_address` and `last_used_at` seamlessly without session drops.
4. **Short-Lived Access Token Session Binding (`sid`)**:
   - Short-lived JWT access tokens (15 minutes) embed the session ID claim (`sid`), binding API requests directly to their database session row.
5. **Per-Device Login Deduplication**:
   - Logging in on a device that already possesses an active session updates that device's session row rather than creating orphaned duplicates.
6. **Encapsulated Service Boundary**:
   - All session access is routed exclusively through `sessionService.js`. External services (`authService`, `superAdminService`, cron schedulers) are prohibited from writing raw SQL against `sessions`. `tokenService.js` is retained purely as a backward-compatible delegation facade.

## Alternatives Considered
- **Maintain `core_refresh_tokens` with Additional Columns**: Adding columns to `core_refresh_tokens` was rejected because the legacy table name misrepresents its role as a full session entity, carries technical debt from defunct token rotation schemes, and encourages legacy query patterns across disparate services.
- **Redis-Only Ephemeral Session Storage**: Storing sessions solely in Redis was rejected because the SuperAdmin dashboard and administrative audit requirements necessitate persistent historical queries, status filtering, and cross-table joins with user and organization profiles (`core_users`, `core_organizations`).
- **Universal Revocation on Password Changes**: Forcing a complete logout of all sessions including the acting device was evaluated but rejected: mobile workers updating passwords mid-shift experienced broken session flows. Preserving the acting device (`exceptSessionId`) while revoking all other sessions provides superior usability without compromising security.

## Consequences
- **Centralized Service Boundary**: All session lifecycle rules, device parsing fallbacks, security hashing, and query optimizations reside in one service (`sessionService.js`).
- **Clean Encapsulation**: External modules interact through a clean function interface (`createSession`, `validateSession`, `extendSession`, `revokeSession`, `revokeAllSessions`, `listSessions`, `getSessionMetrics`, `cleanupOldSessions`) with zero direct database queries outside the service.
- **Device Independence**: Logging out on web never logs out mobile devices; mobile network toggling never terminates desktop logins.
- **Auditability**: Revocations record structured metadata (`revoked_at`, `revoked_reason`).
- **Schema Prerequisite**: Requires the `sessions` table in MySQL to store tokens and device state.
