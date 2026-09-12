# Middleware Architecture (`src/middleware/`)

## Overview
The `src/middleware/` directory defines the Express request processing pipeline. Middleware intercept and validate incoming HTTP requests for authentication, role-based access control (RBAC), multi-tenant isolation, rate limiting, telemetry tracking, bot protection, and centralized error handling.

---

## File Manifest

| File | Type | Primary Responsibility |
| :--- | :--- | :--- |
| **`auth.js`** | Security / Auth | Validates JWT Bearer tokens, loads user identity into `req.user`, and enforces multi-tenant boundary checks via `requireActiveOrg`. |
| **`ensureAdmin.js`** | RBAC / Authorization | Restricts endpoint access to administrators (`admin`) and platform operators (`superAdmin`). |
| **`rateLimiter.js`** | Protection / Throttling | Prevents brute force attacks and API abuse using Redis/memory-backed `express-rate-limit`. |
| **`apiMonitor.js`** | Telemetry / Observability | Measures HTTP request duration, captures response status codes, and records endpoint metrics for admin monitoring. |
| **`errorHandler.js`** | Central Error Handler | Catch-all error formatting middleware converting exceptions and `AppError` instances into clean JSON payloads. |
| **`verifyCaptcha.js`** | Anti-Bot Verification | Validates Cloudflare Turnstile or Google reCAPTCHA tokens on public forms (e.g., login, registration, contact). |

---

## Execution Pipeline

```mermaid
flowchart TD
    Req[Incoming HTTP Request] --> API[apiMonitor.js]
    API --> Limiter[rateLimiter.js]
    Limiter --> Captcha[verifyCaptcha.js (Public Auth Routes)]
    Captcha --> Auth[auth.js (JWT & Tenant Validation)]
    Auth --> RBAC[ensureAdmin.js (Role Check)]
    RBAC --> Controller[Controller & Services Execution]
    Controller --> Err{Error Occurred?}
    Err -- Yes --> Handler[errorHandler.js]
    Err -- No --> Res[JSON HTTP Response]
```

---

## Detailed Middleware Usage

### 1. `auth.js`
* Extracts and verifies the JWT token from the `Authorization: Bearer <token>` header.
* Verifies token revocation against Redis blacklist.
* Attaches `req.user` (containing user ID, email, role) and `req.organizationId` to the request object.
* Provides `requireActiveOrg` to ensure tenant accounts are active and not suspended.

### 2. `ensureAdmin.js`
* Validates that `req.user.role` matches `admin` or `super_admin`.
* Blocks unauthorized employee access with an HTTP 403 Forbidden status.

### 3. `rateLimiter.js`
* Configures window-based rate limits:
  * **Auth Limiter**: Strict limit on `/api/v1/auth/login` and `/api/v1/auth/otp`.
  * **General Limiter**: High-capacity limit for standard data endpoints.

### 4. `apiMonitor.js`
* Hooks into `res.on('finish')` to calculate response latency.
* Emits performance telemetry events to `systemMonitorController` and logging pipelines.

### 5. `errorHandler.js`
* Differentiates between operational errors (`AppError`) and unhandled programming bugs.
* Sanitizes sensitive stack traces in production mode while logging complete error stacks to Winston/files.

### 6. `verifyCaptcha.js`
* Intercepts captcha tokens sent from the frontend client.
* Calls Cloudflare / Google verification APIs before allowing sensitive operations.
