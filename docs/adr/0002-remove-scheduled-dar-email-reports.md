# ADR-0002: Remove the Incomplete Scheduled DAR Email Reports Feature

> Place this file in /docs/adr/, numbered sequentially (0001, 0002, ...).
> One ADR per significant, hard-to-reverse technical decision.
> Once accepted, an ADR is rarely edited — if the decision changes, write a
> new ADR that supersedes this one, don't rewrite history.

## Status
Accepted

## Context
The backend contained a partially built feature for **automatic Daily Activity Report (DAR) summary emails**, added in commit `5ccdd40` ("Added AI automation for daily, weekly and monthly report generation").

What it was meant to do:
- Admin/HR configure, per organization, a **daily / weekly / monthly** schedule with the recipient email addresses (`dar_report_schedules`: frequency, email_to, is_active, day_of_week, day_of_month, send_time, last_run_at).
- A cron job (`src/cron/DARReportScheduler.js`: daily 10:00, Mondays 07:00, 1st of month 06:00) builds the DAR summary for the previous period (per-employee work summaries with AI-written narratives, via `buildReport` in `modules/DAR/DARReportAPI.js`), emails it to the recipients, and records each run (`dar_report_history`: period, date range, trigger, status).
- API: `GET /dar/reports/history`, `GET/POST /dar/reports/schedules`, `DELETE /dar/reports/schedules/:frequency` (admin/HR).

Why it was incomplete:
- No screen in the frontend ever called these endpoints; schedules could not be configured from the app.
- The `dar_report_schedules` and `dar_report_history` tables do not exist in the production database, so the endpoints and the cron failed (the cron logged an error at every run).
- `day_of_week`, `day_of_month` and `send_time` were stored but ignored: the cron used fixed times.
- The email body inserted employee names and AI-generated text into HTML without escaping.

The feature is not needed for the current product scope.

## Decision
Remove the scheduled DAR email feature entirely — the cron job, the schedule/history API endpoints and the email generation — and do not create its two tables.

## Alternatives Considered
- **Finish the feature** — create the tables, build a settings screen, honor the configured day/time, escape the email HTML. Rejected for now: out of the current product scope.
- **Keep the code but disable the cron** — avoids the errors, but leaves unused, untested endpoints and code paths in the product. Rejected in favor of removal plus this record.

## Consequences
- Kept: the on-demand DAR report preview (`GET /dar/reports/preview`, `POST /dar/reports/preview/client`, used by the DAR admin "Master Data" view) and `buildReport()`, which the preview uses.
- The cron no longer logs "table doesn't exist" errors.
- If the feature is wanted later, the removed code is recoverable from git — the last version of the scheduler is in the commit before its removal:
  ```bash
  git log --diff-filter=D --oneline -- backend/src/cron/DARReportScheduler.js   # removal commit
  git show <removal-commit>^:backend/src/cron/DARReportScheduler.js
  git show <removal-commit>^:backend/src/modules/DAR/DARReportAPI.js           # /history and /schedules routes
  ```
  It would need the two tables (a migration), a settings screen, the fixes listed under Context, and a new ADR superseding this one.
- The `DAR_REPORT_SCHEMA_AUTO_CREATE` variable in `.env` files is unused and can be removed.
