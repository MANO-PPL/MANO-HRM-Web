# Mano Workforce Intelligence Platform - Backend Architecture

## Overview
The Mano Backend is an enterprise-grade Node.js/Express application designed for workforce management, real-time geofenced attendance tracking, automated payroll, multi-channel chat collaboration, and AI-driven intelligence.

---

## Directory Structure & Module Index

```
backend/
├── src/
│   ├── app.js                         # Express app configuration & middleware
│   ├── server.js                      # HTTP & Socket.io server bootstrap
│   ├── config/                        # [Config Documentation](file:///src/config/README.md)
│   ├── middleware/                    # [Middleware Documentation](file:///src/middleware/README.md)
│   ├── routes/                        # [Routes Module Index](file:///src/routes/)
│   ├── controllers/                   # [Controllers Module Index](file:///src/controllers/)
│   ├── services/                      # [Services Module Index](file:///src/services/)
│   ├── cron/                          # [Cron Schedulers](file:///src/cron/README.md)
│   ├── workers/                       # [Background Workers](file:///src/workers/README.md)
│   └── utils/                         # [Utilities](file:///src/utils/README.md)
├── services/
│   └── ai_summary/                    # [AI Summary Microservice](file:///services/ai_summary/README.md)
└── scripts/                           # [Database & Diagnostic Scripts](file:///scripts/README.md)
```

---

## Module Index

| Domain / Feature | Controller Docs | Route Docs | Service Docs |
| :--- | :--- | :--- | :--- |
| **Admin** | [Controller](file:///src/controllers/admin/README.md) | [Routes](file:///src/routes/admin/README.md) | [Service](file:///src/services/admin/README.md) |
| **Attendance** | [Controller](file:///src/controllers/attendance/README.md) | [Routes](file:///src/routes/attendance/README.md) | [Service](file:///src/services/attendance/README.md) |
| **Authentication** | [Controller](file:///src/controllers/auth/README.md) | [Routes](file:///src/routes/auth/README.md) | [Service](file:///src/services/auth/README.md) |
| **Chatbot & RAG** | [Controller](file:///src/controllers/chatbot/README.md) | [Routes](file:///src/routes/chatbot/README.md) | [Service](file:///src/services/chatbot/README.md) |
| **Collaboration / Chat** | [Controller](file:///src/controllers/collaboration/README.md) | [Routes](file:///src/routes/collaboration/README.md) | [Service](file:///src/services/collaboration/README.md) |
| **Daily Activity Reports (DAR)** | [Controller](file:///src/controllers/darControllers/README.md) | [Routes](file:///src/routes/darRoutes/README.md) | [Service](file:///src/services/darServices/README.md) |
| **Employees & Onboarding** | [Controller](file:///src/controllers/employees/README.md) | [Routes](file:///src/routes/employees/README.md) | [Service](file:///src/services/employees/README.md) |
| **Feedback** | [Controller](file:///src/controllers/feedback/README.md) | [Routes](file:///src/routes/feedback/README.md) | [Service](file:///src/services/feedback/README.md) |
| **Holidays** | [Controller](file:///src/controllers/holidays/README.md) | [Routes](file:///src/routes/holidays/README.md) | [Service](file:///src/services/holiday/README.md) |
| **Internal UI** | [Controller](file:///src/controllers/internal/README.md) | [Routes](file:///src/routes/internal/README.md) | - |
| **Labour Rostering** | [Controller](file:///src/controllers/labour/README.md) | [Routes](file:///src/routes/labour/README.md) | - |
| **Leaves & Balance** | [Controller](file:///src/controllers/leaves/README.md) | [Routes](file:///src/routes/leaves/README.md) | [Service](file:///src/services/leaves/README.md) |
| **Locations / Geofencing** | [Controller](file:///src/controllers/workLocations/README.md) | [Routes](file:///src/routes/workLocations/README.md) | [Service](file:///src/services/workLocations/README.md) |
| **Notifications & Push** | [Controller](file:///src/controllers/notifications/README.md) | [Routes](file:///src/routes/notifications/README.md) | [Service](file:///src/services/notifications/README.md) |
| **Organizations** | [Controller](file:///src/controllers/organizations/README.md) | [Routes](file:///src/routes/organizations/README.md) | - |
| **Payment & Billing** | [Controller](file:///src/controllers/payment/README.md) | [Routes](file:///src/routes/payment/README.md) | [Service](file:///src/services/payment/README.md) |
| **Payroll Engine** | [Controller](file:///src/controllers/payroll/README.md) | [Routes](file:///src/routes/payroll/README.md) | [Service](file:///src/services/payroll/README.md) |
| **Policies & Shifts** | [Controller](file:///src/controllers/shifts/README.md) | [Routes](file:///src/routes/policies/README.md) | [Service](file:///src/services/shifts/README.md) |
| **Profile** | [Controller](file:///src/controllers/profile/README.md) | [Routes](file:///src/routes/profile/README.md) | [Service](file:///src/services/profile/README.md) |
| **Reports & Exports** | [Controller](file:///src/controllers/reports/README.md) | [Routes](file:///src/routes/reports/README.md) | [Service](file:///src/services/reports/README.md) |
| **Super Admin** | [Controller](file:///src/controllers/superAdmin/README.md) | [Routes](file:///src/routes/superAdmin/README.md) | [Service](file:///src/services/superAdmin/README.md) |
| **Cache Layer** | - | - | [Service](file:///src/services/cache/README.md) |
| **Cloud Storage (S3)** | - | - | [Service](file:///src/services/s3/README.md) |
| **Google Maps Services** | - | - | [Service](file:///src/services/google_api_services/README.md) |
| **Users Service** | - | - | [Service](file:///src/services/users/README.md) |

---

## Technical Stack & Infrastructure
- **Server Framework**: Node.js, Express 5.x
- **Database Layer**: Knex.js Query Builder (PostgreSQL / MySQL / SQLite)
- **Caching & Pub/Sub**: Redis (ioredis)
- **Real-time Pipeline**: Socket.io WebSocket server
- **Message Queues**: BullMQ
- **Cloud Storage**: Amazon S3 (AWS SDK v3)
- **Payments**: Razorpay Checkout SDK
- **AI / LLM Integration**: Groq Cloud SDK (Llama 3.3), Xenova Transformers, ChromaDB
