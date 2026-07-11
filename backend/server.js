require('dotenv').config();
const pino = require('pino');
const logger = pino();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const promClient = require('prom-client');

const app = express();
const port = process.env.PORT || 5000;

// Prometheus Metrics Setup
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics({ prefix: 'formbhar_' });

const httpDuration = new promClient.Histogram({
  name: 'formbhar_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_class'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
});

// Config - move hardcoded URLs to env
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000;
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX) || 100;

// Input validation helpers
const isValidUUID = (str) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};



// Rate limiter
app.set('trust proxy', 1); // Trust first proxy (Render load balancer)
const generalLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW,
  max: RATE_LIMIT_MAX,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(cors({
    origin: true
}));
app.use(express.json());

app.use('/api/', generalLimiter);

// RED Metrics Middleware
app.use((req, res, next) => {
    const end = httpDuration.startTimer();
    res.on('finish', () => {
        const route = req.route ? req.route.path : req.url.split('?')[0];
        const statusClass = `${Math.floor(res.statusCode / 100)}xx`;
        end({ method: req.method, route, status_class: statusClass });
    });
    next();
});

// Request Correlation Middleware
app.use((req, res, next) => {
    const correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();
    req.correlationId = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);
    
    logger.info({
        correlationId,
        method: req.method,
        url: req.url,
        ip: req.ip
    }, 'Incoming request');
    
    next();
});

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL
        ? { rejectUnauthorized: false }
        : false
});

// Database Query Wrapper for Observability
async function dbQuery(req, queryText, params) {
    const correlationId = req ? req.correlationId : 'system';
    const startTime = Date.now();
    try {
        const res = await pool.query(queryText, params);
        const duration = Date.now() - startTime;
        logger.info({
            correlationId,
            query: queryText.split('\n')[0].substring(0, 100),
            durationMs: duration,
            rowCount: res.rowCount
        }, 'DB Query Success');
        return res;
    } catch (err) {
        const duration = Date.now() - startTime;
        logger.error({
            correlationId,
            query: queryText.split('\n')[0].substring(0, 100),
            durationMs: duration,
            error: err.message
        }, 'DB Query Error');
        throw err;
    }
}

// Database schema is managed via Supabase.

// Background jobs
let cleanupInterval;
if (process.env.NODE_ENV !== 'test') {
    cleanupInterval = setInterval(() => {
        dbQuery(null, `DELETE FROM sessions WHERE last_ping < NOW() - INTERVAL '1 day';`)
            .catch(err => logger.error('Cleanup error:', err));
    }, 60 * 60 * 1000); // Run every hour
}

// Routes

