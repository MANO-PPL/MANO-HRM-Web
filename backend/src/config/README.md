# Backend Configuration (`src/config/`)

## Overview
The `src/config/` directory provides centralized runtime configuration management, database connection pooling via Knex.js, and background message queue initialization using Redis and BullMQ.

---

## File Manifest

| File | Primary Responsibility | Key Exports / Modules |
| :--- | :--- | :--- |
| **`config.js`** | Environment variable parsing, validation, and defaults | `PORT`, `DB_CONFIG`, `JWT_SECRET`, `REDIS_URL`, `AWS_S3`, `RAZORPAY` |
| **`database.js`** | Knex SQL connection pooling & query lifecycle | Knex instance (`db`), connection health checks, transaction helpers |
| **`queues.js`** | BullMQ queue client initialization over Redis | `attendanceQueue`, `reportQueue`, `notificationQueue` |

---

## Detailed Components

### 1. `config.js`
Loads environment variables via `dotenv` and exposes strongly typed, fallback-safe configuration objects.
* **Server**: Port, environment mode (`development`, `production`, `test`), CORS whitelist origins.
* **Security & Auth**: JWT access token secret, refresh token secret, token expiry durations, bcrypt salt rounds.
* **Database**: PostgreSQL connection parameters (host, port, user, password, database, pool min/max).
* **Caching & Queues**: Redis connection string / host-port-auth for CacheService and BullMQ queues.
* **Storage & Integrations**: AWS S3 bucket configuration, Google Maps API key, Razorpay API credentials, Firebase Cloud Messaging (FCM) credentials.

### 2. `database.js`
Initializes the **Knex.js** query builder:
* Configures connection pooling (min 2, max 10 connections by default).
* Adds query execution listeners and debug logging in development mode.
* Manages database ping/health checks during server bootup.
* Provides a unified interface for executing atomic database transactions.

### 3. `queues.js`
Sets up **BullMQ** message queues backed by Redis:
* **`attendanceQueue`**: Handles asynchronous bulk attendance evaluation, geofence validations, and shift matching.
* **`reportQueue`**: Offloads time-consuming CSV, Excel, and PDF report compilation.
* **`notificationQueue`**: Queues outbound push notifications and email dispatches with backoff retries.

---

## Environment Variable Checklist
Ensure the following variables are defined in `.env`:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgres://user:password@localhost:5432/mano_workforce
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=your_jwt_secret_key
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_S3_BUCKET_NAME=your_s3_bucket
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
```
