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
