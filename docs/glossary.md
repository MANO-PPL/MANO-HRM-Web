# Domain Glossary

> System-wide ubiquitous language across the Mano platform. For terms
> unique to a specific domain or feature, refer to the glossary section
> inside that feature's explanation document in `/docs/features/`.

- **Organization (Tenant)**: The root administrative and data boundary (`core_organizations`) in the multi-tenant architecture. All employees, shifts, geofenced branches, leaves, and payroll records are strictly scoped to an organization.
- **Punch**: A discrete, timestamped event recorded in `attn_punches` representing an employee arrival ("Time In") or departure ("Time Out"), enriched with geographic coordinates, device telemetry, and optional photo verification.
- **Session**: A continuous duration of work bounded by a paired "Time In" punch and "Time Out" punch within a single shift lifecycle. Multiple sessions on the same date represent distinct working blocks (e.g. separated by meal breaks).
- **DAR (Daily Activity Report)**: An employee-submitted daily record of tasks, project codes, and duration, reconciled against verified attendance sessions and processed for productivity insights.
