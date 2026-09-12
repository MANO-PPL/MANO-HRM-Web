# Utility Modules (`src/utils/`)

## Overview
The `src/utils/` directory contains reusable helper modules, custom error classes, logging abstractions, event bus implementations, cryptography tools, and client request parsers used across the application.

---

## File Manifest

| File | Category | Description |
| :--- | :--- | :--- |
| **`AppError.js`** | Error Handling | Custom operational error class extending native `Error` with HTTP status code and operational error flag. |
| **`catchAsync.js`** | Async Control | Higher-order wrapper for Express route handlers that catches rejected promises and passes them to `next(err)`. |
| **`Logger.js`** | Observability | Structured logging framework wrapping Winston / Console with colorized output, timestamps, and log file rotation. |
| **`EventBus.js`** | Event-Driven Architecture | Decoupled in-memory and Redis Pub/Sub event emitter for inter-module event notifications. |
| **`encryption.js`** | Security & Cryptography | AES-256-CBC encryption/decryption utilities for sensitive data fields and secure message channels. |
| **`clientInfo.js`** | Request Inspection | Extracts client IP, user-agent details, browser type, and geolocation headers from incoming HTTP requests. |

---

## Module Details & Usage Examples

### 1. `AppError.js` & `catchAsync.js`
Eliminates repetitive `try-catch` blocks and standardizes operational error handling:
```javascript
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

exports.getUser = catchAsync(async (req, res, next) => {
  const user = await userService.getUserById(req.params.id);
  if (!user) {
    return next(new AppError('User not found', 404));
  }
  res.status(200).json({ status: 'success', data: user });
});
```

### 2. `Logger.js`
Provides unified logging levels (`info`, `warn`, `error`, `debug`):
```javascript
const Logger = require('../utils/Logger');

Logger.info('Attendance process completed for org', { organizationId: 'ORG-1001' });
Logger.error('Failed to connect to external gateway', { error: err.message });
```

### 3. `EventBus.js`
Enables decoupled event-driven triggers:
```javascript
const EventBus = require('../utils/EventBus');

// Publish event
EventBus.emit('attendance.checked_in', { userId: '123', time: new Date() });

// Subscribe to event in another module
EventBus.on('attendance.checked_in', async (payload) => {
  // trigger notifications or cache invalidation
});
```

### 4. `encryption.js`
Encrypts and decrypts sensitive values:
```javascript
const { encrypt, decrypt } = require('../utils/encryption');

const cipherText = encrypt('Sensitive Payload');
const plainText = decrypt(cipherText);
```

### 5. `clientInfo.js`
Extracts rich request client metadata:
```javascript
const { getClientIp, getDeviceInfo } = require('../utils/clientInfo');

const ip = getClientIp(req);
const device = getDeviceInfo(req);
```
