/**
 * Single Redis client factory for the cache and the BullMQ queues/workers
 * (previously duplicated in cacheService.js and queues.js with different
 * retry and logging behavior).
 *
 * Env:
 *   REDIS_URL | REDIS_HOST, REDIS_PORT, REDIS_PASSWORD
 *   REDIS_USE_TLS=true           (also auto-detected: rediss://, port 6380,
 *                                 *.cache.amazonaws.com, *.upstash.io)
 *   REDIS_TLS_REJECT_UNAUTHORIZED=true   verify the server certificate
 *                                 (default false = previous behavior)
 *   REDIS_IS_CLUSTER=true|false  (also auto-detected: clustercfg.* / *-cluster)
 */
import Redis from 'ioredis';
import './config.js';

const ERROR_LOG_INTERVAL_MS = 5 * 60 * 1000;
const MAX_RETRY_DELAY_MS = 30000;

function connectionSettings() {
    const host = process.env.REDIS_HOST || '';
    const url = process.env.REDIS_URL || '';
    const port = Number(process.env.REDIS_PORT) || 6379;
    const password = process.env.REDIS_PASSWORD || undefined;

    const useTls = process.env.REDIS_USE_TLS === 'true' ||
        url.startsWith('rediss://') ||
        host.includes('cache.amazonaws.com') ||
        host.includes('upstash.io') ||
        port === 6380;

    const isCluster = (host.startsWith('clustercfg.') ||
        host.includes('-cluster') ||
        process.env.REDIS_IS_CLUSTER === 'true') &&
        process.env.REDIS_IS_CLUSTER !== 'false';

    return { host, url, port, password, useTls, isCluster };
}

const settings = connectionSettings();
const verifyTls = process.env.REDIS_TLS_REJECT_UNAUTHORIZED === 'true';

if (settings.useTls && !verifyTls && process.env.NODE_ENV === 'production') {
    console.warn('[Redis] TLS certificate verification is disabled; set REDIS_TLS_REJECT_UNAUTHORIZED=true once verified to work');
}

/**
 * Creates a Redis (or Redis Cluster) client.
 * @param {string} name     label used in logs, e.g. 'cache' or 'queue'
 * @param {object} options  { bullmq: true } for BullMQ connections
 */
export function createRedisClient(name, { bullmq = false } = {}) {
    const options = {
        // Exponential backoff: 0.5 s, 1 s, 1.5 s ... capped at 30 s
        retryStrategy: (times) => Math.min(times * 500, MAX_RETRY_DELAY_MS),
        ...(bullmq ? { maxRetriesPerRequest: null } : {}), // required by BullMQ
        ...(settings.useTls ? { tls: { rejectUnauthorized: verifyTls } } : {}),
    };

    let client;
    if (settings.isCluster) {
        console.log(`🌀 [Redis:${name}] Initializing Redis Cluster connection for ${settings.host}...`);
        client = new Redis.Cluster(
            [{ host: settings.host, port: settings.port }],
            {
                redisOptions: { password: settings.password, ...options },
                dnsLookup: (address, callback) => callback(null, address),
                slotsRefreshTimeout: 2000,
                clusterRetryStrategy: options.retryStrategy,
            }
        );
    } else if (settings.url) {
        client = new Redis(settings.url, options);
    } else {
        client = new Redis({
            host: settings.host || '127.0.0.1',
            port: settings.port,
            password: settings.password,
            ...options,
        });
    }

    // Log the first error and then at most once every 5 minutes, so an
    // outage is visible without flooding the logs on every retry.
    let lastErrorLoggedAt = 0;
    let suppressed = 0;
    client.on('error', (err) => {
        const now = Date.now();
        if (now - lastErrorLoggedAt < ERROR_LOG_INTERVAL_MS) {
            suppressed++;
            return;
        }
        const note = suppressed ? ` (${suppressed} similar errors suppressed)` : '';
        console.error(`⚠ [Redis:${name}] Connection error: ${err.message}${note}`);
        lastErrorLoggedAt = now;
        suppressed = 0;
    });
    client.on('ready', () => {
        console.log(`⚡ [Redis:${name}] Connected`);
        lastErrorLoggedAt = 0;
        suppressed = 0;
    });

    return client;
}

/**
 * Closes a client on shutdown: quit() flushes pending replies when
 * connected; otherwise disconnect() avoids waiting on reconnect attempts.
 */
export async function closeRedisClient(client) {
    if (!client) return;
    if (client.status === 'ready') {
        await client.quit();
    } else {
        client.disconnect();
    }
}
