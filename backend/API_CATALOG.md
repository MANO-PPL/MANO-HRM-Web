# MANO Workforce Intelligence Platform - Complete API Catalog

Comprehensive REST API catalog and endpoint statistics for the **MANO Workforce Intelligence Platform** backend.

**Base URL**: `http://localhost:5000` (or configured `PORT` / production domain)  
**Standard Headers**:
- `Authorization: Bearer <access_token>` (for authenticated endpoints)
- `Content-Type: application/json`

---

## 📊 Executive API Statistics Dashboard

### Overall Metrics
| Metric | Value |
| :--- | :--- |
| **Total API Endpoints** | **214** |
| **Total Domain Modules** | **24** |
| **GET Endpoints (Read & Query)** | **86** (40.2%) |
| **POST Endpoints (Create & Actions)** | **77** (36.0%) |
| **PUT Endpoints (Update & Mutate)** | **27** (12.6%) |
| **DELETE Endpoints (Remove & Archive)**| **20** (9.3%) |
| **PATCH Endpoints (Partial Updates)** | **4** (1.9%) |

### Access & Security Breakdown
| Role / Access Level | Endpoint Count | Percentage |
| :--- | :--- | :--- |
| **Public Endpoints** (No Auth required) | **14** | 6.5% |
| **Authenticated Users** (Employee / User JWT) | **111** | 51.9% |
| **Admin & HR Operations** (Elevated Privileges) | **80** | 37.4% |
| **Super Admin Platform Operations** (Tenant / System Governance) | **9** | 4.2% |

---

## 📈 Module-by-Module API Breakdown

| # | Module / Feature Area | Base Route | Total APIs | GET | POST | PUT | DELETE | PATCH |
| :-: | :--- | :--- | :-: | :-: | :-: | :-: | :-: | :-: |
| 1 | **Authentication & Session** | `/auth` | **11** | 2 | 9 | 0 | 0 | 0 |
| 2 | **Attendance & Geofencing** | `/attendance` | **18** | 8 | 7 | 1 | 0 | 2 |
| 3 | **Admin Administration, Users & Master Lookups** | `/admin` | **27** | 8 | 9 | 5 | 5 | 0 |
| 4 | **Employees Directory** | `/employee` | **1** | 1 | 0 | 0 | 0 | 0 |
| 5 | **Leave Management** | `/leaves` | **21** | 8 | 5 | 4 | 4 | 0 |
| 6 | **Shifts & Policy Schedules** | `/policies` | **6** | 2 | 1 | 2 | 1 | 0 |
| 7 | **Payroll & Compensation** | `/payroll` | **26** | 12 | 10 | 3 | 1 | 0 |
| 8 | **Daily Activity Reports (Activities)** | `/dar/activities` | **7** | 3 | 2 | 1 | 1 | 0 |
| 9 | **Daily Activity Reports (Events)** | `/dar/events` | **5** | 2 | 1 | 1 | 1 | 0 |
| 10 | **Daily Activity Reports (Requests)** | `/dar/requests` | **4** | 1 | 3 | 0 | 0 | 0 |
| 11 | **Daily Activity Reports (Settings)** | `/dar/settings` | **2** | 1 | 1 | 0 | 0 | 0 |
| 12 | **Daily Activity Reports (AI & Reports API)** | `/dar/reports` | **6** | 3 | 2 | 0 | 1 | 0 |
| 13 | **Team Collaboration & Real-Time Chat** | `/collaboration` | **9** | 3 | 3 | 2 | 1 | 0 |
| 14 | **Notifications & Push Service** | `/notifications` | **6** | 1 | 3 | 2 | 0 | 0 |
| 15 | **User Profile & Preferences** | `/profile` | **4** | 1 | 1 | 0 | 1 | 1 |
| 16 | **User Feedback & Support Tickets** | `/feedback` | **3** | 1 | 1 | 0 | 0 | 1 |
| 17 | **Payments & Subscriptions (Razorpay)** | `/payment` | **3** | 0 | 3 | 0 | 0 | 0 |
| 18 | **Multi-Tenant Organizations** | `/organizations` | **10** | 5 | 2 | 2 | 1 | 0 |
| 19 | **Work Locations & Geofences** | `/locations` | **5** | 1 | 2 | 1 | 1 | 0 |
| 20 | **Contractor & Labour Management** | `/labour` | **13** | 7 | 5 | 0 | 1 | 0 |
| 21 | **Holiday Calendar** | `/holiday` | **7** | 1 | 4 | 1 | 1 | 0 |
| 22 | **Reports & Data Exports** | `/admin/reports` | **3** | 3 | 0 | 0 | 0 | 0 |
| 23 | **Super Admin & System Monitoring** | `/super-admin` | **9** | 6 | 1 | 2 | 0 | 0 |
| 24 | **AI Chatbot, Geolocation & Internal Tools** | `/geo` | **8** | 6 | 2 | 0 | 0 | 0 |
| | **TOTAL** | | **214** | **86** | **77** | **27** | **20** | **4** |

