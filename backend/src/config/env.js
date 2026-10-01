/**
 * Environment checks run once at startup (config/startupEnvCheck.js, imported
 * by server.js before the app), so a missing secret or database setting stops
 * the process with a clear message instead of failing at the first request
 * that needs it. See .env.example for all variables.
 */

const REQUIRED = [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'DB_HOST',
    'ATTENDANCE_DB_USER',
    'ATTENDANCE_DB_PASSWORD',
    'ATTENDANCE_DB_NAME',
    // The Razorpay client is created when the app loads
    // (modules/payments/paymentService.js) and throws without its keys
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
];

// Only the web app's origin is allowed by CORS in production (config/cors.js)
const REQUIRED_IN_PRODUCTION = ['FRONTEND_URL'];

// Production features that stop working without one of these variables,
// while the rest of the app keeps running
const RECOMMENDED_IN_PRODUCTION = [
    [['REDIS_HOST', 'REDIS_URL'], 'selfie uploads, geocoding and report exports need Redis'],
    [['SMTP_USER', 'GMAIL_REFRESH_TOKEN'], 'emails (password reset codes) cannot be sent'],
    [['GROQ_API_KEY'], 'the AI chatbots and summaries are unavailable'],
];

const isSet = (env, key) => typeof env[key] === 'string' && env[key].trim() !== '';

/**
 * @returns {{ missing: string[], warnings: string[] }}
 */
export function checkEnv(env = process.env) {
    const production = env.NODE_ENV === 'production';
    const required = production ? [...REQUIRED, ...REQUIRED_IN_PRODUCTION] : REQUIRED;
    const missing = required.filter((key) => !isSet(env, key));

    const warnings = [];
    if (isSet(env, 'PORT') && !(Number.isInteger(Number(env.PORT)) && Number(env.PORT) > 0)) {
        missing.push('PORT (must be a port number)');
    }
    if (!isSet(env, 'NODE_ENV')) {
        warnings.push('NODE_ENV is not set; the server runs in development mode (detailed errors, CAPTCHA bypass allowed)');
    }
    if (production) {
        for (const [keys, effect] of RECOMMENDED_IN_PRODUCTION) {
            if (!keys.some((key) => isSet(env, key))) warnings.push(`${keys.join(' / ')} not set: ${effect}`);
        }
    }
    // Same rule as middleware/verifyCaptcha.js: on unless explicitly disabled
    const captchaEnabled = env.ENABLE_CAPTCHA !== 'false' && env.ENABLE_CAPTCHA !== '0';
    if (!captchaEnabled && production) {
        warnings.push('ENABLE_CAPTCHA disables the login CAPTCHA');
    } else if (captchaEnabled && !isSet(env, 'RECAPTCHA_SECRET_KEY')) {
        warnings.push('RECAPTCHA_SECRET_KEY is not set: logins with a Google reCAPTCHA token will fail');
    }
    return { missing, warnings };
}

/** Logs warnings; stops the process when required variables are missing. */
export function assertEnv(env = process.env) {
    const { missing, warnings } = checkEnv(env);
    for (const warning of warnings) console.warn(`[Config] ${warning}`);
    if (missing.length) {
        console.error(`[FATAL] Missing required environment variables: ${missing.join(', ')}. See .env.example.`);
        process.exit(1);
    }
}
