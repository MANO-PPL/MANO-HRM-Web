# Mobile App Authentication Integration Guide (Flutter)

## 1. Overview & Purpose

### What We Are Doing
We are transitioning the mobile app from cookie/custom-header token transport to a standard, explicit **JSON-body token transport**.

### Why We Are Doing This
1. **Cookie Inconsistency on Mobile**: Web browsers handle `httpOnly` cookies automatically, but mobile operating systems (iOS Keychain, Android Keystore, Flutter HTTP clients, background workers) frequently encounter cookie-jar synchronization issues across network handoffs (Wi-Fi to LTE) and background app terminations.
2. **Explicit Token Ownership**: The Flutter app explicitly receives, securely stores, and sends tokens in JSON bodies.
3. **Per-Device Session Deduplication**: Using `X-Device-Id` and `X-Device-Name`, each physical device receives its own distinct session row in the database. Logging in on a mobile phone will never inadvertently sign out the user on their laptop or web browser.
4. **Machine-Readable Error Codes**: Instead of parsing generic English error strings, the app responds deterministically to stable error codes (e.g., `SESSION_REVOKED`, `ACCOUNT_INACTIVE`).
5. **Zero-Risk "Expand" Phase**: The backend supports both the old transport and this new transport concurrently. Deploying this change will not break existing apps or web users.

---

## 2. Architectural Contract

### Required HTTP Headers
Every API request sent from the mobile application must include the following headers:

| Header | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| `Content-Type` | String | `application/json` | Standard JSON payload |
| `X-Client-Type` | String | `mobile` | **Critical**: Tells backend to use JSON body transport and omit `Set-Cookie` |
| `X-App-Version` | String | `2.1.0` | App version from `package_info_plus` for telemetry & audit logs |
| `X-Device-Id` | String | `a1b2c3d4-e5f6-...` | Stable unique device ID from `device_info_plus` |
| `X-Device-Name` | String | `Pixel 8 Pro` | Human-readable device model for user active sessions list |

---

## 3. Endpoints & Payload Specifications

### 1. Login (`POST /auth/login`)
* **URL**: `/auth/login`
* **Request Headers**: Must include `X-Client-Type: mobile`
* **Request Body**:
  ```json
  {
    "user_input": "employee@company.com",
    "user_password": "MySecretPassword123!"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "d8f9a2b1c4e5...",
    "sessionId": 42,
    "user": {
      "id": 101,
      "user_code": "ORG-005",
      "user_name": "John Doe",
      "email": "employee@company.com",
      "user_type": "employee"
    }
  }
  ```
  *(Note: No `Set-Cookie` header is emitted).*

---

### 2. Token Refresh (`POST /auth/refresh`)
Called when any API request receives a `401 Unauthorized`.
* **URL**: `/auth/refresh`
* **Request Headers**: Must include `X-Client-Type: mobile`
* **Request Body**:
  ```json
  {
    "refreshToken": "d8f9a2b1c4e5..."
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "d8f9a2b1c4e5...",
    "sessionId": 42
  }
  ```
  *(Note: Store the returned `refreshToken` as sessions slide and extend for another 30 days).*

---

### 3. Logout (`POST /auth/logout`)
Called when the user explicitly signs out.
* **URL**: `/auth/logout`
* **Request Headers**: Must include `X-Client-Type: mobile`
* **Request Body**:
  ```json
  {
    "refreshToken": "d8f9a2b1c4e5..."
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "message": "Logged out successfully"
  }
  ```

---

## 4. Machine-Readable Error Contract (`AUTH_ERROR_CODES`)

When authentication fails, the backend returns:
```json
{
  "ok": false,
  "status": "fail",
  "code": "SESSION_REVOKED",
  "message": "Session has been revoked"
}
```

### Complete Code Catalog & Expected App Action