---

## Table of Contents
1. [1. Authentication & Session (`/auth` - 11 APIs)](#1-authentication-session)
2. [2. Attendance & Geofencing (`/attendance` - 18 APIs)](#2-attendance-geofencing)
3. [3. Admin Administration, Users & Master Lookups (`/admin` - 27 APIs)](#3-admin-administration-users-master-lookups)
4. [4. Employees Directory (`/employee` - 1 APIs)](#4-employees-directory)
5. [5. Leave Management (`/leaves` - 21 APIs)](#5-leave-management)
6. [6. Shifts & Policy Schedules (`/policies` - 6 APIs)](#6-shifts-policy-schedules)
7. [7. Payroll & Compensation (`/payroll` - 26 APIs)](#7-payroll-compensation)
8. [8. Daily Activity Reports (Activities) (`/dar/activities` - 7 APIs)](#8-daily-activity-reports-activities)
9. [9. Daily Activity Reports (Events) (`/dar/events` - 5 APIs)](#9-daily-activity-reports-events)
10. [10. Daily Activity Reports (Requests) (`/dar/requests` - 4 APIs)](#10-daily-activity-reports-requests)
11. [11. Daily Activity Reports (Settings) (`/dar/settings` - 2 APIs)](#11-daily-activity-reports-settings)
12. [12. Daily Activity Reports (AI & Reports API) (`/dar/reports` - 6 APIs)](#12-daily-activity-reports-ai-reports-api)
13. [13. Team Collaboration & Real-Time Chat (`/collaboration` - 9 APIs)](#13-team-collaboration-real-time-chat)
14. [14. Notifications & Push Service (`/notifications` - 6 APIs)](#14-notifications-push-service)
15. [15. User Profile & Preferences (`/profile` - 4 APIs)](#15-user-profile-preferences)
16. [16. User Feedback & Support Tickets (`/feedback` - 3 APIs)](#16-user-feedback-support-tickets)
17. [17. Payments & Subscriptions (Razorpay) (`/payment` - 3 APIs)](#17-payments-subscriptions-razorpay)
18. [18. Multi-Tenant Organizations (`/organizations` - 10 APIs)](#18-multi-tenant-organizations)
19. [19. Work Locations & Geofences (`/locations` - 5 APIs)](#19-work-locations-geofences)
20. [20. Contractor & Labour Management (`/labour` - 13 APIs)](#20-contractor-labour-management)
21. [21. Holiday Calendar (`/holiday` - 7 APIs)](#21-holiday-calendar)
22. [22. Reports & Data Exports (`/admin/reports` - 3 APIs)](#22-reports-data-exports)
23. [23. Super Admin & System Monitoring (`/super-admin` - 9 APIs)](#23-super-admin-system-monitoring)
24. [24. AI Chatbot, Geolocation & Internal Tools (`/geo` - 8 APIs)](#24-ai-chatbot-geolocation-internal-tools)

---

## 1. Authentication & Session (`/auth`)

> **Module Stats**: **11 Total Endpoints** (GET: 2 | POST: 9 | PUT: 0 | DELETE: 0 | PATCH: 0)

| Method | Endpoint | Description | Auth / Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/auth/captcha/generate` | GET operation on /auth/captcha/generate | Authenticated |
| `POST` | `/auth/login` | User login via credentials (Rate Limited) | Public |
| `POST` | `/auth/super-admin/login` | POST operation on /auth/super-admin/login | Public |
| `POST` | `/auth/forgot-password` | Request password reset email / OTP | Public |
| `POST` | `/auth/verify-otp` | Verify submitted OTP code | Public |
| `POST` | `/auth/reset-password` | Set new password using verified reset token | Public |
| `POST` | `/auth/onboard` | POST operation on /auth/onboard | Authenticated |
| `POST` | `/auth/refresh` | POST operation on /auth/refresh | Public |
| `POST` | `/auth/logout` | User logout and session token revocation | Authenticated |
| `GET` | `/auth/me` | Retrieve current authenticated user context | Authenticated |
| `POST` | `/auth/change-password` | Change account password for authenticated user | Authenticated |

---

## 2. Attendance & Geofencing (`/attendance`)

> **Module Stats**: **18 Total Endpoints** (GET: 8 | POST: 7 | PUT: 1 | DELETE: 0 | PATCH: 2)

| Method | Endpoint | Description | Auth / Role |
| :--- | :--- | :--- | :--- |
| `POST` | `/attendance/timein` | POST operation on /attendance/timein | Authenticated |
| `POST` | `/attendance/timeout` | POST operation on /attendance/timeout | Authenticated |
| `POST` | `/attendance/ping` | POST operation on /attendance/ping | Authenticated |
| `POST` | `/attendance/simulate/timein` | POST operation on /attendance/simulate/timein | Authenticated |
| `POST` | `/attendance/simulate/timeout` | POST operation on /attendance/simulate/timeout | Authenticated |
| `GET` | `/attendance/records/admin` | GET operation on /attendance/records/admin | Authenticated |
| `GET` | `/attendance/records` | GET operation on /attendance/records | Authenticated |
| `GET` | `/attendance/daily-summary/admin` | GET operation on /attendance/daily-summary/admin | Authenticated |
| `GET` | `/attendance/daily-summary` | GET operation on /attendance/daily-summary | Authenticated |
| `GET` | `/attendance/records/export` | GET operation on /attendance/records/export | Authenticated |
| `POST` | `/attendance/correction-request` | POST operation on /attendance/correction-request | Authenticated |
| `GET` | `/attendance/correction-requests` | GET operation on /attendance/correction-requests | Authenticated |
| `GET` | `/attendance/correction-request/:acr_id` | GET operation on /attendance/correction-request/:acr_id | Authenticated |
| `PATCH` | `/attendance/correct-request/:acr_id` | PATCH operation on /attendance/correct-request/:acr_id | Authenticated |
| `PATCH` | `/attendance/correction-request/:acr_id` | PATCH operation on /attendance/correction-request/:acr_id | Authenticated |
| `PUT` | `/attendance/correction-request/:acr_id/review` | PUT operation on /attendance/correction-request/:acr_id/review | Authenticated |
| `GET` | `/attendance/my-shift` | GET operation on /attendance/my-shift | Authenticated |
| `POST` | `/attendance/ai-summary` | POST operation on /attendance/ai-summary | Authenticated |

---

## 3. Admin Administration, Users & Master Lookups (`/admin`)

> **Module Stats**: **27 Total Endpoints** (GET: 8 | POST: 9 | PUT: 5 | DELETE: 5 | PATCH: 0)

| Method | Endpoint | Description | Auth / Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/admin/users` | List all users in the organization with filters | Admin / HR |
| `GET` | `/admin/user/:user_id` | Get detailed profile for a specific user | Admin / HR |
| `POST` | `/admin/user` | Create new user / employee record | Admin / HR |
| `PUT` | `/admin/user/:user_id` | Update user profile and permissions | Admin / HR |
| `POST` | `/admin/user/:user_id/avatar` | Upload avatar image for user | Admin / HR |
| `DELETE` | `/admin/user/:user_id` | Soft-delete user account | Admin / HR |
| `DELETE` | `/admin/user/:user_id/force` | Permanently hard-delete user record | Admin / HR |
| `POST` | `/admin/user/:user_id/restore` | Restore a soft-deleted user account | Admin / HR |
| `PUT` | `/admin/user/:user_id/status` | Toggle user active/inactive status | Admin / HR |
| `POST` | `/admin/users/bulk` | Bulk import users via CSV/Excel upload | Admin / HR |
| `POST` | `/admin/users/bulk-validate` | Validate bulk user import data | Admin / HR |
| `POST` | `/admin/users/bulk-json` | Bulk create users from JSON payload | Admin / HR |
| `GET` | `/admin/dashboard-stats` | GET operation on /admin/dashboard-stats | Admin / HR |
| `GET` | `/admin/departments` | List all departments | Admin / HR |
| `POST` | `/admin/departments` | Create a new department | Admin / HR |
| `PUT` | `/admin/departments/:dept_id` | Update department details | Admin / HR |
| `DELETE` | `/admin/departments/:dept_id` | Delete department | Admin / HR |
| `GET` | `/admin/designations` | List all designations | Admin / HR |
| `POST` | `/admin/designations` | Create a new designation | Admin / HR |
| `PUT` | `/admin/designations/:desg_id` | Update designation details | Admin / HR |
| `DELETE` | `/admin/designations/:desg_id` | Delete designation | Admin / HR |
| `GET` | `/admin/shifts` | GET operation on /admin/shifts | Admin / HR |
| `POST` | `/admin/shifts` | POST operation on /admin/shifts | Admin / HR |
| `PUT` | `/admin/shifts/:shift_id` | PUT operation on /admin/shifts/:shift_id | Admin / HR |
| `DELETE` | `/admin/shifts/:shift_id` | DELETE operation on /admin/shifts/:shift_id | Admin / HR |
| `GET` | `/admin/locations` | List configured work locations & branch coordinates | Admin / HR |
| `GET` | `/admin/dashboard-stats` | GET operation on /admin/dashboard-stats | Admin / HR |

---

## 4. Employees Directory (`/employee`)

> **Module Stats**: **1 Total Endpoints** (GET: 1 | POST: 0 | PUT: 0 | DELETE: 0 | PATCH: 0)

| Method | Endpoint | Description | Auth / Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/employee/locations` | List configured work locations & branch coordinates | Authenticated |

---

## 5. Leave Management (`/leaves`)

> **Module Stats**: **21 Total Endpoints** (GET: 8 | POST: 5 | PUT: 4 | DELETE: 4 | PATCH: 0)

| Method | Endpoint | Description | Auth / Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/leaves/my-history` | Fetch current user's leave application history | Authenticated |
| `POST` | `/leaves/request` | Submit a new leave application | Authenticated |
| `DELETE` | `/leaves/request/:id` | Withdraw / cancel pending leave application | Authenticated |
| `GET` | `/leaves/admin/pending` | Fetch pending leave requests awaiting approval | Admin / HR |
| `GET` | `/leaves/admin/history` | View historical organization leave requests | Admin / HR |
| `PUT` | `/leaves/admin/status/:id` | Approve or reject leave application | Admin / HR |
| `GET` | `/leaves/policies` | List all organization leave policies | Authenticated |
| `POST` | `/leaves/policies` | Create a new leave policy | Admin / HR |
| `GET` | `/leaves/policies/:lp_id` | Get details of a specific leave policy | Admin / HR |
| `PUT` | `/leaves/policies/:lp_id` | Update leave policy configuration | Admin / HR |
| `DELETE` | `/leaves/policies/:lp_id` | Delete leave policy | Admin / HR |
| `POST` | `/leaves/policies/:lp_id/assign` | Assign leave policy to employee groups | Admin / HR |
| `POST` | `/leaves/policies/:lp_id/rules` | Create leave policy rule condition | Admin / HR |
| `PUT` | `/leaves/policies/:lp_id/rules/:rule_id` | Update leave policy rule criteria | Admin / HR |
| `DELETE` | `/leaves/policies/:lp_id/rules/:rule_id` | Delete leave policy rule condition | Admin / HR |
| `GET` | `/leaves/balances` | Get current user's available leave quotas | Authenticated |
| `GET` | `/leaves/balances/all` | Get leave balances across all employees | Admin / HR |
| `GET` | `/leaves/balances/:user_id` | Fetch specific employee leave balance | Admin / HR |
| `PUT` | `/leaves/balances/:lb_id` | Adjust employee leave balance quota | Admin / HR |
| `POST` | `/leaves/balances` | Initialize leave balance for employee | Admin / HR |
| `DELETE` | `/leaves/balances/:lb_id` | Delete employee leave balance record | Admin / HR |

---

## 6. Shifts & Policy Schedules (`/policies`)

> **Module Stats**: **6 Total Endpoints** (GET: 2 | POST: 1 | PUT: 2 | DELETE: 1 | PATCH: 0)

| Method | Endpoint | Description | Auth / Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/policies/shifts` | GET operation on /policies/shifts | Authenticated |
| `POST` | `/policies/shifts` | POST operation on /policies/shifts | Authenticated |
| `PUT` | `/policies/shifts/:shift_id` | PUT operation on /policies/shifts/:shift_id | Authenticated |
| `DELETE` | `/policies/shifts/:shift_id` | DELETE operation on /policies/shifts/:shift_id | Authenticated |
| `GET` | `/policies/shift-users` | GET operation on /policies/shift-users | Authenticated |
| `PUT` | `/policies/users/:user_id/shift` | PUT operation on /policies/users/:user_id/shift | Authenticated |

---

## 7. Payroll & Compensation (`/payroll`)

> **Module Stats**: **26 Total Endpoints** (GET: 12 | POST: 10 | PUT: 3 | DELETE: 1 | PATCH: 0)

| Method | Endpoint | Description | Auth / Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/payroll/employees/:id/salary` | Get salary structure for an employee | Authenticated |
| `POST` | `/payroll/employees/:id/salary` | Update employee salary structure & CTC breakdown | Admin / HR |
| `GET` | `/payroll/employees/:id/salary/history` | View employee salary revision & increment history | Admin / HR |
| `GET` | `/payroll/dashboard` | Executive payroll dashboard metrics & summary | Admin / HR |
| `GET` | `/payroll/dashboard/:employeeId` | Projected payout calculation for single employee | Admin / HR |
| `POST` | `/payroll/finalize` | Execute monthly organization payroll run | Admin / HR |
| `POST` | `/payroll/employees/:employeeId/finalize` | Finalize single employee payroll entry | Admin / HR |
| `POST` | `/payroll/employees/:employeeId/unlock` | Unlock employee payroll entry for modifications | Admin / HR |
| `POST` | `/payroll/employees/:employeeId/pay` | Mark individual employee payout as paid | Admin / HR |
| `GET` | `/payroll/runs` | List historical monthly payroll runs | Admin / HR |
| `GET` | `/payroll/runs/:runId` | Get detailed itemized payroll run details | Admin / HR |
| `POST` | `/payroll/runs/:runId/mark-paid` | Mark entire payroll batch as paid | Admin / HR |
| `GET` | `/payroll/audit-logs` | Retrieve payroll calculation audit logs | Admin / HR |
| `PUT` | `/payroll/entries/:entryId/adjustments` | Add bonus, incentive, or deduction adjustments | Admin / HR |
| `GET` | `/payroll/entries/:entryId/payslip` | Generate & download employee payslip PDF | Authenticated |
| `GET` | `/payroll/packages` | List all compensation package templates | Admin / HR |
| `POST` | `/payroll/packages` | Create new compensation package | Admin / HR |
| `GET` | `/payroll/packages/:packageGroupId/revisions` | View compensation package revision history | Admin / HR |
| `POST` | `/payroll/packages/:packageGroupId/revisions` | Publish updated compensation package revision | Admin / HR |
| `PUT` | `/payroll/packages/:packageGroupId` | Update compensation package | Admin / HR |
| `DELETE` | `/payroll/packages/:packageGroupId` | Delete compensation package | Admin / HR |
| `GET` | `/payroll/employees/packages` | List employee package allocations | Admin / HR |
| `POST` | `/payroll/employees/:employeeId/assign-package` | Mark individual employee payout as paid | Admin / HR |
| `POST` | `/payroll/employees/:employeeId/unassign-package` | Mark individual employee payout as paid | Admin / HR |
| `GET` | `/payroll/settings` | Retrieve organization payroll configuration | Admin / HR |
| `PUT` | `/payroll/settings` | Update statutory settings (PF, ESI, TDS) | Admin / HR |

---

## 8. Daily Activity Reports (Activities) (`/dar/activities`)

> **Module Stats**: **7 Total Endpoints** (GET: 3 | POST: 2 | PUT: 1 | DELETE: 1 | PATCH: 0)

| Method | Endpoint | Description | Auth / Role |
| :--- | :--- | :--- | :--- |
| `POST` | `/dar/activities/create` | POST operation on /dar/activities/create | Authenticated |
| `PUT` | `/dar/activities/update/:id` | PUT operation on /dar/activities/update/:id | Authenticated |
| `DELETE` | `/dar/activities/delete/:id` | DELETE operation on /dar/activities/delete/:id | Authenticated |
| `GET` | `/dar/activities/list` | GET operation on /dar/activities/list | Authenticated |
| `GET` | `/dar/activities/settings` | GET operation on /dar/activities/settings | Authenticated |
| `GET` | `/dar/activities/admin/all` | GET operation on /dar/activities/admin/all | Authenticated |
| `POST` | `/dar/activities/batch-save` | POST operation on /dar/activities/batch-save | Authenticated |

---

## 9. Daily Activity Reports (Events) (`/dar/events`)

> **Module Stats**: **5 Total Endpoints** (GET: 2 | POST: 1 | PUT: 1 | DELETE: 1 | PATCH: 0)

| Method | Endpoint | Description | Auth / Role |
| :--- | :--- | :--- | :--- |
| `POST` | `/dar/events/create` | POST operation on /dar/events/create | Authenticated |
| `GET` | `/dar/events/list` | GET operation on /dar/events/list | Authenticated |
| `PUT` | `/dar/events/update/:id` | PUT operation on /dar/events/update/:id | Authenticated |
| `DELETE` | `/dar/events/delete/:id` | DELETE operation on /dar/events/delete/:id | Authenticated |
| `GET` | `/dar/events/admin/all` | GET operation on /dar/events/admin/all | Authenticated |

---

## 10. Daily Activity Reports (Requests) (`/dar/requests`)

> **Module Stats**: **4 Total Endpoints** (GET: 1 | POST: 3 | PUT: 0 | DELETE: 0 | PATCH: 0)

| Method | Endpoint | Description | Auth / Role |
| :--- | :--- | :--- | :--- |
| `POST` | `/dar/requests/create` | POST operation on /dar/requests/create | Authenticated |
| `GET` | `/dar/requests/list` | GET operation on /dar/requests/list | Authenticated |
| `POST` | `/dar/requests/approve/:id` | POST operation on /dar/requests/approve/:id | Authenticated |
| `POST` | `/dar/requests/reject/:id` | POST operation on /dar/requests/reject/:id | Authenticated |

---

## 11. Daily Activity Reports (Settings) (`/dar/settings`)

> **Module Stats**: **2 Total Endpoints** (GET: 1 | POST: 1 | PUT: 0 | DELETE: 0 | PATCH: 0)

| Method | Endpoint | Description | Auth / Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/dar/settings/list` | GET operation on /dar/settings/list | Authenticated |
| `POST` | `/dar/settings/update` | POST operation on /dar/settings/update | Authenticated |

---

## 12. Daily Activity Reports (AI & Reports API) (`/dar/reports`)

> **Module Stats**: **6 Total Endpoints** (GET: 3 | POST: 2 | PUT: 0 | DELETE: 1 | PATCH: 0)

| Method | Endpoint | Description | Auth / Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/dar/reports/preview` | Preview filtered attendance/workforce report | Authenticated |
| `POST` | `/dar/reports/preview/client` | Preview filtered attendance/workforce report | Authenticated |
| `GET` | `/dar/reports/history` | GET operation on /dar/reports/history | Authenticated |
| `GET` | `/dar/reports/schedules` | GET operation on /dar/reports/schedules | Authenticated |
| `POST` | `/dar/reports/schedules` | POST operation on /dar/reports/schedules | Authenticated |
| `DELETE` | `/dar/reports/schedules/:frequency` | DELETE operation on /dar/reports/schedules/:frequency | Authenticated |

---

## 13. Team Collaboration & Real-Time Chat (`/collaboration`)

> **Module Stats**: **9 Total Endpoints** (GET: 3 | POST: 3 | PUT: 2 | DELETE: 1 | PATCH: 0)

| Method | Endpoint | Description | Auth / Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/collaboration/users` | GET operation on /collaboration/users | Authenticated |
| `GET` | `/collaboration/rooms` | GET operation on /collaboration/rooms | Authenticated |
| `POST` | `/collaboration/rooms` | POST operation on /collaboration/rooms | Authenticated |
| `GET` | `/collaboration/rooms/:roomId/messages` | Fetch message history for channel | Authenticated |
| `POST` | `/collaboration/rooms/:roomId/messages` | Send message with attachments & @mentions | Authenticated |
| `POST` | `/collaboration/rooms/:roomId/upload` | POST operation on /collaboration/rooms/:roomId/upload | Authenticated |
| `PUT` | `/collaboration/rooms/:roomId/read` | PUT operation on /collaboration/rooms/:roomId/read | Authenticated |
| `PUT` | `/collaboration/rooms/:roomId/members` | PUT operation on /collaboration/rooms/:roomId/members | Authenticated |
| `DELETE` | `/collaboration/rooms/:roomId` | DELETE operation on /collaboration/rooms/:roomId | Authenticated |

---

## 14. Notifications & Push Service (`/notifications`)

> **Module Stats**: **6 Total Endpoints** (GET: 1 | POST: 3 | PUT: 2 | DELETE: 0 | PATCH: 0)

| Method | Endpoint | Description | Auth / Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/notifications` | Retrieve user notifications with pagination | Authenticated |
| `PUT` | `/notifications/:id/read` | Mark individual notification as read | Authenticated |
| `PUT` | `/notifications/read-all` | Mark all user notifications as read | Authenticated |
| `POST` | `/notifications/register-token` | Register Firebase FCM device push token | Authenticated |
| `POST` | `/notifications/unregister-token` | Register Firebase FCM device push token | Authenticated |
| `POST` | `/notifications/test-push` | Trigger test push notification | Authenticated |

---

## 15. User Profile & Preferences (`/profile`)

> **Module Stats**: **4 Total Endpoints** (GET: 1 | POST: 1 | PUT: 0 | DELETE: 1 | PATCH: 1)

| Method | Endpoint | Description | Auth / Role |
| :--- | :--- | :--- | :--- |
| `POST` | `/profile` | Upload user profile avatar | Authenticated |
| `DELETE` | `/profile` | Delete user profile avatar | Authenticated |
| `GET` | `/profile/me` | Fetch logged-in user profile | Authenticated |
| `PATCH` | `/profile/preferences` | Update user theme, notification & UI preferences | Authenticated |

---

## 16. User Feedback & Support Tickets (`/feedback`)

> **Module Stats**: **3 Total Endpoints** (GET: 1 | POST: 1 | PUT: 0 | DELETE: 0 | PATCH: 1)

| Method | Endpoint | Description | Auth / Role |
| :--- | :--- | :--- | :--- |
| `POST` | `/feedback` | Submit feedback with optional file attachments | Authenticated |
| `GET` | `/feedback` | List submitted feedback items for review | Authenticated |
| `PATCH` | `/feedback/:id/status` | Update feedback status (OPEN, IN_PROGRESS, RESOLVED) | Authenticated |

---

## 17. Payments & Subscriptions (Razorpay) (`/payment`)

> **Module Stats**: **3 Total Endpoints** (GET: 0 | POST: 3 | PUT: 0 | DELETE: 0 | PATCH: 0)

| Method | Endpoint | Description | Auth / Role |
| :--- | :--- | :--- | :--- |
| `POST` | `/payment/create-customer` | Register customer profile on Razorpay | Public |
| `POST` | `/payment/create-order` | Generate Razorpay payment order for subscription | Public |
| `POST` | `/payment/verify` | Verify payment signature & activate subscription plan | Public |

---

## 18. Multi-Tenant Organizations (`/organizations`)

> **Module Stats**: **10 Total Endpoints** (GET: 5 | POST: 2 | PUT: 2 | DELETE: 1 | PATCH: 0)

| Method | Endpoint | Description | Auth / Role |
| :--- | :--- | :--- | :--- |
| `POST` | `/organizations` | Provision a new tenant organization | Authenticated |
| `GET` | `/organizations` | List all tenant organizations | Authenticated |
| `GET` | `/organizations/check-code` | Verify organization code slug availability | Authenticated |
| `PUT` | `/organizations/:id` | Update organization profile & settings | Authenticated |
| `DELETE` | `/organizations/:id` | Schedule organization deletion | Authenticated |
| `POST` | `/organizations/:id/cancel-deletion` | Revoke scheduled organization deletion | Authenticated |
| `GET` | `/organizations/:id/admins` | List administrators of an organization | Authenticated |
| `PUT` | `/organizations/:id/admins/:adminId` | Update organization admin privileges | Authenticated |
| `GET` | `/organizations/:id/analytics` | Get tenant usage & headcount metrics | Authenticated |
| `GET` | `/organizations/:id/logs` | View audit logs for an organization | Authenticated |

---

## 19. Work Locations & Geofences (`/locations`)

> **Module Stats**: **5 Total Endpoints** (GET: 1 | POST: 2 | PUT: 1 | DELETE: 1 | PATCH: 0)

| Method | Endpoint | Description | Auth / Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/locations` | List configured work locations & branch coordinates | Authenticated |
| `POST` | `/locations` | Create new geofenced work location | Admin / HR |
| `PUT` | `/locations/:id` | Update GPS coordinates & radius boundary | Admin / HR |
| `DELETE` | `/locations/:id` | Remove a work location | Admin / HR |
| `POST` | `/locations/assignments` | Bulk assign employees to work location | Admin / HR |

---

## 20. Contractor & Labour Management (`/labour`)

> **Module Stats**: **13 Total Endpoints** (GET: 7 | POST: 5 | PUT: 0 | DELETE: 1 | PATCH: 0)

| Method | Endpoint | Description | Auth / Role |
| :--- | :--- | :--- | :--- |
| `POST` | `/labour/labours/bulk` | Register contract worker profile | Authenticated |
| `GET` | `/labour/labours/bulk/template` | List contract workers & contractor rosters | Authenticated |
| `POST` | `/labour/labours/bulk/parse` | Register contract worker profile | Authenticated |
| `POST` | `/labour/labours/bulk-transfer` | Register contract worker profile | Authenticated |
| `GET` | `/labour/labours/:id/history` | List contract workers & contractor rosters | Authenticated |
| `GET` | `/labour/attendance/monthly-summary` | List contract workers & contractor rosters | Authenticated |
| `GET` | `/labour/finances/summary` | List contract workers & contractor rosters | Authenticated |
| `GET` | `/labour/finances/detailed-ledger` | List contract workers & contractor rosters | Authenticated |
| `GET` | `/labour/finances/export-excel` | List contract workers & contractor rosters | Authenticated |
| `POST` | `/labour/finances/advance` | Register contract worker profile | Authenticated |
| `GET` | `/labour/finances/advances` | List contract workers & contractor rosters | Authenticated |
| `DELETE` | `/labour/finances/advance/:id` | DELETE operation on /labour/finances/advance/:id | Authenticated |
| `POST` | `/labour/finances/payout` | Register contract worker profile | Authenticated |

---

## 21. Holiday Calendar (`/holiday`)

> **Module Stats**: **7 Total Endpoints** (GET: 1 | POST: 4 | PUT: 1 | DELETE: 1 | PATCH: 0)

| Method | Endpoint | Description | Auth / Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/holiday` | List organization holiday calendar | Authenticated |
| `POST` | `/holiday` | Add new holiday to calendar | Admin / HR |
| `POST` | `/holiday/bulk-validate` | Add new holiday to calendar | Admin / HR |
| `POST` | `/holiday/bulk-json` | Add new holiday to calendar | Admin / HR |
| `POST` | `/holiday/bulk` | Add new holiday to calendar | Admin / HR |
| `PUT` | `/holiday/:id` | Update holiday date/description | Admin / HR |
| `DELETE` | `/holiday` | Remove holiday from calendar | Admin / HR |

---

## 22. Reports & Data Exports (`/admin/reports`)

> **Module Stats**: **3 Total Endpoints** (GET: 3 | POST: 0 | PUT: 0 | DELETE: 0 | PATCH: 0)

| Method | Endpoint | Description | Auth / Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/admin/reports/preview` | Preview filtered attendance/workforce report | Admin / HR |
| `GET` | `/admin/reports/download` | Trigger asynchronous Excel/CSV/PDF export job | Admin / HR |
| `GET` | `/admin/reports/status/:reportId` | Poll BullMQ background report generation status | Admin / HR |

---

## 23. Super Admin & System Monitoring (`/super-admin`)

> **Module Stats**: **9 Total Endpoints** (GET: 6 | POST: 1 | PUT: 2 | DELETE: 0 | PATCH: 0)

| Method | Endpoint | Description | Auth / Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/super-admin/dashboard-stats` | Platform-wide cross-tenant stats & metrics | Super Admin |
| `GET` | `/super-admin/monitor/alerts` | GET operation on /super-admin/monitor/alerts | Super Admin |
| `PUT` | `/super-admin/monitor/alerts/:id` | PUT operation on /super-admin/monitor/alerts/:id | Super Admin |
| `GET` | `/super-admin/monitor/feedback` | List submitted feedback items for review | Super Admin |
| `PUT` | `/super-admin/monitor/feedback/:id` | PUT operation on /super-admin/monitor/feedback/:id | Super Admin |
| `GET` | `/super-admin/monitor/pm2-logs` | PM2 node process cluster health status | Super Admin |
| `GET` | `/super-admin/monitor/api-analytics` | GET operation on /super-admin/monitor/api-analytics | Super Admin |
| `GET` | `/super-admin/monitor/debug-logs` | GET operation on /super-admin/monitor/debug-logs | Super Admin |
| `POST` | `/super-admin/monitor/client-errors` | POST operation on /super-admin/monitor/client-errors | Super Admin |

---

## 24. AI Chatbot, Geolocation & Internal Tools (`/geo`)

> **Module Stats**: **8 Total Endpoints** (GET: 6 | POST: 2 | PUT: 0 | DELETE: 0 | PATCH: 0)

| Method | Endpoint | Description | Auth / Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/geo/countries` | List countries for address forms | Public |
| `GET` | `/geo/states/:country_code` | List states for given country code | Public |
| `GET` | `/geo/cities/:country_code/:state_code` | List cities for given country and state | Public |
| `POST` | `/website-chatbot/ask` | Public AI chatbot query (RAG knowledge base) | Public |
| `POST` | `/website-chatbot/ask-internal` | Public AI chatbot query (RAG knowledge base) | Authenticated |
| `GET` | `/website-chatbot/guide` | Public AI chatbot query (RAG knowledge base) | Authenticated |
| `GET` | `/internal/guide` | Internal app user guide JSON for assistant | Authenticated |
| `GET` | `/health` | Backend service health and liveness check | Public |

---

