# Backend Scripts & Administrative Tooling

## Overview
The `backend/scripts/` directory contains verified administrative utilities, database migration runners, smoke tests, and developer tooling for the MANO Workforce Intelligence Platform.

---

## Directory Structure

```
backend/scripts/
├── db/                                # Database management & migration runner
│   ├── migrations/                    # Knex schema migrations (.mjs files)
│   ├── migrate.js                     # Knex runner: npm run migrate / migrate:status / migrate:rollback
│   └── db_dump.js                     # Database schema and data export utility
├── diagnostics/                       # Infrastructure validation & performance benchmarks
│   └── verify_cache.js                # Redis cache speedup benchmark & offline fallback test
├── smoke/                             # Automated CI & pre-commit validation tests
│   ├── check-syntax.js                # AST syntax verification across all backend JS files
│   ├── imports.js                     # ES module import resolution verification
│   └── lifecycle.js                   # Connection health & graceful shutdown verification
└── tools/                             # Developer utilities
    ├── generate_password.js           # CLI bcrypt password hash generator for test accounts
    └── route-inventory.js             # Express API route catalog generator
```

---

## Tool Details & Usage

### 1. Database Management (`db/`)

* **`migrate.js`**: Applies, rolls back, or checks the status of database schema migrations in `backend/scripts/db/migrations/` using Knex.
  ```bash
  npm run migrate          # Apply all pending migrations (node scripts/db/migrate.js latest)
  npm run migrate:status   # Check applied vs pending migrations
  npm run migrate:rollback # Roll back the last migration batch
  ```

* **`db_dump.js`**: Exports clean MySQL database dumps directly using connection settings from `.env`.
  ```bash
  # Schema only (table structures without data):
  node scripts/db/db_dump.js

  # Full dump (schema + data):
  node scripts/db/db_dump.js --data
  ```

---

### 2. Smoke & Integrity Checks (`smoke/`)

* **`check-syntax.js`**: Validates syntax across `server.js` and all files under `src/`.
  ```bash
  node scripts/smoke/check-syntax.js
  ```

* **`imports.js`**: Dynamically verifies that all ES module import paths exist and resolve without errors.
  ```bash
  node scripts/smoke/imports.js
  ```

* **`lifecycle.js`**: Tests database and Redis connections and verifies that graceful SIGTERM shutdown handlers execute cleanly.
  ```bash
  npm run smoke:lifecycle
  ```

* **`npm run check`**: Runs syntax check, ESLint, and import checks in a single pipeline.

---

### 3. Diagnostics (`diagnostics/`)

* **`verify_cache.js`**: Measures Redis vs MySQL latency differences, tests cache invalidation, and verifies that the app gracefully falls back to MySQL if Redis is disconnected.
  ```bash
  node scripts/diagnostics/verify_cache.js
  ```

---

### 4. Developer Tools (`tools/`)

* **`generate_password.js`**: Generates a secure random password or hashes a custom password with bcrypt for database seed accounts.
  ```bash
  node scripts/tools/generate_password.js "YourPasswordHere"
  ```

* **`route-inventory.js`**: Scans Express routing definitions and prints a table of all registered API endpoints.
  ```bash
  npm run routes:inventory
  ```