| Error Code | HTTP Status | Meaning | Recommended App Action |
| :--- | :---: | :--- | :--- |
| `SESSION_REVOKED` | 401 | Session was terminated from web or password changed | Clear local storage $\rightarrow$ redirect to Login $\rightarrow$ show *"Your session was ended from another device."* |
| `SESSION_EXPIRED` | 401 | Inactive for > 30 days | Clear local storage $\rightarrow$ redirect to Login $\rightarrow$ show *"Session expired. Please log in again."* |
| `INVALID_REFRESH_TOKEN`| 401 | Token unrecognized or corrupted | Clear local storage $\rightarrow$ redirect to Login. |
| `NO_REFRESH_TOKEN` | 401 | Refresh endpoint called with empty body | Prompt user to log in. |
| `TOKEN_EXPIRED` | 401 | Short-lived Access Token expired (15 mins) | **Trigger silent token refresh** via `/auth/refresh`. |
| `TOKEN_INVALID` | 401 | Access Token is malformed | Trigger token refresh; if fails, route to Login. |
| `INVALID_CREDENTIALS` | 401 | Username or password incorrect | Show inline error: *"Invalid email or password."* |
| `ACCOUNT_INACTIVE` | 401 / 403 | Employee deactivated by HR | Show dialog: *"Your account is inactive. Please contact HR."* |
| `ACCOUNT_DELETED` | 401 / 403 | Employee account marked deleted | Show dialog: *"Account deleted. Please contact support."* |
| `ORG_INACTIVE` | 403 | Organization subscription expired / locked | Show dialog: *"Your organization subscription is suspended."* |
| `ORG_DELETED` | 403 | Organization pending deletion / removed | Show dialog: *"Organization account has been removed."* |
| `REQUIRED_FIELDS_MISSING` | 400 | Missing required form input | Show validation feedback. |

---

## 5. Complete Flutter Implementation Blueprint

### File 1: `lib/core/constants/auth_error_codes.dart`
```dart
abstract class AuthErrorCodes {
  // Refresh Token & Session Lifecycle
  static const String invalidRefreshToken = 'INVALID_REFRESH_TOKEN';
  static const String noRefreshToken = 'NO_REFRESH_TOKEN';
  static const String sessionRevoked = 'SESSION_REVOKED';
  static const String sessionExpired = 'SESSION_EXPIRED';
  static const String sessionNotFound = 'SESSION_NOT_FOUND';

  // Access Token & JWT
  static const String tokenInvalid = 'TOKEN_INVALID';
  static const String tokenExpired = 'TOKEN_EXPIRED';
  static const String noToken = 'NO_TOKEN';
  static const String invalidUser = 'INVALID_USER';

  // Credentials & User Status
  static const String invalidCredentials = 'INVALID_CREDENTIALS';
  static const String accountInactive = 'ACCOUNT_INACTIVE';
  static const String accountDeleted = 'ACCOUNT_DELETED';

  // Organization Status
  static const String orgDeleted = 'ORG_DELETED';
  static const String orgInactive = 'ORG_INACTIVE';

  // Validation
  static const String requiredFieldsMissing = 'REQUIRED_FIELDS_MISSING';
}
```

---

### File 2: `lib/core/services/auth_storage_service.dart`
```dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthStorageService {
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  static const _kAccessToken = 'auth_access_token';
  static const _kRefreshToken = 'auth_refresh_token';
  static const _kSessionId = 'auth_session_id';

  Future<void> saveAuthData({
    required String accessToken,
    required String refreshToken,
    required int sessionId,
  }) async {
    await Future.wait([
      _storage.write(key: _kAccessToken, value: accessToken),
      _storage.write(key: _kRefreshToken, value: refreshToken),
      _storage.write(key: _kSessionId, value: sessionId.toString()),
    ]);
  }

  Future<String?> getAccessToken() => _storage.read(key: _kAccessToken);
  Future<String?> getRefreshToken() => _storage.read(key: _kRefreshToken);
  Future<String?> getSessionId() => _storage.read(key: _kSessionId);

  Future<void> clearAuthData() async {
    await _storage.deleteAll();
  }
}
```

---

### File 3: `lib/core/network/auth_interceptor.dart`
Using `Dio` with `QueuedInterceptor` so parallel 401s queue up while a single refresh runs:

