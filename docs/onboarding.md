# Tutorial: Getting Started (Local Dev Setup)

> Place this file at /docs/onboarding.md. This is the ONE tutorial (Diataxis)
> doc in the repo, written for someone who has never touched the codebase.
> Unlike how-to guides, it's okay to explain a little "why" here so a
> newcomer builds a real mental model, not just a working setup.
> Keep this current — it's the first thing every new hire runs.

## What you'll have by the end
A working local copy of the Mano Backend API service running against local MySQL and Redis instances, responding to health checks on port 5002, with hot-reloading enabled, and verified by making a safe first code change and opening a PR.

## 1. Prerequisites
Before beginning, verify you have the following installed on your machine:
- **Node.js**: Version 20.19+ or 22.12+ (LTS recommended)
- **npm**: Version 10+
- **MySQL**: Server 8.0+ running locally (default dev port is 3307 or 3306)
- **Redis**: Server 6.0+ running locally on port 6379 (or running via Docker: `docker run -p 6379:6379 -d redis:alpine`)
- **Git**: Installed and configured with your GitHub credentials

## 2. Clone and install
Clone the repository and install dependencies:

```bash
git clone <repo-url>
cd MANO-HRM-Web
npm install
npm install --prefix backend
```

*Note: You can also run `npm run install:all` from the project root to install root and workspace dependencies simultaneously.*

## 3. Environment setup
The backend reads its configuration from `backend/.env`.

1. Create the `backend/.env` file in the `backend/` directory.
2. Populate the required environment keys (ask the team lead for shared dev credentials and S3/Firebase sandbox keys):

```ini
# Server runtime
NODE_ENV=development
PORT=5002
URI=127.0.0.1
FRONTEND_URL=http://localhost:5173

# Relational Database (MySQL)
DB_HOST=127.0.0.1
DB_PORT=3307
DB_ADMIN_USER=dev-admin
DB_ADMIN_PASSWORD=your_local_password
DB_ADMIN_NAME=Attendance_DB
ATTENDANCE_DB_USER=attendance_app
ATTENDANCE_DB_PASSWORD=your_local_password
ATTENDANCE_DB_NAME=Attendance_DB
PAYMENT_DB_USER=Payment_admin
PAYMENT_DB_PASSWORD=your_local_password
PAYMENT_DB_NAME=RazorPayments_db

# Redis Cache & Background Queues
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Authentication
JWT_SECRET=your_dev_jwt_secret_min_32_chars
JWT_REFRESH_SECRET=your_dev_jwt_refresh_secret_min_32_chars

# Cloud Storage (AWS S3)
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=your_s3_key_id
S3_SECRET_ACCESS_KEY=your_s3_secret_key
S3_BUCKET=mano-attendance

# Push Notifications (Firebase Admin SDK)
FIREBASE_PROJECT_ID=attendance-app-14f60
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="your_private_key"
```

> [!IMPORTANT]
> Never commit `.env` or actual secret credentials to git. The `.gitignore` file enforces this repository-wide.

## 4. Run it locally
Start the backend development server using nodemon for automatic reloads on file changes:

```bash
npm run server
```
*(Or navigate to `backend/` and run `npm run dev`)*

You should see nodemon start the server:
```text
[nodemon] starting `node server.js`
Server running in development mode on port 5002
```

In a separate terminal, verify that the backend is responding:
```bash
curl http://localhost:5002/health
```

Expected JSON response:
```json
{
  "status": "success",
  "message": "Backend service is running",
  "timestamp": "2026-09-26T...",
  "uptime": 1.42
}
```

## 5. Make your first change
To get familiar with the codebase and the team's review workflow, make a safe first change to the health check endpoint:

1. Open `backend/src/app.js` in your editor.
2. Locate the `/health` endpoint definition (around line 57):
   ```javascript
   app.get(['/health', '/api/health'], (req, res) => {
       res.status(200).json({
           status: 'success',
           message: 'Backend service is running',
           timestamp: new Date().toISOString(),
           uptime: process.uptime()
       });
   });
   ```
3. Add a temporary test field, for example:
   ```javascript
           version: '1.0.0-dev',
   ```
4. Save the file. Check your running server terminal — nodemon should instantly reload the app.
5. Verify the change by curling the health check:
   ```bash
   curl http://localhost:5002/health
   ```
   Confirm `"version": "1.0.0-dev"` appears in the JSON output.
6. Create a new branch, commit the change, and push to GitHub:
   ```bash
   git checkout -b test/first-healthcheck-change
   git commit -am "chore: verify local setup with healthcheck version property"
   git push origin test/first-healthcheck-change
   ```
7. Open a Pull Request on GitHub and request a review from your teammate to complete the onboarding walkthrough.

## 6. Where to go next
- Module facts and technical reference: `/backend/src/modules/*/README.md` (Reference)
- Business context per feature: `/docs/features/` (Explanation)
- Why things are built a certain way: `/docs/adr/` (Decisions)
- Common repeatable recipes: `/docs/how-to/` (How-to)
