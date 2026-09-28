import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import requestIp from 'request-ip';

import { generalLimiter } from './middleware/rateLimiter.js';
import errorHandler from './middleware/errorHandler.js';
import AppError from './utils/AppError.js';
import { apiMonitor } from './middleware/apiMonitor.js';
import { corsOptions } from './config/cors.js';
import { attendanceDB } from './config/database.js';
import { isShuttingDown } from './lifecycle/shutdown.js';

// Import route definitions
import routes from './modules/index.js';

const app = express();

app.set('trust proxy', 1); // Trust reverse proxy (Nginx) for secure cookies

app.use(cookieParser());
app.use(cors(corsOptions));

app.use(helmet());
app.use(requestIp.mw());

// Lightweight health checks (placed before rate limiter to prevent load-balancer/monitor 429s)
app.get(['/health', '/api/health'], (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'Backend service is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Readiness check: 503 while shutting down or when the database is unreachable,
// so deploy scripts / load balancers only route traffic to a usable process.
const READY_DB_TIMEOUT_MS = 2000;
app.get(['/ready', '/api/ready'], async (req, res) => {
    if (isShuttingDown()) {
        return res.status(503).json({ status: 'unavailable', reason: 'shutting_down' });
    }
    let timer;
    try {
        await Promise.race([
            attendanceDB.raw('select 1'),
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), READY_DB_TIMEOUT_MS); }),
        ]);
        res.status(200).json({ status: 'ready' });
    } catch (err) {
        res.status(503).json({ status: 'unavailable', reason: 'database' });
    } finally {
        clearTimeout(timer);
    }
});

app.use(generalLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(apiMonitor);

// Main API Router
app.use('/', routes);

// Handle 404 for undefined routes
app.all(/(.*)/, (req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global Error Handler
app.use(errorHandler);

export default app;

// Enterprise Express Application Configuration & Endpoint Pipeline
