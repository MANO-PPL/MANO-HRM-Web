# Backend Scripts & Administrative Tooling

## Overview
The `backend/scripts/` directory contains administrative utilities, database migration/refactoring tools, diagnostics, and test data simulation engines for the MANO Workforce Intelligence Platform.

---

## Directory Structure

```
backend/scripts/
├── db/                                # Database migration and schema manipulation tools
│   ├── add-tour-dismissed.js          # Migration helper to add tour_dismissed columns
│   └── db_refactor/                   # Table and column refactoring utilities
│       ├── all-mappings.csv           # Complete entity and column mapping definitions
│       ├── mappings.csv               # Active table refactoring mappings
│       └── rename-table.js            # Batch table renaming and column migration script
├── diagnostics/                       # Diagnostic and infrastructure validation tools
│   └── verify_cache.js                # Redis cache connectivity, TTL, and cluster test
└── tools/                             # Data generation and simulation utilities
    ├── generate_password.js           # Bcrypt password hash generator for seed accounts
    ├── simulate_attendance.js         # Real-time attendance simulation runner
    ├── simulate_data.json             # Seed profile & location data for live simulations
    ├── simulate_past_attendance.js    # Historical attendance data backfill generator
    └── simulate_past_data.json        # Historical attendance datasets for reporting tests
```

---

## Tool Details & Usage

### 1. Database Utilities (`db/`)
* **`add-tour-dismissed.js`**: Adds `tour_dismissed` boolean flag to the user/preferences tables to manage onboarding tour states.
  ```bash
  node scripts/db/add-tour-dismissed.js
  ```
* **`db_refactor/rename-table.js`**: Reads `mappings.csv` and safely renames database tables, foreign keys, and indexes using Knex.
  ```bash
  node scripts/db/db_refactor/rename-table.js
  ```

### 2. Diagnostics (`diagnostics/`)
* **`verify_cache.js`**: Verifies Redis caching operations (PING, SET, GET, EXPIRE, DEL, and key eviction) to ensure Redis infrastructure is healthy.
  ```bash
  node scripts/diagnostics/verify_cache.js
  ```

### 3. Simulation & Development Tools (`tools/`)
* **`generate_password.js`**: Generates a secure bcrypt salt and hash from a plaintext input password for database seeds.
  ```bash
  node scripts/tools/generate_password.js "YourPasswordHere"
  ```
* **`simulate_attendance.js`**: Simulates live workforce check-in and check-out events across organizations, verifying geofences and shift schedules.
  ```bash
  node scripts/tools/simulate_attendance.js
  ```
* **`simulate_past_attendance.js`**: Generates historical attendance records for the past 30–90 days to test reporting, payroll calculations, and analytics dashboards.
  ```bash
  node scripts/tools/simulate_past_attendance.js
  ```

---

## Best Practices
1. **Never run simulation scripts in Production**: Always check `NODE_ENV` before executing simulation tools.
2. **Database Migrations**: Always take a database backup before executing any script in `db/db_refactor/`.
