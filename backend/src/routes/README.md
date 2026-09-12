# API Routes Architecture (`src/routes/`)

## Overview
The `src/routes/` directory defines the complete RESTful API routing architecture for the MANO Workforce Intelligence Platform. All route modules are aggregated and mounted onto the Express application via `src/routes/index.js`.

---

## Router Hub (`index.js`)
The central router imports domain-specific route definitions, applies necessary middleware pipelines (authentication, tenant validation, rate limiting), and maps them to standard API prefix paths under `/api/v1/`.

---

## Route Manifest & Endpoints

| Route Module | Mount Path | Primary Endpoints & Capabilities |
| :--- | :--- | :--- |
| **`admin/adminRoutes.js`** | `/api/v1/admin` | Admin dashboard stats, user role assignments, audit logs. |
| **`admin/systemMonitorRoutes.js`** | `/api/v1/admin/monitor` | System health checks, memory usage, CPU load, and API performance telemetry. |
| **`attendance/attendanceRoutes.js`** | `/api/v1/attendance` | Check-in, check-out, live GPS geofence checks, regularization requests, daily/monthly logs. |
| **`auth/authRoutes.js`** | `/api/v1/auth` | User login, registration, password reset, OTP dispatch & verification, token refresh. |
| **`chatbot/chatbotRoutes.js`** | `/api/v1/chatbot` | AI query assistant, app user guide RAG queries, prompt interactions. |
| **`collaboration/chatRoutes.js`** | `/api/v1/chat` | Channel messages, direct messages, user mentions, thread history, alerts. |
| **`darRoutes/`** | `/api/v1/dar` | Daily Activity Reports (activities, scheduled events, manager requests, custom settings). |
| **`employees/employeeRoutes.js`** | `/api/v1/employees` | Employee directory CRUD, document uploads, department/designation management. |
| **`feedback/feedbackRoutes.js`** | `/api/v1/feedback` | User feedback submission, bug reports, feature suggestions, admin feedback triage. |
| **`holidays/holidayRoutes.js`** | `/api/v1/holidays` | Organization holiday calendar, national holidays, optional off-day management. |
| **`internal/internalRoutes.js`** | `/api/v1/internal` | Service-to-service communication, internal sync jobs, cache eviction webhooks. |
| **`labour/labourRoutes.js`** | `/api/v1/labour` | Contract workforce records, daily contractor schedules, site headcounts. |
| **`leaves/leaveRoutes.js`** | `/api/v1/leaves` | Leave applications, manager approvals/rejections, leave balances, leave policies. |
| **`locations/locations.js`** | `/api/v1/locations` | Countries, states, and cities lookup data for address autocomplete forms. |
| **`notifications/notificationRoutes.js`** | `/api/v1/notifications` | User notifications, FCM device token registration, mark-as-read endpoints. |
| **`organizations/orgRoutes.js`** | `/api/v1/organizations` | Tenant organization profile, branches, company settings, branding options. |
| **`payment/paymentRoutes.js`** | `/api/v1/payments` | Razorpay orders, plan upgrades, payment verification webhooks, billing history. |
| **`payroll/payrollRoutes.js`** | `/api/v1/payroll` | Monthly payroll calculation, salary slips, statutory deductions, disbursement status. |
| **`policies/shiftRoutes.js`** | `/api/v1/policies/shifts` | Shift policy assignments, grace period tolerances, rotational schedule rules. |
| **`profile/profileRoutes.js`** | `/api/v1/profile` | Current user profile, avatar upload, password change, user preferences. |
| **`reports/reportsRoutes.js`** | `/api/v1/reports` | Attendance reports, payroll reports, leave summaries, PDF/Excel export endpoints. |
| **`superAdmin/superAdminRoutes.js`** | `/api/v1/super-admin` | Platform-wide tenant management, license allocation, PM2 process lifecycle. |
| **`workLocations/workLocationsRoutes.js`** | `/api/v1/work-locations` | Office/site geofence coordinates, allowed radius boundaries, GPS validation rules. |

---

## Route Security & Middleware Pipeline
All private routes enforce:
1. **`auth` Middleware**: Requires valid Bearer JWT.
2. **`requireActiveOrg`**: Confirms the tenant organization account is active and verified.
3. **`ensureAdmin`**: Applied to administrative endpoints (`/admin`, `/super-admin`, `/payroll/process`, etc.).
4. **`rateLimiter`**: Strict limits applied to authentication and export routes.
