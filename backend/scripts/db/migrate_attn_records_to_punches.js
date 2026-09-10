import { attendanceDB } from '../../src/config/database.js';

/**
 * Parses JSON safely from string, object, or null
 */
function safeParseJSON(val) {
  if (!val) return {};
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return {};
  }
}

/**
 * Format bytes to readable string
 */
function formatMemory() {
  const mem = process.memoryUsage().heapUsed / 1024 / 1024;
  return `${mem.toFixed(1)} MB`;
}

/**
 * Format duration in seconds / minutes
 */
function formatDuration(ms) {
  const sec = (ms / 1000).toFixed(2);
  return `${sec}s`;
}

async function runMigration() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const shouldClean = args.includes('--clean');
  const batchSizeArg = args.find(a => a.startsWith('--batch-size='));
  const BATCH_SIZE = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : 500;

  console.log('================================================================');
  console.log('           ATTENDANCE DATA MIGRATION: RECORDS -> PUNCHES        ');
  console.log('================================================================');
  console.log(` Mode:        ${isDryRun ? '🔍 DRY RUN (No writes)' : '🚀 LIVE MIGRATION'}`);
  console.log(` Batch Size:  ${BATCH_SIZE}`);
  console.log(` Timestamp:   ${new Date().toISOString()}`);
  console.log('================================================================\n');

  const startTime = Date.now();

  try {
    // 1. Initial Checks & Stats
    const [{ totalLegacy }] = await attendanceDB('attn_records').count('* as totalLegacy');
    const [{ validSessions }] = await attendanceDB('attn_records').whereNotNull('time_in').count('* as validSessions');
    const [{ existingPunches }] = await attendanceDB('attn_punches').count('* as existingPunches');

    console.log(`[INIT] Legacy 'attn_records' total rows:       ${totalLegacy}`);
    console.log(`[INIT] Valid sessions (time_in NOT NULL):     ${validSessions}`);
    console.log(`[INIT] Existing rows in 'attn_punches':       ${existingPunches}`);

    // Check if previous migrated punches exist
    const [{ migratedCount }] = await attendanceDB('attn_punches')
      .whereRaw("JSON_EXTRACT(metadata, '$.migrated') = true")
      .count('* as migratedCount');

    console.log(`[INIT] Previously migrated punches detected:  ${migratedCount}`);

    // Handle --clean flag
    if (shouldClean && !isDryRun) {
      if (migratedCount > 0) {
        console.log(`\n[CLEAN] ⚠️ Removing ${migratedCount} previously migrated punches...`);
        await attendanceDB('attn_punches')
          .whereRaw("JSON_EXTRACT(metadata, '$.migrated') = true")
          .del();
        console.log('[CLEAN] Clean completed successfully.\n');
      }
    } else if (migratedCount > 0 && !isDryRun) {
      console.log(`\n[WARNING] Found existing migrated records. If you want to overwrite, rerun with --clean.`);
      console.log(`[WARNING] Continuing will insert new punch rows alongside existing data.\n`);
    }

    if (validSessions === 0) {
      console.log('⚠️ No valid legacy records to migrate. Exiting.');
      await attendanceDB.destroy();
      return;
    }

    // 2. Migration Loop
    let offset = 0;
    let totalProcessedRecords = 0;
    let totalInPunches = 0;
    let totalOutPunches = 0;
    let totalFabricated = 0;
    let totalOpenSessions = 0;
    const migrationTimestamp = new Date().toISOString();

    console.log('\n--- Processing Batches ---');

    while (true) {
      const batchStartTime = Date.now();

      // Fetch batch ordered by user_id and time_in
      const records = await attendanceDB('attn_records')
        .whereNotNull('time_in')
        .orderBy('user_id', 'asc')
        .orderBy('time_in', 'asc')
        .limit(BATCH_SIZE)
        .offset(offset);

      if (!records || records.length === 0) break;

      const punchEvents = [];

      for (const rec of records) {
        const legacyMeta = safeParseJSON(rec.metadata);
        const timeInMeta = legacyMeta.time_in || {};
        const timeOutMeta = legacyMeta.time_out || {};
        const isFabricated = Boolean(rec.altered_by);
        const punchNature = isFabricated ? 'fabricated' : 'default';

        if (isFabricated) totalFabricated += 1;

        // -------------------------------------------------------------
        // PUNCH 1: IN Event
        // -------------------------------------------------------------
        const inLocation = {
          lat: rec.time_in_lat !== null ? parseFloat(rec.time_in_lat) : null,
          lng: rec.time_in_lng !== null ? parseFloat(rec.time_in_lng) : null,
          address: (rec.time_in_address && rec.time_in_address.trim().length > 0) ? rec.time_in_address : null,
          is_geofence_violation: false,
        };

        const inMetadata = {
          image_key: rec.time_in_image_key || null,
          accuracy: timeInMeta.accuracy ?? null,
          ip_address: timeInMeta.ip_address ?? null,
          user_agent: timeInMeta.user_agent ?? null,
          timezone: timeInMeta.timezone || 'Asia/Kolkata',
          late_reason: rec.late_reason || timeInMeta.late_reason || legacyMeta.late_reason || null,
          // Traceability Provenance
          legacy_attendance_id: rec.attendance_id,
          migrated: true,
          migrated_at: migrationTimestamp,
        };

        punchEvents.push({
          user_id: rec.user_id,
          punch_time: rec.time_in,
          punch_type: 'in',
          location: JSON.stringify(inLocation),
          punch_nature: punchNature,
          correction_id: null,
          metadata: JSON.stringify(inMetadata),
          created_at: rec.created_at || rec.time_in,
          deleted_at: null,
        });
        totalInPunches += 1;

        // -------------------------------------------------------------
        // PUNCH 2: OUT Event (if time_out exists)
        // -------------------------------------------------------------
        if (rec.time_out) {
          const outLocation = {
            lat: rec.time_out_lat !== null ? parseFloat(rec.time_out_lat) : null,
            lng: rec.time_out_lng !== null ? parseFloat(rec.time_out_lng) : null,
            address: (rec.time_out_address && rec.time_out_address.trim().length > 0) ? rec.time_out_address : null,
            is_geofence_violation: false,
          };

          const outMetadata = {
            image_key: rec.time_out_image_key || null,
            accuracy: timeOutMeta.accuracy ?? null,
            ip_address: timeOutMeta.ip_address ?? null,
            user_agent: timeOutMeta.user_agent ?? null,
            timezone: timeOutMeta.timezone || 'Asia/Kolkata',
            // Traceability Provenance
            legacy_attendance_id: rec.attendance_id,
            migrated: true,
            migrated_at: migrationTimestamp,
          };

          punchEvents.push({
            user_id: rec.user_id,
            punch_time: rec.time_out,
            punch_type: 'out',
            location: JSON.stringify(outLocation),
            punch_nature: punchNature,
            correction_id: null,
            metadata: JSON.stringify(outMetadata),
            created_at: rec.updated_at || rec.time_out,
            deleted_at: null,
          });
          totalOutPunches += 1;
        } else {
          totalOpenSessions += 1;
        }
      }

      // Sort punches to maintain strict user flip-flop stream
      punchEvents.sort((a, b) => {
        if (a.user_id !== b.user_id) return a.user_id - b.user_id;
        return new Date(a.punch_time) - new Date(b.punch_time);
      });

      // Insert in transaction per batch (if not dry run)
      if (!isDryRun && punchEvents.length > 0) {
        await attendanceDB.transaction(async (trx) => {
          await trx('attn_punches').insert(punchEvents);
        });
      }

      totalProcessedRecords += records.length;
      offset += BATCH_SIZE;

      const batchDuration = Date.now() - batchStartTime;
      const progressPct = ((totalProcessedRecords / validSessions) * 100).toFixed(1);

      console.log(
        `[CHECKPOINT] ${progressPct}% | Records: ${totalProcessedRecords}/${validSessions} | ` +
        `Punches Built: ${punchEvents.length} | Batch Time: ${batchDuration}ms | Heap: ${formatMemory()}`
      );
    }

    const totalDuration = Date.now() - startTime;

    // 3. Final Verification & Summary Report
    console.log('\n================================================================');
    console.log('                   MIGRATION SUMMARY REPORT                     ');
    console.log('================================================================');
    console.log(` Execution Status:     ${isDryRun ? 'DRY RUN COMPLETE' : 'COMPLETED SUCCESSFULLY'}`);
    console.log(` Total Time Elapsed:   ${formatDuration(totalDuration)}`);
    console.log(` Sessions Processed:   ${totalProcessedRecords}`);
    console.log(`   ├─ Completed:       ${totalProcessedRecords - totalOpenSessions}`);
    console.log(`   └─ Open (No Out):   ${totalOpenSessions}`);
    console.log(` Total Punches Created:${totalInPunches + totalOutPunches}`);
    console.log(`   ├─ IN Punches:      ${totalInPunches}`);
    console.log(`   └─ OUT Punches:     ${totalOutPunches}`);
    console.log(` Fabricated / Altered: ${totalFabricated}`);
    console.log('----------------------------------------------------------------');

    if (!isDryRun) {
      const [{ finalPunchCount }] = await attendanceDB('attn_punches').count('* as finalPunchCount');
      const [{ finalMigratedCount }] = await attendanceDB('attn_punches')
        .whereRaw("JSON_EXTRACT(metadata, '$.migrated') = true")
        .count('* as finalMigratedCount');

      console.log(` DB Verification:`);
      console.log(`   Total rows in 'attn_punches':          ${finalPunchCount}`);
      console.log(`   Total verified migrated punches:       ${finalMigratedCount}`);
    } else {
      console.log(` ℹ️ Dry-run mode: No rows were inserted into 'attn_punches'.`);
    }
    console.log('================================================================\n');

  } catch (error) {
    console.error('\n❌ [ERROR] Migration aborted due to an error:');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await attendanceDB.destroy();
  }
}

runMigration();