// 1. Initial User Registration / Update
app.post('/api/register-user', async (req, res) => {
    const { userId, extensionVersion } = req.body;
    if (!userId || !isValidUUID(userId)) return res.status(400).json({ error: 'Valid userId required' });

    try {
        await dbQuery(req,
            `INSERT INTO users (id, extension_version, last_active)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (id) 
       DO UPDATE SET last_active = CURRENT_TIMESTAMP, extension_version = $2;`,
            [userId, extensionVersion || 'unknown']
        );
        res.json({ success: true, message: 'User registered/updated' });
    } catch (err) {
        logger.error('Error in /register-user:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 2. Start Session
app.post('/api/start-session', async (req, res) => {
    const { userId } = req.body;
    if (!userId || !isValidUUID(userId)) return res.status(400).json({ error: 'Valid userId required' });

    try {
        // Ensure user exists first to prevent foreign key constraint violations
        await dbQuery(req,
            `INSERT INTO users (id, extension_version) 
             VALUES ($1, 'unknown') 
             ON CONFLICT (id) DO NOTHING`,
            [userId]
        );

        // Extract IP, Geo, and Device Info
        const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
        let cleanIp = ipAddress;
        if (cleanIp && cleanIp.includes(',')) cleanIp = cleanIp.split(',')[0].trim();
        // Handle local IPv6 representations for testing
        if (cleanIp === '::1' || cleanIp === '127.0.0.1') cleanIp = '127.0.0.1';

        const country = 'Unknown';
        const ua = req.headers['user-agent'] || '';
        const isMobile = /Mobile|iP(hone|od|ad)|Android|BlackBerry|IEMobile|Kindle|NetFront|Silk-Accelerated|(hpw|web)OS|Fennec|Minimo|Opera M(obi|ini)|Blazer|Dolfin|Dolphin|Skyfire|Zune/i.test(ua);
        const deviceString = isMobile ? 'Mobile' : 'Desktop';

        const result = await dbQuery(req,
            `INSERT INTO sessions (user_id, device_type, ip_address, country)
             VALUES ($1, $2, $3, $4)
             RETURNING id;`,
            [userId, deviceString, cleanIp, country]
        );

        res.json({
            success: true,
            sessionId: result.rows[0].id
        });
    } catch (err) {
        logger.error('Error starting session:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 3. Ping Live Session
app.post('/api/ping', async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId || !isValidUUID(sessionId)) return res.status(400).json({ error: 'Valid sessionId required' });

    try {
        await dbQuery(req,
            `UPDATE sessions
             SET last_ping = CURRENT_TIMESTAMP
             WHERE id = $1;`,
            [sessionId]
        );

        res.json({ success: true });
    } catch (err) {
        logger.error('Error in /ping:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 3. Log Form Fill
app.post('/api/log-form', async (req, res) => {
    const { userId, formTitle, questionsCount } = req.body;
    if (!userId || !isValidUUID(userId)) return res.status(400).json({ error: 'Valid userId required' });

    try {
        await dbQuery(req,
            `INSERT INTO form_logs (user_id, form_title, questions_count)
       VALUES ($1, $2, $3)`,
            [userId, formTitle || 'Unknown Form', questionsCount || 0]
        );
        res.json({ success: true, message: 'Form logged successfully' });
    } catch (err) {
        logger.error('Error in /log-form:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 4. Get Global Stats
app.get('/api/stats', async (req, res) => {
    try {
        const [
            totalUsersResult,
            liveUsersResult,
            formsFilledResult,
            avgSessionResult,
            dauResult
        ] = await Promise.all([
            // Total Users
            dbQuery(req, `SELECT COUNT(*) as count FROM users;`),
            
            // Live Users (active within 60 seconds)
            dbQuery(req, `
                SELECT COUNT(DISTINCT user_id) as count
                FROM sessions
                WHERE last_ping > NOW() - INTERVAL '60 seconds';
            `),
            
            // Forms Filled
            dbQuery(req, `SELECT COUNT(*) as count FROM form_logs;`),
            
            // Average Session Time (in seconds)
            dbQuery(req, `
                SELECT AVG(EXTRACT(EPOCH FROM (last_ping - started_at))) as avg_session_seconds
                FROM sessions
                WHERE last_ping > started_at;
            `),
            
            // Daily Active Users (DAU)
            dbQuery(req, `
                SELECT COUNT(DISTINCT user_id) as count
                FROM sessions
                WHERE last_ping > NOW() - INTERVAL '24 hours';
            `)
        ]);

        res.json({
            totalUsers: parseInt(totalUsersResult.rows[0].count, 10),
            liveUsers: parseInt(liveUsersResult.rows[0].count, 10),
            formsFilled: parseInt(formsFilledResult.rows[0].count, 10),
            avgSessionTime: Math.round(avgSessionResult.rows[0].avg_session_seconds || 0),
            dailyActiveUsers: parseInt(dauResult.rows[0].count, 10)
        });
    } catch (err) {
        logger.error('Error in /stats:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Admin Endpoints ---
const adminAuth = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};
app.use('/api/admin', adminAuth);

// A. Detailed Stats
app.get('/api/admin/detailed-stats', async (req, res) => {
    try {
        const deviceStats = await dbQuery(req, `SELECT device_type, COUNT(*) as count FROM sessions WHERE device_type IS NOT NULL GROUP BY device_type;`);
        const countryStats = await dbQuery(req, `SELECT country, COUNT(*) as count FROM sessions WHERE country IS NOT NULL AND country != 'Unknown' GROUP BY country;`);

        res.json({
            devices: deviceStats.rows,
            countries: countryStats.rows
        });
    } catch (err) {
        logger.error({ error: err.message }, 'Error in /admin/detailed-stats');
        res.status(500).json({ error: 'Internal server error' });
    }
});

// B. User Growth
app.get('/api/admin/user-growth', async (req, res) => {
    try {
        const growth = await dbQuery(req, `
            SELECT DATE(created_at) as date, COUNT(*) as new_users
            FROM users
            WHERE created_at > NOW() - INTERVAL '30 days'
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at) ASC;
        `);
        res.json(growth.rows);
    } catch (err) {
        logger.error({ error: err.message }, 'Error in /admin/user-growth');
        res.status(500).json({ error: 'Internal server error' });
    }
});

// C. Forms per Day
app.get('/api/admin/forms-per-day', async (req, res) => {
    try {
        const forms = await dbQuery(req, `
            SELECT DATE(created_at) as date, COUNT(*) as forms_filled
            FROM form_logs
            WHERE created_at > NOW() - INTERVAL '30 days'
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at) ASC;
        `);
        res.json(forms.rows);
    } catch (err) {
        logger.error({ error: err.message }, 'Error in /admin/forms-per-day');
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Basic health check
app.get('/', (req, res) => {
    res.send('FormBhar Analytics API is running');
});

// Metrics endpoint for Prometheus
app.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', promClient.register.contentType);
        res.end(await promClient.register.metrics());
    } catch (ex) {
        logger.error({ error: ex.message }, 'Error generating metrics');
        res.status(500).end(ex.message);
    }
});

if (require.main === module) {
    // --- Scheduled Tasks ---
    // Run cleanup every 24 hours
    setInterval(() => {
        logger.info('Running daily database cleanup...');
        pool.query(`DELETE FROM sessions WHERE last_ping < NOW() - INTERVAL '30 days';`)
            .then(res => logger.info(`Deleted ${res.rowCount} old sessions.`))
            .catch(err => logger.error({ error: err.message }, 'Error cleaning up sessions'));

        pool.query(`DELETE FROM form_logs WHERE created_at < NOW() - INTERVAL '90 days'; `)
            .then(res => logger.info(`Deleted ${res.rowCount} old form logs.`))
            .catch(err => logger.error({ error: err.message }, 'Error cleaning up form logs'));
    }, 24 * 60 * 60 * 1000);
    app.listen(port, () => {
        logger.info(`Server is running on port ${port}`);
    });
}

module.exports = app;
