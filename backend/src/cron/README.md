# Scheduled Cron Jobs (`src/cron/`)

## Overview
The `src/cron/` directory contains automated background schedules powered by `node-cron`. These jobs run periodically to perform system maintenance, close unfinalized daily attendance records, generate automated Daily Activity Reports (DAR), and clean up expired transient data.

---

## File Manifest

| File | Schedule Interval | Description |
| :--- | :--- | :--- |
| **`AttendanceProcessor.js`** | Daily at Midnight (`0 0 * * *`) | Evaluates unclosed employee shifts, marks missing check-outs, records auto-absentees, and calculates final daily attendance metrics. |
| **`DARReportScheduler.js`** | Configured Daily/Weekly intervals | Generates automated Daily Activity Report (DAR) digests, compiles employee productivity metrics, and sends manager summaries. |
| **`cleanupScheduler.js`** | Hourly / Daily intervals | Purges expired OTP tokens, clears temporary uploaded files, and flushes stale cache records from Redis. |

---

## Job Details

### 1. `AttendanceProcessor.js`
* **Auto Check-Out**: Closes attendance records for employees who forgot to clock out by applying organization-defined cutoff policies.
* **Absentee Marking**: Checks active employee rosters against check-in records for the day, marking absent employees who have not applied for leave or had an approved holiday.
* **Late In & Early Out Calculation**: Computes shift compliance, total working hours, break durations, and overtime metrics.

### 2. `DARReportScheduler.js`
* **Automated DAR Compilation**: Aggregates submitted employee activity logs and manager approval statuses.
* **Notification Reminders**: Triggers push and email reminders to employees who have pending or unsubmitted DAR entries.
* **Digest Generation**: Dispatches end-of-day summary reports to department leads and HR managers.

### 3. `cleanupScheduler.js`
* **OTP & Token Invalidation**: Deletes expired one-time passwords and blacklisted JWT identifiers.
* **Temporary File Removal**: Cleans up local scratch and export files generated during PDF/Excel report export runs.
* **Cache Eviction**: Performs routine cache maintenance to prevent memory bloat on Redis instances.

---

## Execution & Lifecycle
Cron jobs are initialized during server startup in `server.js` or `src/app.js` when `NODE_ENV !== 'test'`.

To test cron routines manually:
```bash
node -e "require('./src/cron/AttendanceProcessor').runDailyProcessing()"
```
