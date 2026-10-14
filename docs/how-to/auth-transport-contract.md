# How-To: Decommission Legacy Mobile Auth Transports (Contract Phase)

> Place this file in /docs/how-to/. This is a HOW-TO (Diataxis) — a recipe
> for someone who already knows the system and needs to get one specific
> thing done. Not a tutorial (no need to explain why), not reference
> (this is action steps, not facts to look up).

## Goal
Safely decommission the legacy `X-Refresh-Token` header and mobile cookie fallback paths after all mobile clients in the field have migrated to the JSON body transport.

## Prerequisites
- Production logging aggregator access (CloudWatch, Datadog, or centralized server logs).
- The Flutter mobile release utilizing `X-Client-Type: mobile` and JSON body tokens has been 100% rolled out.
- Any legacy mobile app version relying on header/cookie transports has had mandatory app-update enforced.
- **Minimum 30-day quiet period**: At least 30 full days have elapsed since the sunset of legacy mobile builds with zero recorded legacy requests, because user sessions slide for up to 30 days on activity.

---

## Phases Context

1. **Expand Phase (Current)**:
   - Both transports operate concurrently.
   - Requests carrying `X-Client-Type: mobile` receive the new transport: JSON body responses for login/refresh with no `Set-Cookie`, body-based `refreshToken` consumption, and server-side `remember_me=true`.
   - Requests without `X-Client-Type: mobile` (web application and released mobile builds) take the existing paths (cookies and `X-Refresh-Token` headers).
   - Every login, refresh, and logout emits a structured `[AUTH_TRANSPORT]` audit log line.
2. **Contract Phase (This Guide)**:
   - Retire the `X-Refresh-Token` header inspection and mobile cookie fallback once traffic reaches zero.

---

## Steps

### 1. Audit and Count Legacy Transport Traffic

Every authentication event emits an unauthenticated metadata line structured as:
```text
[AUTH_TRANSPORT] endpoint=<path> clientType=<mobile|other> transport=<body|cookie|header> appVersion=<version> sessionId=<id>
```

Execute the following log queries over a 30-day window to evaluate legacy transport calls:

#### CloudWatch Logs Insights
```sql
fields @timestamp, endpoint, clientType, transport, appVersion, sessionId
| filter @message like /\[AUTH_TRANSPORT\]/
| filter transport = "header" or (clientType = "mobile" and transport = "cookie")
| stats count(*) as legacyCount by appVersion, transport, endpoint
| sort legacyCount desc
```

#### Datadog / LogQL
```text
@message:"[AUTH_TRANSPORT]" AND (transport:header OR (clientType:mobile AND transport:cookie))
```

#### Server Shell / Grep
```bash
# Count total legacy header requests in the active log
grep '\[AUTH_TRANSPORT\]' /var/log/app.log | grep 'transport=header' | wc -l

# Group legacy requests by appVersion and endpoint
grep '\[AUTH_TRANSPORT\]' /var/log/app.log | grep 'transport=header' | awk -F' ' '{print $4, $5, $6}' | sort | uniq -c
```

**Gate Condition**: `legacyCount` MUST be `0` for 30 consecutive calendar days across all production environments before proceeding to Step 2.

---

### 2. Remove Legacy Header and Mobile Cookie Paths

In `backend/src/modules/auth/authController.js`:

1. **Update `readRefreshToken`**:
   Remove the `req.headers['x-refresh-token']` fallback so only body and web cookies are recognized:
   ```javascript
   // Contract phase: header transport removed
   const readRefreshToken = (req) => {
       if (isMobileClient(req)) {
           return req.body?.refreshToken || null;
       }
       return req.cookies?.refreshToken || req.body?.refreshToken || null;
   };
   ```

2. **Update `getTransportFromReq`**:
   Remove `'header'` transport detection:
   ```javascript
   const getTransportFromReq = (req) => {
       if (isMobileClient(req)) return 'body';
       if (req.cookies?.refreshToken) return 'cookie';
       if (req.body?.refreshToken) return 'body';
       return 'cookie';
   };
   ```

3. **Update self-service session lookups**:
   In `getUserSessions` and `revokeOtherUserSessions`, ensure refresh token retrieval uses `readRefreshToken(req)`.

---

### 3. Update Integration Test Suites

1. In `backend/test/db/authTransport.db.test.js`:
   - Replace the legacy header acceptance test with a regression test confirming that `X-Refresh-Token` headers are ignored or return 401 `NO_REFRESH_TOKEN` when no body or cookie is provided.
2. Run database test suite to verify:
   ```bash
   npm run test:db
   ```

---

## Verify it worked

1. Send a POST request to `/auth/refresh` sending `X-Refresh-Token: <valid_token>` without cookie or body:
   - Expect `401 Unauthorized` with `{ code: "NO_REFRESH_TOKEN" }`.
2. Send a POST request to `/auth/refresh` with `X-Client-Type: mobile` and `{ "refreshToken": "<valid_token>" }` in body:
   - Expect `200 OK` with JSON body `{ accessToken, refreshToken, sessionId }` and no `Set-Cookie`.
3. Send a POST request to `/auth/refresh` from web browser with `Cookie: refreshToken=<valid_token>`:
   - Expect `200 OK` with updated cookie.

---

## Troubleshooting

- **Legacy requests still appearing in audit logs**:
  - Check the `appVersion` field in the `[AUTH_TRANSPORT]` log line.
  - Contact the mobile deployment team to force app updates via remote config or app store minimum version enforcement.
- **Sessions prematurely dropped for migrated mobile users**:
  - Mobile clients must send `X-Client-Type: mobile` and include `{ refreshToken }` in the JSON request body.
  - Verify that mobile storage is not wiping refresh tokens on background app pause.
