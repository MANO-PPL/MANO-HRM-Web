# Notification System Implementation Walkthrough

We have successfully integrated the Firebase Cloud Messaging (FCM) and WebSocket notification pipelines for all critical platform activities, ensuring both **foreground (on-screen)** and **background (off-app/browser push)** alerts work seamlessly.

---

## 🛠️ Changes Implemented

### 1. Mentions Notification Pipeline
* **File Modified**: [mentionService.js](file:///c:/Users/madha/OneDrive/Desktop/Attendance-Web/backend/src/services/collaboration/mentionService.js)
* **Change**: Replaced the manual direct Knex DB insert and raw Socket emit for mentions. It now publishes events via `EventBus.emitNotification`, ensuring mentions automatically trigger:
  1. Safe database persistence in the `notifications` table.
  2. Live WebSockets message broadcasts (`new-notification` event).
  3. FCM browser background push notifications to the tagged user.

### 2. Leave Request & Approval Events
* **File Modified**: [chatAlertService.js](file:///c:/Users/madha/OneDrive/Desktop/Attendance-Web/backend/src/services/collaboration/chatAlertService.js)
* **Change**: Integrated `EventBus.emitNotification` calls for leave workflows:
  * **Submit Leave**: Automatically sends a standard push notification to all organization Admins and HRs informing them of the new leave request.
  * **Leave Status Update**: Automatically pushes a standard notification to the requesting employee indicating whether their leave was *Approved* or *Rejected*.

### 3. Attendance Correction Events
* **File Modified**: [chatAlertService.js](file:///c:/Users/madha/OneDrive/Desktop/Attendance-Web/backend/src/services/collaboration/chatAlertService.js)
* **Change**: Added EventBus notifications to the correction workflow:
  * **Apply Correction**: Pushes standard browser notifications to organization Admins and HRs.
  * **Review Correction**: Sends a push notification to the employee indicating whether the correction was approved or rejected.

### 4. Admin Policy Assignment Events
* **File Modified**: [chatAlertService.js](file:///c:/Users/madha/OneDrive/Desktop/Attendance-Web/backend/src/services/collaboration/chatAlertService.js)
* **Change**: Standard push notifications are now sent when:
  * **Shift Assigned**: Notifies the employee with their new shift rules and timings.
  * **Geofence Zone Assigned**: Notifies the employee of their newly assigned work boundaries.

### 8. Verify Bulk Upload with Joining Date and Reporting Manager Resolution
1. Open the **Active Directory / Employee Master** page and select **Bulk Upload**.
2. Click **Download Sample CSV Template** and verify it contains the `Joining Date` and `Reporting Manager` headers.
3. Prepare a CSV file where:
   - Row 1: A manager who is not in the system (e.g. `Sourabh Sutar`, Design: `VP of Engineering`).
   - Row 2: An employee (e.g. `Jane Doe`) whose `Reporting Manager` column is set to `Sourabh Sutar`.
4. Upload the CSV. Verify that both users are imported successfully.
5. In the directory, view `Jane Doe`'s details and check that:
   - Her `Joining Date` is correctly set and displays without flickering.
   - Her `Reporting Manager` is automatically resolved and formatted as `Sourabh Sutar (VP of Engineering)`.

### 10. Preview Screen and Fuzzy Manager Match Enhancements
* **Desktop Preview Columns**: Added "Joining Date" and "Reporting Manager" columns to the preview table in [BulkUpload.jsx](file:///Users/sathish/Documents/Internship/Mano-PPL/MANO-Attendance-Website/MANO-Attendance/frontend/src/pages/employees/BulkUpload.jsx).
* **Mobile Preview Enhancements**: Added parser support and formatted details ("Joined: ..." / "Manager: ...") inside the card layouts of the mobile view [BulkUpload-mv.jsx](file:///Users/sathish/Documents/Internship/Mano-PPL/MANO-Attendance-Website/MANO-Attendance/frontend/src/pages/employees/BulkUpload-mv.jsx).
* **Fuzzy/Prefix Manager Matching**: Upgraded the two-pass resolution logic in `userService.js` to perform case-insensitive fuzzy prefix matching. If an employee lists `"kesavan"`, it successfully matches and links `"Kesavan M. (Senior Manager)"`.
* **Dynamic Python Interpreter Resolution**: Fixed the `Python process exited with non-zero status code` error in [recruitmentController.js](file:///Users/sathish/Documents/Internship/Mano-PPL/MANO-Attendance-Website/MANO-Attendance/backend/src/controllers/recruitmentController.js) by implementing an automated python detection helper (`getPythonExecutable`). This utility scans `python3.12`, `python3`, and `python` and selects the one with required AI modules (`groq`, `pydantic`, `pypdf`) installed.
* **Free-Text Work Location Input**: Converted the Work Location field from a geofence selection dropdown to a free-text input field in the employee creation and profile edit forms ([EmployeeFormContent.jsx](file:///Users/sathish/Documents/Internship/Mano-PPL/MANO-Attendance-Website/MANO-Attendance/frontend/src/components/employees/EmployeeFormContent.jsx)). Updated the backend ([userService.js](file:///Users/sathish/Documents/Internship/Mano-PPL/MANO-Attendance-Website/MANO-Attendance/backend/src/services/users/userService.js)) to save the typed location text directly. To maintain geofencing functionality, if the typed text matches an organization geofence location name, the backend automatically links the user to it in the `user_work_locations` table.
* **Bulk Upload Work Location**: Updated the CSV/Excel template and parser in both desktop ([BulkUpload.jsx](file:///Users/sathish/Documents/Internship/Mano-PPL/MANO-Attendance-Website/MANO-Attendance/frontend/src/pages/employees/BulkUpload.jsx)) and mobile ([BulkUpload-mv.jsx](file:///Users/sathish/Documents/Internship/Mano-PPL/MANO-Attendance-Website/MANO-Attendance/frontend/src/pages/employees/BulkUpload-mv.jsx)) views to support the new "Work Location" text column, and added it to the import preview tables/lists.


### 5. Chat Messages Unified Notification
* **File Modified**: [chatController.js](file:///c:/Users/madha/OneDrive/Desktop/Attendance-Web/backend/src/controllers/collaboration/chatController.js)
* **Change**: Refactored `sendMessage` to trigger `EventBus.emitNotification` for all other members of the room when a new message or attachment is posted. This ensures chat messages automatically get:
  1. Stored in the `notifications` DB table.
  2. Broadcast via Socket.IO `new-notification` event (triggering an on-screen toast popup outside the chat window).
  3. Pushed via FCM (triggering off-app background banners/lock screen alerts).

### 6. Frontend Notifications UI Icon Mapping
* **File Modified**: [Notifications-mv.jsx](file:///c:/Users/madha/OneDrive/Desktop/Attendance-Web/frontend/src/pages/notifications/Notifications-mv.jsx)
* **Change**: Imported the Lucide `MessageSquare` icon and mapped the `CHAT`/`CHAT_MESSAGE` notification types to render it automatically in the notifications list.

### 7. User Feedback Submitted Push Alerts
* **File Modified**: [feedbackService.js](file:///c:/Users/madha/OneDrive/Desktop/Attendance-Web/backend/src/services/feedback/feedbackService.js)
* **Change**: Integrated `EventBus.emitNotification` inside `submitFeedback` to automatically dispatch standard DB-saved, WebSockets, and FCM background push alerts to all active Admins in the submitting user's organization when feedback is received.

### 8. Resolved Exposed Google API Key (GitHub Secret Alert)
* **Files Modified**: [firebase-messaging-sw.js](file:///c:/Users/madha/OneDrive/Desktop/Attendance-Web/frontend/public/firebase-messaging-sw.js) and [fcm.js](file:///c:/Users/madha/OneDrive/Desktop/Attendance-Web/frontend/src/services/fcm.js)
* **Change**: Removed the hardcoded sensitive Firebase API key and configuration credentials from the static service worker. Refactored `fcm.js` to pass active configurations dynamically as URL query parameters during Service Worker registration, and updated `firebase-messaging-sw.js` to parse these parameters at initialization time using `self.location.search`.

---

## 🧪 Validation & Verification

1. **Service Compilation**: The node server restarted automatically via nodemon with all imports and EventBus instances successfully resolved.
2. **Notification Pipeline Flow**:
   ```mermaid
   graph TD
     A[Trigger Event: Leave/Message/Correction/Mention] --> B[EventBus.emitNotification]
     B --> C[DB Persistence: notifications table]
     C --> D[Event: notification_saved]
     D --> E[Socket.io Broadcast: new-notification]
     D --> F[FCM Push Notification Service]
     E --> G[Web Client: On-Screen Toast]
     F --> H[Browser/App: Background Off-App Banner]
   ```

---

## 🚀 Next Steps for Testing
To verify push delivery on a live device:
1. Log in to the application and grant notification permissions when prompted.
2. The browser registers the FCM token to the server database.
3. Test your device connection using the test endpoint:
   * **Method**: `POST`
   * **URL**: `/notifications/test-push`
   * Check your desktop banner/mobile lock screen for the `FCM Connection Test` notification!

---

## 📋 Recruitment Form Side-by-Side Grid Layout

We have updated both the **Form Preview Modal** in the admin dashboard and the **Public Candidate Careers Form** to render adjacent `half`-width configured fields side-by-side rather than vertically stacked.

### 1. Form Preview Modal
* **File Modified**: [RecruitmentDashboard.jsx](file:///Users/sathish/Documents/Internship/Mano-PPL/MANO-Attendance-Website/MANO-Attendance/frontend/src/pages/recruitment/RecruitmentDashboard.jsx)
* **Details**: Changed the preview container from a flex column wrapper (`space-y-4`) to a CSS grid container (`grid grid-cols-1 md:grid-cols-2 gap-4`). Wrapped each field component in a div that dynamically sets `col-span-1` if configured as `half`-width, and `col-span-1 md:col-span-2` if it is a section header, divider, or full-width component. This causes consecutive half-width components to sit side-by-side on viewport widths above the `md` breakpoint.

### 2. Public Candidate Careers Form
* **File Modified**: [PublicJobOpening.jsx](file:///Users/sathish/Documents/Internship/Mano-PPL/MANO-Attendance-Website/MANO-Attendance/frontend/src/pages/recruitment/PublicJobOpening.jsx)
* **Details**: Updated the `renderField` method to wrap all key field types—including `textarea`, `radio_group`, `checkbox_group`, and `file` upload—with a CSS grid span class. When `field.width === 'half'`, it is assigned `col-span-2 sm:col-span-1` instead of `col-span-2`. This ensures that they behave responsively, sitting side-by-side on desktop/tablet views while stacking on narrow mobile viewports.

### 🧪 Verification Steps
1. Navigate to the Job Recruitment Dashboard and click **HR Document Studio** or edit a Job's application form.
2. Add consecutive fields and set their width toggle to **Half** (e.g. "Mobile Number" and "Current CTC").
3. Click **Preview** in the builder. Observe that the fields display side-by-side on the same row.
4. Save the form. Visit the public careers link (`/careers/:slug`) for that job.
5. Observe that the candidate application form displays these half-width fields side-by-side on desktop and stacked on mobile viewports.

---

## 📈 Employee Performance Dashboard API Integration

The Employee Performance page (`/performance`) has been migrated from mock local storage logic to pull directly from backend database APIs.

### 🛠️ Changes Implemented

#### 1. Database Schema
* **File Modified**: [databaseInit.js](file:///Users/sathish/Documents/Internship/Mano-PPL/MANO-Attendance-Website/MANO-Attendance/backend/src/config/databaseInit.js)
* **Details**: Added `ai_analysis_report` column as text (to store the compiled AI evaluation metrics and suggestions) inside `employee_performance_reviews` table. Added checks to add it dynamically via alter table on startup if missing.

#### 2. Backend Routes
* **File Modified**: [performanceGoalRoutes.js](file:///Users/sathish/Documents/Internship/Mano-PPL/MANO-Attendance-Website/MANO-Attendance/backend/src/routes/admin/performanceGoalRoutes.js)
* **Details**:
  * Implemented `GET /cycles` to fetch all performance cycles for the requester's organization. Since this route lacks the `ensureAdmin` constraint, employees can safely load the cycles list.
  * Updated the `POST /reviews` handler to parse, validate permissions (Admins/HRs only), and persist the JSON representation of `ai_analysis_report` to the database.

#### 3. Admin AI Compiler Integration
* **File Modified**: [PerformanceViews.jsx](file:///Users/sathish/Documents/Internship/Mano-PPL/MANO-Attendance-Website/MANO-Attendance/frontend/src/pages/performance/PerformanceViews.jsx)
* **Details**: Integrated a backend persistence call to `performanceGoalService.saveReview` with the computed `ai_analysis_report` JSON object when the manager runs the **AI Performance Audit** compiler. This makes the compiled results accessible to the employee.

#### 4. Frontend Employee Performance View
* **Files Modified**: [MyPerformance.jsx](file:///Users/sathish/Documents/Internship/Mano-PPL/MANO-Attendance-Website/MANO-Attendance/frontend/src/pages/performance/MyPerformance.jsx) & [MyPerformance-mv.jsx](file:///Users/sathish/Documents/Internship/Mano-PPL/MANO-Attendance-Website/MANO-Attendance/frontend/src/pages/performance/MyPerformance-mv.jsx)
* **Details**:
  * Cleaned up all static fallback arrays (`DEFAULT_CYCLES`, `getFallbackGoals`, `getFallbackReview`).
  * Replaced state initializations to retrieve data using `performanceGoalService.getPerformanceCycles()`, `performanceGoalService.getEmployeeGoals()`, and `performanceGoalService.getEmployeeReview()`.
  * Dynamically calculated average rating scores and formatted dial colors based on real KPIs returned by the database.
  * Extracted and displayed achievements, obstacles, manager recommendations, and AI audit reports from database rows.

### 🧪 Verification Steps
1. Create a performance cycle and assign a KPI target to a test employee as an admin.
2. In the Admin Dashboard under the test employee's performance hub, rate some KPIs, compile the **AI Performance Audit**, and save the appraisal comments/manager recommendation.
3. Log in as that employee and navigate to the `/performance` page.
4. Verify that cycles, KPI goals (ratings/comments), manager summary, self-appraisal achievements, and compiled AI audit statistics are fetched dynamically.
