# Service Layer (`src/services/`)

## Overview
The `src/services/` directory forms the core business logic, data persistence, and external integration layer of the MANO Workforce Intelligence Platform. Services encapsulate complex calculations, database operations using Knex, cache interactions via Redis, and integrations with third-party APIs (Google Maps, AWS S3, Razorpay, Firebase FCM, LLM APIs).

---

## Service Architecture Principles
1. **Separation of Concerns**: Controllers only handle HTTP orchestration; all calculations and database transactions live in services.
2. **Multi-Tenant Safety**: Queries explicitly include `organization_id` filters to guarantee complete data isolation between tenants.
3. **Caching Strategy**: Frequently accessed read-heavy entities (user profiles, active shifts, organization settings) are cached in Redis via `cacheService.js`.
4. **Transaction Integrity**: Multi-step operations (e.g., payroll processing, leave deductions, check-in evaluations) run within Knex database transactions.

---

## Service Directory Index

| Domain / Subdirectory | Key Service Files | Primary Responsibilities |
| :--- | :--- | :--- |
| **`admin/`** | `dashboardService.js` | Aggregates executive dashboard metrics, attendance percentages, department headcounts, and workforce distribution. |
| **`attendance/`** | `attendanceService.js`<br>`geofencing.js`<br>`shiftManagementService.js`<br>`statusEvaluationService.js` | Check-in/out event processing, GPS distance calculation (Haversine/geofencing), late/half-day status evaluation, and shift window matching. |
| **`auth/`** | `authService.js`<br>`tokenService.js`<br>`OtpService.js`<br>`emailService.js`<br>`DARLLMService.js` | Bcrypt password hashing, JWT token generation & revocation, OTP lifecycle (SMS/Email), welcome/reset emails, and LLM text formatting. |
| **`cache/`** | `cacheService.js` | Redis client abstraction providing `get`, `set`, `del`, pattern-based cache invalidation, and TTL management. |
| **`chatbot/`** | `websiteRagService.js`<br>`internalAppGuide.json` | Vector search / RAG pipeline for the internal workforce guide and AI assistant responses. |
| **`collaboration/`** | `chatAlertService.js`<br>`mentionService.js` | WebSocket chat alerts, message notifications, and `@user` mention parsing. |
| **`darServices/`** | `activitiesServices.js`<br>`DARReportAPI.js`<br>`eventsServices.js`<br>`requestsServices.js`<br>`settingsServices.js` | Business logic for daily employee activity logs, calendar scheduling events, manager approval workflows, and report metrics. |
| **`employees/`** | `employeeServices.js` | Employee CRUD operations, document metadata handling, onboarding states, and department/branch assignments. |
| **`feedback/`** | `feedbackService.js` | Handles user feedback submissions, categorization, bug tracking status, and admin responses. |
| **`google_api_services/`** | `maps.js` | Google Maps Geocoding and Distance Matrix integration for geofence validation and travel distance calculations. |
| **`holiday/`** | `holidayService.js` | Holiday calendar management, working day checks, and organization-specific holiday calendars. |
| **`leaves/`** | `leaveService.js` | Leave entitlement checks, balance deductions, sandwich-rule calculations, and multi-tier approval processing. |
| **`notifications/`** | `notificationService.js`<br>`fcmService.js` | In-app notification creation, notification read state tracking, and Firebase Cloud Messaging (FCM) mobile push dispatches. |
| **`payment/`** | `paymentService.js` | Razorpay order creation, payment signature verification, subscription plan transitions, and invoice records. |
| **`payroll/`** | `PayrollCalculationService.js`<br>`PayrollFinalizationService.js`<br>`PayslipService.js`<br>`PackageService.js`<br>`SalaryHistoryService.js` | Comprehensive CTC breakdown, gross/net pay computation, statutory deductions (PF, ESI, TDS), payslip PDF generation, and salary increment history. |
| **`profile/`** | `profileService.js` | Self-service user profile updates, password resets, preference toggles, and avatar upload handling. |
| **`reports/`** | `reportsServices.js` | Advanced database aggregation queries for daily/monthly attendance reports, payroll logs, and downloadable Excel/CSV exports. |
| **`s3/`** | `s3Service.js` | AWS S3 client wrapper for secure file uploads, image/document storage, and generating presigned download URLs. |
| **`shifts/`** | `shiftService.js` | Shift master definition, grace period logic, night shift rollover handling, and rotational shift schedules. |
| **`superAdmin/`** | `superAdminService.js`<br>`pm2Service.js` | Multi-tenant platform provisioning, organization suspension/activation, and PM2 node process health monitoring. |
| **`users/`** | `userService.js` | User account lifecycle, credentials management, role assignments, and status toggling. |
| **`workLocations/`** | `workLocationsServices.js` | Worksite coordinate storage, polygon/circular geofence boundaries, and location-based attendance rules. |

---

## Best Practices
1. **Always use atomic transactions** (`db.transaction(async trx => { ... })`) when modifying multiple related database tables.
2. **Invalidate cache** using `cacheService` whenever an entity is updated or deleted.
3. **Never swallow errors**; throw structured `AppError` instances with appropriate HTTP status codes.
