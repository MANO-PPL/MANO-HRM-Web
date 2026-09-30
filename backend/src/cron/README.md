# Scheduled Cron Jobs (`src/cron/`)

## Overview
Background schedules powered by `node-cron`. `index.js` (`startSchedulers()`) starts them once when the server is listening and stops them on graceful shutdown. Every schedule uses `noOverlap` (see `options.js`): if a run is still going when the next tick fires, that tick is skipped. Schedules use the server's local time unless `CRON_TZ` is set.

---

## File Manifest

| File | Schedule | Description |
| :--- | :--- | :--- |
| **`AttendanceProcessor.js`** | Every 30 min (`*/30 * * * *`) and every minute (`* * * * *`) | Finalizes each user's previous day at their processing slot, sends shift start/end reminders. |
| **`cleanupScheduler.js`** | Daily 02:00 (`0 2 * * *`) and every 15 min (`*/15 * * * *`) | Nightly housekeeping and geocoding repair for recent punches. |
| **`options.js`** | — | Shared `cronOptions()` (noOverlap, optional timezone). |
| **`index.js`** | — | Starts all schedules and registers them for shutdown. |

---

## Job Details

### `AttendanceProcessor.js`
* **Daily finalization (every 30 min):** for each active user, at the slot after their shift's "possibly forgotten checkout" cutoff, open sessions are flagged `MISSED_PUNCH` (open-shift users are auto-checked-out), days without punches are marked absent / week off / holiday / leave, and DAR tasks are finalized. Missed slots are caught up later the same day.
* **Correction window notices:** users whose `MISSED_PUNCH` correction window closes that day are notified.
* **Shift reminders (every minute):** push notifications 10 minutes before shift start (if not checked in) and shift end (if still checked in).

### `cleanupScheduler.js`
* **Nightly (02:00):** removes old refresh tokens, permanently deletes users soft-deleted more than 30 days ago, permanently deletes organizations whose deletion date has passed (`modules/organisations/orgDeletionService.js`), deactivates organizations whose subscription and grace period have expired, and deletes API request logs older than `API_LOG_RETENTION_DAYS` (default 90).
* **Geocoding repair (every 15 min, and once at startup):** resolves addresses for recent punches still showing "Locating..." / "Pending...".

---

## Removed
Scheduled DAR summary emails (`DARReportScheduler.js`) were removed as an incomplete feature — see `docs/adr/0002-remove-scheduled-dar-email-reports.md`.

---

## Running a job manually
Against a development database only:
```bash
node -e "import('./src/cron/cleanupScheduler.js').then((m) => m.runCleanup()).then(() => process.exit(0))"
```