```dart
import 'package:dio/dio.dart';
import '../constants/auth_error_codes.dart';
import '../services/auth_storage_service.dart';

class AuthInterceptor extends QueuedInterceptor {
  final Dio dio;
  final AuthStorageService storage;
  final String appVersion;
  final String deviceId;
  final String deviceName;
  final void Function(String message) onSessionTerminated;

  AuthInterceptor({
    required this.dio,
    required this.storage,
    required this.appVersion,
    required this.deviceId,
    required this.deviceName,
    required this.onSessionTerminated,
  });

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    // 1. Attach Required Transport Headers
    options.headers['X-Client-Type'] = 'mobile';
    options.headers['X-App-Version'] = appVersion;
    options.headers['X-Device-Id'] = deviceId;
    options.headers['X-Device-Name'] = deviceName;

    // 2. Attach Access Token if available
    final accessToken = await storage.getAccessToken();
    if (accessToken != null && !options.headers.containsKey('Authorization')) {
      options.headers['Authorization'] = 'Bearer $accessToken';
    }

    return handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    // Check if error is 401 and not the refresh endpoint itself
    final is401 = err.response?.statusCode == 401;
    final isRefreshRoute = err.requestOptions.path.contains('/auth/refresh');

    if (is401 && !isRefreshRoute) {
      final refreshToken = await storage.getRefreshToken();
      if (refreshToken == null) {
        await storage.clearAuthData();
        onSessionTerminated("Please log in to continue.");
        return handler.next(err);
      }

      try {
        // Attempt Token Refresh via JSON Body
        final refreshResponse = await dio.post(
          '/auth/refresh',
          data: {'refreshToken': refreshToken},
          options: Options(headers: {'X-Client-Type': 'mobile'}),
        );

        if (refreshResponse.statusCode == 200) {
          final newAccessToken = refreshResponse.data['accessToken'];
          final newRefreshToken = refreshResponse.data['refreshToken'];
          final sessionId = refreshResponse.data['sessionId'] ?? 0;

          await storage.saveAuthData(
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            sessionId: sessionId is int ? sessionId : int.tryParse(sessionId.toString()) ?? 0,
          );

          // Retry the original request
          final retryOptions = err.requestOptions;
          retryOptions.headers['Authorization'] = 'Bearer $newAccessToken';

          final clonedResponse = await dio.fetch(retryOptions);
          return handler.resolve(clonedResponse);
        }
      } on DioException catch (refreshErr) {
        final errorCode = refreshErr.response?.data?['code'];
        await storage.clearAuthData();

        if (errorCode == AuthErrorCodes.sessionRevoked) {
          onSessionTerminated("Your session was signed out from another device.");
        } else if (errorCode == AuthErrorCodes.accountInactive) {
          onSessionTerminated("Your account is inactive. Please contact HR.");
        } else {
          onSessionTerminated("Session expired. Please log in again.");
        }
        return handler.next(refreshErr);
      }
    }

    return handler.next(err);
  }
}
```

---

## 6. Testing & Verification Checklist

Before releasing the Flutter build:
1. [ ] **Login Test**: Verify `/auth/login` receives `accessToken`, `refreshToken`, and `sessionId`. Confirm response has no `Set-Cookie`.
2. [ ] **Token Expiration Test**: Manually expire access token (or wait 15 mins) $\rightarrow$ verify the next API request automatically refreshes in background without logging user out.
3. [ ] **Multi-Device Test**:
   - Log in on Flutter App (Device A).
   - Log in on Web (Device B).
   - Log out on Web $\rightarrow$ confirm Flutter App stays signed in.
4. [ ] **Remote Session Revocation Test**:
   - Go to Web $\rightarrow$ Settings $\rightarrow$ Active Sessions $\rightarrow$ Revoke the mobile device.
   - Make any request on the mobile app $\rightarrow$ verify it receives `SESSION_REVOKED` and routes smoothly to the Login screen with an alert.
5. [ ] **Telemetry Audit**:
   - Check backend logs: confirm calls from your app output:
     ```text
     [AUTH_TRANSPORT] endpoint=/auth/login clientType=mobile transport=body ...
     [AUTH_TRANSPORT] endpoint=/auth/refresh clientType=mobile transport=body ...
     ```
