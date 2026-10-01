import rateLimit from 'express-rate-limit';
import requestIp from 'request-ip';

// Helper to normalize IP (Handle IPv6 / IPv4-mapped-IPv6)
const getClientIp = (req) => {
    let ip = req.clientIp || requestIp.getClientIp(req) || req.ip || '127.0.0.1';
    // Normalize IPv6 mapped IPv4 (e.g., ::ffff:127.0.0.1 -> 127.0.0.1)
    if (ip.substr(0, 7) == "::ffff:") {
        ip = ip.substr(7)
    }
    return ip;
};

// Global Limiter - General API usage
// 1 hour, 10000 requests per IP (Safe for large offices/CGNAT)
export const generalLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10000,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => {
        return getClientIp(req);
    },
    message: {
        ok: false,
        message: 'Too many requests from this IP, please try again after 1 hour',
    },
});

// Auth Limiter - Strict for Login/Signup
// 15 minutes, 8 failed attempts per account *from one IP*. Keying on the
// account alone would let anyone lock a user out by failing logins on their
// behalf; loginIpLimiter below still caps total failures per IP.
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 8,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => {
        const ip = getClientIp(req);

        // Identify the user by their login input (Email/Phone)
        const identifier = req.body?.user_input ||
            req.body?.email ||
            req.body?.phone ||
            req.body?.username;

        return identifier ? `${ip}:${identifier.toString().toLowerCase().trim()}` : ip;
    },
    message: {
        ok: false,
        message: 'Too many failed attempts for this account. Please try again after 15 minutes',
    },
});

// Password reset codes - every request counts, not only failures: each one
// sends an email. Keyed on IP + email, so nobody can flood one inbox and an
// office behind a shared IP is not blocked by one person.
export const passwordResetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => {
        const ip = getClientIp(req);
        const email = req.body?.email;
        return email ? `${ip}:${email.toString().toLowerCase().trim()}` : ip;
    },
    message: {
        ok: false,
        message: 'Too many verification code requests. Please try again after 15 minutes',
    },
});

// IP Fail-Safe Limiter - Protects against "Distributed Brute Force" / "Bot Attacks"
// If a single IP tries 300 times (even with different usernames), it gets blocked.
// This allows a large office (NAT) to have ~300 failed attempts total before blocking.
export const loginIpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => {
        return getClientIp(req);
    },
    message: {
        ok: false,
        message: 'Too many failed login attempts from this IP. Please try again after 15 minutes',
    },
});
