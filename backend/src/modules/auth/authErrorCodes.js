/**
 * Enum-like constants for authentication and authorization error codes.
 * Prevents string typos and serves as the stable contract for client apps.
 */
export const AUTH_ERROR_CODES = Object.freeze({
    // Refresh Token & Session Lifecycle
    INVALID_REFRESH_TOKEN: 'INVALID_REFRESH_TOKEN',
    NO_REFRESH_TOKEN: 'NO_REFRESH_TOKEN',
    SESSION_REVOKED: 'SESSION_REVOKED',
    SESSION_EXPIRED: 'SESSION_EXPIRED',
    SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',

    // Access Token & JWT Validation
    TOKEN_INVALID: 'TOKEN_INVALID',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    NO_TOKEN: 'NO_TOKEN',
    INVALID_USER: 'INVALID_USER',

    // User Credentials & Account Status
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
    ACCOUNT_DELETED: 'ACCOUNT_DELETED',
    ADMIN_INACTIVE: 'ADMIN_INACTIVE',

    // Organization Status
    ORG_DELETED: 'ORG_DELETED',
    ORG_INACTIVE: 'ORG_INACTIVE',

    // Password Management & OTP
    INVALID_OTP: 'INVALID_OTP',
    RESET_TOKEN_EXPIRED: 'RESET_TOKEN_EXPIRED',
    RESET_TOKEN_INVALID: 'RESET_TOKEN_INVALID',
    RESET_TOKEN_USED: 'RESET_TOKEN_USED',
    PASSWORD_TOO_SHORT: 'PASSWORD_TOO_SHORT',

    // Request Validation
    REQUIRED_FIELDS_MISSING: 'REQUIRED_FIELDS_MISSING',
});

export default AUTH_ERROR_CODES;
