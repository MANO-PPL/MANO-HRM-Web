# Controller Layer (`src/controllers/`)

## Overview
The `src/controllers/` directory houses the HTTP request handlers for the MANO Workforce Intelligence Platform. Controllers receive incoming Express HTTP requests, validate query parameters and payload data, invoke domain services, and return standardized JSON responses.

---

## Architecture Pattern
All controllers adhere to standard clean controller design principles:
1. **Thin Controllers, Rich Services**: Business logic, database queries, and third-party API calls reside in `src/services/`.
2. **Asynchronous Handlers**: Wrapped in `catchAsync` to forward unhandled errors automatically to `errorHandler.js`.
3. **Tenant Context**: Reads `req.organizationId` and `req.user` injected by authentication and tenant middleware.
4. **Consistent Response Format**:
   ```json
   {
     "status": "success",
     "data": { ... },
     "message": "Operation completed successfully"
   }
   ```

---

## Directory & Submodule Index

| Directory | Controller Files | Functional Scope |
| :--- | :--- | :--- |
| **`admin/`** | `adminController.js`<br>`systemMonitorController.js` | Admin dashboard KPIs, system health telemetry, metrics tracking, and platform health. |
| **`attendance/`** | `attendanceController.js` | Clock-in, clock-out, live geofence verification, attendance regularizations, and daily summary retrieval. |
| **`auth/`** | `authController.js` | User login, registration, OTP delivery & verification, token refresh, password resets, and session management. |
| **`chatbot/`** | `chatbotController.js` | AI-powered chatbot assistant queries, internal knowledge base retrieval (RAG), and guidance prompts. |
| **`collaboration/`** | `chatController.js` | Real-time chat messages, team channel management, user mentions, and alert dispatching. |
| **`darControllers/`** | `activitiesControllers.js`<br>`eventsControllers.js`<br>`requestsControllers.js`<br>`settingsController.js` | Daily Activity Reports (DAR): work logs, schedule events, manager approval requests, and DAR configuration. |
| **`employees/`** | `employeeControllers.js` | Employee directory CRUD, onboarding workflows, document uploads, and department assignments. |
| **`feedback/`** | `feedbackControllers.js` | User feedback submission, bug reporting, feature suggestions, and admin review statuses. |
| **`holidays/`** | `holidaysController.js` | Holiday calendar management, regional holiday lists, and organization-wide off-day configurations. |
| **`internal/`** | `internalController.js` | Internal microservice endpoints, health checks, cache flushes, and background sync triggers. |
| **`labour/`** | `dailyScheduleController.js`<br>`labourController.js` | Contract workforce management, labour attendance, daily shift allocations, and site contractor tracking. |
| **`leaves/`** | `leaveController.js`<br>`leaveBalanceController.js`<br>`leavepolicyController.js` | Leave application lifecycle, approval/rejection workflows, leave balance calculations, and policy rules. |
| **`notifications/`** | `notificationController.js` | Push notification management, FCM device token registration, in-app notification reading and unread counts. |
| **`organizations/`** | `orgController.js` | Multi-tenant organization profile management, branch settings, branding, and billing profile details. |
| **`payment/`** | `paymentController.js` | Razorpay subscription orders, payment verification webhooks, invoice retrieval, and plan upgrades. |
| **`payroll/`** | `payrollController.js` | Monthly payroll runs, salary breakdown generation, deductions/bonus calculations, and payslip downloads. |
| **`profile/`** | `profileController.js` | User self-service profile updates, password change, avatar upload, and notification preferences. |
| **`reports/`** | `reportsController.js` | Comprehensive report generation, custom date filters, attendance summaries, and CSV/Excel/PDF export triggers. |
| **`shifts/`** | `shiftController.js` | Shift master setup, flexible/rotational shift assignments, grace periods, and night shift definitions. |
| **`superAdmin/`** | `superAdminController.js` | Super Admin platform governance, tenant onboarding/suspension, global audit logs, and PM2 process controls. |
| **`workLocations/`** | `workLocationsController.js` | Work location geofencing, GPS coordinates, allowed radius boundaries, and polygon coordinates. |

---

## Best Practices
- Keep business logic in `src/services/` and validation logic clean.
- Never write raw SQL directly inside controllers; delegate database operations to service modules.
- Ensure tenant ID (`req.organizationId`) is passed to all service queries to prevent cross-tenant data leakage.
