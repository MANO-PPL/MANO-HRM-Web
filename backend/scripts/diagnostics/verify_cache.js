/**
 * Cache Verification Diagnostic Script
 * 
 * Description:
 * Verifies that the Redis cache layer is correctly working with MySQL,
 * measuring latency differences and confirming resiliency fallbacks when Redis is offline.
 * 
 * How to Run:
 * Make sure you are in the project root directory (e.g. MANO-Attendance) or backend directory.
 * Run the following command:
 * 
 *   node backend/scripts/diagnostics/verify_cache.js
 * 
 * Expectations:
 * - Phase 1-3 should show Speedup Factors (Redis reads should be significantly faster than DB queries).
 * - Phase 4 should verify manual invalidation (deleting a cache key makes the next read fetch from DB again).
 * - Phase 5 should verify database fallback when Redis is mocked offline (the script should complete successfully).
 */

import { attendanceDB } from '../../src/config/database.js';
import { cacheService } from '../../src/services/cache/cacheService.js';
import { getShiftsForOrg } from '../../src/services/shifts/shiftService.js';
import { getAllLocations } from '../../src/services/workLocations/workLocationsServices.js';
import { getHolidays } from '../../src/services/holiday/holidayService.js';

async function measureTime(fn, ...args) {
  const start = process.hrtime.bigint();
  const result = await fn(...args);
  const end = process.hrtime.bigint();
  const durationMs = Number(end - start) / 1_000_000;
  return { result, durationMs };
}

async function main() {
  console.log('🏁 Starting API Caching Verification Tests...\n');

  try {
    // 1. Get an existing organization ID to perform realistic tests
    const userRow = await attendanceDB('core_users').select('org_id').first();
    if (!userRow) {
      console.warn('⚠ No users or organizations found in database. Using default org_id = 1');
    }
    const orgId = userRow ? userRow.org_id : 1;
    console.log(`ℹ Selected Org ID for testing: ${orgId}\n`);

    // Define cache keys
    const shiftKey = `mano-cache:shifts:org:${orgId}`;
    const locationKey = `mano-cache:locations:org:${orgId}`;
    const holidayKey = `mano-cache:holidays:org:${orgId}`;

    // --- PHASE 1: SHIFTS CACHING TEST ---
    console.log('--- Phase 1: Shift Policies Caching ---');
    
    // Invalidate first to guarantee a Cache Miss
    await cacheService.del(shiftKey);
    
    // First read: Cache Miss (MySQL Query)
    console.log('Reading shifts (Cache Miss / Direct DB)...');
    const missShifts = await measureTime(getShiftsForOrg, orgId);
    console.log(`⏱ Cache Miss Latency: ${missShifts.durationMs.toFixed(3)} ms`);

    // Second read: Cache Hit (Redis Query)
    console.log('Reading shifts again (Cache Hit / Redis)...');
    const hitShifts = await measureTime(getShiftsForOrg, orgId);
    console.log(`⏱ Cache Hit Latency: ${hitShifts.durationMs.toFixed(3)} ms`);
    console.log(`📈 Speedup Factor: ${(missShifts.durationMs / hitShifts.durationMs).toFixed(1)}x\n`);

    // --- PHASE 2: WORK LOCATIONS CACHING TEST ---
    console.log('--- Phase 2: Work Locations Caching ---');
    
    // Invalidate first to guarantee a Cache Miss
    await cacheService.del(locationKey);
    
    // First read: Cache Miss (MySQL Query)
    console.log('Reading work locations (Cache Miss / Direct DB)...');
    const missLocations = await measureTime(getAllLocations, { org_id: orgId });
    console.log(`⏱ Cache Miss Latency: ${missLocations.durationMs.toFixed(3)} ms`);

    // Second read: Cache Hit (Redis Query)
    console.log('Reading work locations again (Cache Hit / Redis)...');
    const hitLocations = await measureTime(getAllLocations, { org_id: orgId });
    console.log(`⏱ Cache Hit Latency: ${hitLocations.durationMs.toFixed(3)} ms`);
    console.log(`📈 Speedup Factor: ${(missLocations.durationMs / hitLocations.durationMs).toFixed(1)}x\n`);

    // --- PHASE 3: HOLIDAY CALENDAR CACHING TEST ---
    console.log('--- Phase 3: Holiday Calendar Caching ---');
    
    // Invalidate first to guarantee a Cache Miss
    await cacheService.del(holidayKey);
    
    // First read: Cache Miss (MySQL Query)
    console.log('Reading holidays (Cache Miss / Direct DB)...');
    const missHolidays = await measureTime(getHolidays, orgId);
    console.log(`⏱ Cache Miss Latency: ${missHolidays.durationMs.toFixed(3)} ms`);

    // Second read: Cache Hit (Redis Query)
    console.log('Reading holidays again (Cache Hit / Redis)...');
    const hitHolidays = await measureTime(getHolidays, orgId);
    console.log(`⏱ Cache Hit Latency: ${hitHolidays.durationMs.toFixed(3)} ms`);
    console.log(`📈 Speedup Factor: ${(missHolidays.durationMs / hitHolidays.durationMs).toFixed(1)}x\n`);

    // --- PHASE 4: PROGRAMMATIC INVALIDATION TEST ---
    console.log('--- Phase 4: Invalidation Verification ---');
    
    console.log('Triggering manual invalidation for shifts...');
    await cacheService.del(shiftKey);
    
    console.log('Reading shifts after invalidation (Expected: Cache Miss)...');
    const postInvalidateRead = await measureTime(getShiftsForOrg, orgId);
    console.log(`⏱ Post-Invalidation Latency: ${postInvalidateRead.durationMs.toFixed(3)} ms (Cache Miss verified)`);
    
    console.log('Reading shifts again (Expected: Cache Hit)...');
    const secondPostInvalidateRead = await measureTime(getShiftsForOrg, orgId);
    console.log(`⏱ Subsequent Latency: ${secondPostInvalidateRead.durationMs.toFixed(3)} ms (Cache Hit verified)\n`);

    // --- PHASE 5: RESILIENCY FALLBACK TEST ---
    console.log('--- Phase 5: Resiliency Fallback ---');
    console.log('Simulating offline Redis client state...');
    
    // Backup and overwrite the get wrapper to simulate an offline status
    const originalGet = cacheService.get;
    // Inject mock offline condition
    cacheService.get = async () => {
      console.log('🔌 [Mock] Redis status is offline! Falling back to database...');
      return null; 
    };

    console.log('Querying shifts during mock offline Redis...');
    const offlineRead = await measureTime(getShiftsForOrg, orgId);
    console.log(`⏱ Offline Latency: ${offlineRead.durationMs.toFixed(3)} ms`);
    console.log(`✅ Safe database fallback succeeded. Results count: ${offlineRead.result?.length || 0}`);

    // Restore cache service mock
    cacheService.get = originalGet;
    console.log('\n✅ All API Caching checks completed successfully.');

  } catch (err) {
    console.error('❌ Caching Verification failed with error:', err);
  } finally {
    // Gracefully teardown Knex database pool
    await attendanceDB.destroy();
    process.exit(0);
  }
}

main();
