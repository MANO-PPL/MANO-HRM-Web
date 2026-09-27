# How-To: Verify Redis Cache Connectivity and Database Fallback

> Place this file in /docs/how-to/. This is a HOW-TO (Diataxis) — a recipe
> for someone who already knows the system and needs to get one specific
> thing done. Not a tutorial (no need to explain why), not reference
> (this is action steps, not facts to look up).

## Goal
Verify that the Redis caching layer is operational, measure query speedup factors against MySQL, and confirm that the backend gracefully falls back to direct database queries if Redis becomes unavailable.

## Prerequisites
- Node.js runtime (v20+) installed.
- Local MySQL instance running with `Attendance_DB` accessible on the port configured in `backend/.env`.
- Redis instance running locally (default port 6379) or accessible over network.
- `backend/.env` file present with valid database and Redis connection keys.

## Steps
1. Open a terminal in the repository root directory.
2. Run the cache verification diagnostic script:
   ```bash
   node backend/scripts/diagnostics/verify_cache.js
   ```
   *(Alternatively, navigate to `backend/` and run `node scripts/diagnostics/verify_cache.js`)*
3. Observe the sequential 5-phase test execution:
   - **Phase 1 (Shift Policies)**: Validates cache miss query against MySQL, followed by cache hit retrieval from Redis.
   - **Phase 2 (Work Locations)**: Measures cache hit latency and speedup ratio for geographic site queries.
   - **Phase 3 (Holiday Calendar)**: Measures cache hit latency for organization holiday schedules.
   - **Phase 4 (Invalidation Test)**: Deletes a cache key programmatically and confirms the subsequent request refreshes from the database.
   - **Phase 5 (Resiliency Fallback)**: Injects an offline Redis condition to verify that queries continue to succeed via direct database fallback without unhandled exceptions.

## Verify it worked
- Terminal output concludes with:
  ```text
  ✅ Safe database fallback succeeded. Results count: [N]
  ✅ All API Caching checks completed successfully.
  ```
- Speedup factors for Phases 1–3 report a positive acceleration factor (typically 2x to 10x faster on Redis hit).
- The process exits cleanly with return code `0`.

## Troubleshooting
- **Error: `ECONNREFUSED 127.0.0.1:6379`**:
  Redis server is not running. Start your local Redis service (`redis-server` or `docker start redis`) and re-run.
- **Error: `ECONNREFUSED 127.0.0.1:3307` or `ER_ACCESS_DENIED_ERROR`**:
  MySQL is inaccessible. Check `DB_HOST`, `DB_PORT`, `DB_ADMIN_USER`, and `DB_ADMIN_PASSWORD` in `backend/.env`.
- **Warning: `No users or organizations found in database. Using default org_id = 1`**:
  The database is empty. Seed at least one organization and user into `core_users` / `core_organizations` or run the seed generator before testing cache keys.
